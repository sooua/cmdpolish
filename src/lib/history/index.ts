import type { HistoryBackend } from "./types";
import { SqlHistoryBackend } from "./sqlBackend";
import { LocalHistoryBackend } from "./localBackend";

export type { HistoryEntry, HistoryQuery, RiskLevel } from "./types";

/** True when running inside the Tauri desktop runtime. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let backendPromise: Promise<HistoryBackend> | null = null;

/** Lazily create and initialize the appropriate history backend (singleton). */
export function getHistoryBackend(): Promise<HistoryBackend> {
  if (!backendPromise) {
    backendPromise = (async () => {
      const backend: HistoryBackend = isTauri()
        ? new SqlHistoryBackend()
        : new LocalHistoryBackend();
      try {
        await backend.init();
        return backend;
      } catch (e) {
        // If SQLite fails for any reason, degrade to localStorage so history
        // never blocks the core workflow.
        console.error("History backend init failed, falling back to local:", e);
        const fallback = new LocalHistoryBackend();
        await fallback.init();
        return fallback;
      }
    })();
  }
  return backendPromise;
}
