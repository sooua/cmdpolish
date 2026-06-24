import type { HistoryBackend, HistoryEntry, HistoryQuery } from "./types";

const KEY = "cmdpolish.history";

/**
 * localStorage fallback used when running outside Tauri (e.g. `npm run dev` in
 * a browser). Keeps the same contract as the SQLite backend.
 */
export class LocalHistoryBackend implements HistoryBackend {
  readonly kind = "local" as const;

  async init(): Promise<void> {
    if (!this.read()) this.write([]);
  }

  private read(): HistoryEntry[] | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as HistoryEntry[]) : null;
    } catch {
      return null;
    }
  }

  private write(entries: HistoryEntry[]): void {
    localStorage.setItem(KEY, JSON.stringify(entries));
  }

  async list(query: HistoryQuery = {}): Promise<HistoryEntry[]> {
    let entries = this.read() ?? [];
    if (query.language && query.language !== "all") {
      entries = entries.filter((e) => e.language === query.language);
    }
    if (query.risk && query.risk !== "all") {
      entries = entries.filter((e) => e.riskLevel === query.risk);
    }
    if (query.search && query.search.trim()) {
      const q = query.search.trim().toLowerCase();
      entries = entries.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.inputText.toLowerCase().includes(q) ||
          e.outputText.toLowerCase().includes(q)
      );
    }
    entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return entries.slice(0, query.limit ?? 200);
  }

  async add(entry: HistoryEntry): Promise<void> {
    const entries = (this.read() ?? []).filter((e) => e.id !== entry.id);
    entries.unshift(entry);
    this.write(entries.slice(0, 500));
  }

  async remove(id: string): Promise<void> {
    this.write((this.read() ?? []).filter((e) => e.id !== id));
  }

  async clear(): Promise<void> {
    this.write([]);
  }
}
