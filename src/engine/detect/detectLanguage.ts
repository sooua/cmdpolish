import type { DetectResult, Language } from "../types";

type Signal = {
  language: Language;
  score: number;
  reason: string;
};

const SQL_KEYWORDS =
  /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+(TABLE|DATABASE|INDEX)|ALTER\s+TABLE|DROP\s+(TABLE|DATABASE)|TRUNCATE)\b/i;
const SQL_CLAUSES = /\b(FROM|WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|RETURNING|VALUES|SET)\b/i;

const BASH_COMMANDS =
  /(^|\s)(sudo|cd|cat|grep|awk|sed|chmod|chown|systemctl|journalctl|tar|ssh|scp|rsync|export|echo|ls|mkdir|rm|cp|mv|ps|kill)\b/;

const POWERSHELL_VERBS =
  /\b(Get|Set|New|Remove|Test|Start|Stop|Restart|Invoke|Add|Clear|Write|Select|Where|ForEach)-[A-Z][A-Za-z]+/;

/**
 * Heuristic language detection. Returns the highest-scoring language with a
 * normalized confidence and the human-readable reasons that contributed.
 */
export function detectLanguage(raw: string): DetectResult {
  const text = raw.trim();
  if (!text) {
    return { language: "plain-text", confidence: 0, reason: ["empty input"] };
  }

  const signals: Signal[] = [];
  const add = (language: Language, score: number, reason: string) =>
    signals.push({ language, score, reason });

  const firstChar = text[0];
  const lastChar = text[text.length - 1];

  // ---- JSON ----
  if (
    (firstChar === "{" && lastChar === "}") ||
    (firstChar === "[" && lastChar === "]")
  ) {
    add("json", 3, "starts/ends with JSON braces or brackets");
    try {
      JSON.parse(text);
      add("json", 6, "parses as valid JSON");
    } catch {
      /* still likely JSON-ish */
    }
  }

  // ---- curl ----
  if (/(^|\s)curl\s/.test(text)) {
    add("curl", 5, "contains curl");
    if (/\s-(X|H|d|F|u|o)\b|--(data|url|header|request)\b/.test(text))
      add("curl", 2, "contains curl flags");
    if (/\|\s*(bash|sh)\b/.test(text)) add("curl", 1, "piped to a shell");
  }
  if (/(^|\s)wget\s/.test(text)) add("curl", 3, "contains wget");

  // ---- kubectl ----
  if (/(^|\s)kubectl\s/.test(text)) {
    add("kubectl", 6, "contains kubectl");
    if (/\b(get|apply|delete|describe|logs|exec)\b/.test(text))
      add("kubectl", 1, "contains kubectl subcommand");
  }

  // ---- Docker / docker compose ----
  if (/(^|\s)docker(\s+compose|-compose)?\s/.test(text)) {
    add("docker", 5, "contains docker");
    if (/docker\s+(compose|-compose)/.test(text) || /docker-compose/.test(text))
      add("docker-compose", 8, "contains docker compose");
    if (/\b(run|exec|build|logs|ps|up|down|pull|push)\b/.test(text))
      add("docker", 1, "contains docker subcommand");
  }

  // ---- PowerShell ----
  if (POWERSHELL_VERBS.test(text)) add("powershell", 5, "contains Verb-Noun cmdlet");
  if (/\$env:/.test(text)) add("powershell", 3, "contains $env:");
  if (/`\s*$/m.test(text) && POWERSHELL_VERBS.test(text))
    add("powershell", 2, "backtick line continuation");

  // ---- Bash / Shell ----
  if (BASH_COMMANDS.test(text)) add("bash", 4, "contains common shell command");
  if (/\\\s*$/m.test(text)) add("bash", 2, "backslash line continuation");
  if (/<<-?\s*['"]?\w+['"]?/.test(text)) add("bash", 2, "contains heredoc");
  if (/^#!.*\b(sh|bash)\b/.test(text)) add("bash", 4, "shebang");
  if (/\|\s*\w/.test(text)) add("bash", 1, "contains pipe");

  // ---- .env ----
  const envLines = text
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"));
  const envMatches = envLines.filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l.trim()));
  if (envMatches.length >= 1 && envMatches.length === envLines.length) {
    add("env", 4 + Math.min(envMatches.length, 4), "all lines are KEY=value");
  } else if (envMatches.length >= 2) {
    add("env", 3, "multiple KEY=value lines");
  }

  // ---- YAML ----
  if (/^---\s*$/m.test(text)) add("yaml", 3, "contains --- document separator");
  if (/^\s*[\w.-]+:\s+\S/m.test(text)) add("yaml", 3, "contains key: value");
  if (/^\s+-\s+\S/m.test(text)) add("yaml", 1, "contains list items");

  // ---- SQL ----
  if (SQL_KEYWORDS.test(text)) add("sql", 5, "contains SQL statement keyword");
  if (SQL_CLAUSES.test(text)) add("sql", 2, "contains SQL clause");
  if (/;\s*$/m.test(text) && SQL_KEYWORDS.test(text))
    add("sql", 1, "statement terminator");

  // ---- Markdown ----
  if (/^#{1,6}\s+\S/m.test(text)) add("markdown", 3, "contains heading");
  if (/```/.test(text)) add("markdown", 3, "contains fenced code block");
  if (/^\s*[-*+]\s+\S/m.test(text)) add("markdown", 1, "contains bullet list");
  if (/^\s*>\s+\S/m.test(text)) add("markdown", 1, "contains blockquote");
  if (/\|.*\|.*\|/.test(text) && /\|\s*-+\s*\|/.test(text))
    add("markdown", 2, "contains table");

  if (signals.length === 0) {
    return { language: "plain-text", confidence: 0.3, reason: ["no strong signal"] };
  }

  // Aggregate scores per language.
  const totals = new Map<Language, { score: number; reasons: string[] }>();
  for (const s of signals) {
    const entry = totals.get(s.language) ?? { score: 0, reasons: [] };
    entry.score += s.score;
    entry.reasons.push(s.reason);
    totals.set(s.language, entry);
  }

  let best: Language = "plain-text";
  let bestScore = 0;
  let bestReasons: string[] = [];
  let sumScore = 0;
  for (const [lang, entry] of totals) {
    sumScore += entry.score;
    if (entry.score > bestScore) {
      best = lang;
      bestScore = entry.score;
      bestReasons = entry.reasons;
    }
  }

  // Confidence: best score relative to all evidence, capped.
  const confidence = Math.max(0.3, Math.min(0.99, bestScore / (sumScore + 4)));

  return { language: best, confidence, reason: bestReasons };
}
