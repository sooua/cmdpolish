// Auto-update helpers wrapping the Tauri updater + process plugins. No-ops in
// the browser (dev). The pending Update object is held between check and install.

export type UpdateInfo = {
  version: string;
  currentVersion: string;
  notes: string;
};

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pending: any = null;

/** Current installed app version (falls back to package version in the browser). */
export async function appVersion(): Promise<string> {
  if (!isTauri()) return "0.1.1";
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return "0.1.1";
  }
}

/** Check the release endpoint. Returns update info, or null when up to date. */
export async function checkUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) {
    pending = null;
    return null;
  }
  pending = update;
  return {
    version: update.version,
    currentVersion: update.currentVersion,
    notes: (update.body ?? "").trim(),
  };
}

/** Download + install the pending update, then relaunch the app. */
export async function installUpdate(
  onProgress?: (downloaded: number, total: number | null) => void
): Promise<void> {
  if (!pending) throw new Error("No pending update to install.");
  let downloaded = 0;
  let total: number | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await pending.downloadAndInstall((event: any) => {
    switch (event.event) {
      case "Started":
        total = event.data?.contentLength ?? null;
        onProgress?.(0, total);
        break;
      case "Progress":
        downloaded += event.data?.chunkLength ?? 0;
        onProgress?.(downloaded, total);
        break;
      case "Finished":
        onProgress?.(total ?? downloaded, total);
        break;
    }
  });
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
