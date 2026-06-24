import type { Language, Severity } from "../../engine/types";

export type RiskLevel = Severity | "none";

/** A single saved snippet. Mirrors the `snippets` SQLite table. */
export type HistoryEntry = {
  id: string;
  title: string;
  language: Language;
  inputText: string;
  outputText: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  hasSecrets: boolean;
  riskLevel: RiskLevel;
  /** AI formatting duration in milliseconds (undefined for older entries). */
  durationMs?: number;
};

export type HistoryQuery = {
  search?: string;
  language?: Language | "all";
  risk?: RiskLevel | "all";
  limit?: number;
};

export interface HistoryBackend {
  /** The storage kind, surfaced in the UI ("local" vs "sqlite"). */
  readonly kind: "sqlite" | "local";
  init(): Promise<void>;
  list(query?: HistoryQuery): Promise<HistoryEntry[]>;
  add(entry: HistoryEntry): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}
