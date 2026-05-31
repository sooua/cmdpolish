// Tiny localStorage-backed settings persistence. Works in both the browser dev
// server and the Tauri webview. Note: provider API keys are stored here in
// plaintext — acceptable for a local-only desktop tool, but not synced anywhere.

const KEY = "cmdpolish.settings";

export function loadSettings<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    // Shallow-merge so newly added defaults are preserved across versions.
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function saveSettings<T>(settings: T): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota/availability errors */
  }
}
