import Database from "@tauri-apps/plugin-sql";
import type { Language } from "../../engine/types";
import type {
  HistoryBackend,
  HistoryEntry,
  HistoryQuery,
  RiskLevel,
} from "./types";

type Row = {
  id: string;
  title: string;
  language: string;
  input_text: string;
  output_text: string;
  created_at: string;
  updated_at: string;
  has_secrets: number;
  risk_level: string;
};

function toEntry(r: Row): HistoryEntry {
  return {
    id: r.id,
    title: r.title,
    language: r.language as Language,
    inputText: r.input_text,
    outputText: r.output_text,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    hasSecrets: r.has_secrets === 1,
    riskLevel: r.risk_level as RiskLevel,
  };
}

/** SQLite-backed history via the Tauri SQL plugin. Migrations run on load. */
export class SqlHistoryBackend implements HistoryBackend {
  readonly kind = "sqlite" as const;
  private db: Database | null = null;

  async init(): Promise<void> {
    this.db = await Database.load("sqlite:cmdpolish.db");
  }

  private get database(): Database {
    if (!this.db) throw new Error("History database not initialized");
    return this.db;
  }

  async list(query: HistoryQuery = {}): Promise<HistoryEntry[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    let p = 1;

    if (query.language && query.language !== "all") {
      where.push(`language = $${p++}`);
      params.push(query.language);
    }
    if (query.search && query.search.trim()) {
      const like = `%${query.search.trim()}%`;
      where.push(`(title LIKE $${p} OR input_text LIKE $${p} OR output_text LIKE $${p})`);
      params.push(like);
      p++;
    }

    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const limit = query.limit ?? 200;
    const rows = await this.database.select<Row[]>(
      `SELECT * FROM snippets ${clause} ORDER BY datetime(created_at) DESC LIMIT ${limit}`,
      params
    );
    return rows.map(toEntry);
  }

  async add(e: HistoryEntry): Promise<void> {
    await this.database.execute(
      `INSERT OR REPLACE INTO snippets
        (id, title, language, input_text, output_text, created_at, updated_at, has_secrets, risk_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        e.id,
        e.title,
        e.language,
        e.inputText,
        e.outputText,
        e.createdAt,
        e.updatedAt,
        e.hasSecrets ? 1 : 0,
        e.riskLevel,
      ]
    );
  }

  async remove(id: string): Promise<void> {
    await this.database.execute("DELETE FROM snippets WHERE id = $1", [id]);
  }

  async clear(): Promise<void> {
    await this.database.execute("DELETE FROM snippets");
  }
}
