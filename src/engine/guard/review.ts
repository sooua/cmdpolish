import type { GuardFinding, GuardResult, Severity } from "../types";
import { GUARD_RULES, SQL_DESTRUCTIVE } from "./rules";

const SEVERITY_ORDER: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split(/\n/).length;
}

/** Strip string literals so DELETE/UPDATE checks ignore WHERE inside strings. */
function stripStrings(sql: string): string {
  return sql.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, "''");
}

/** Detect DELETE/UPDATE statements missing a WHERE clause. */
function reviewSql(text: string): GuardFinding[] {
  const findings: GuardFinding[] = [];
  // Split into statements on semicolons (outside strings).
  const stripped = stripStrings(text);
  const stmtRegex = /[^;]+;?/g;
  let m: RegExpExecArray | null;
  while ((m = stmtRegex.exec(stripped)) !== null) {
    const stmt = m[0];
    if (!stmt.trim()) continue;
    const line = lineOf(text, m.index);

    if (/\bDELETE\s+FROM\b/i.test(stmt) && !/\bWHERE\b/i.test(stmt)) {
      findings.push({
        ruleId: "sql.delete-no-where",
        title: "DELETE without WHERE",
        severity: "high",
        message: "DELETE without a WHERE clause removes every row in the table.",
        suggestion: "Add a WHERE clause, or SELECT first to confirm the scope.",
        line,
      });
    }
    if (
      /\bUPDATE\s+["`]?\w+["`]?\s+SET\b/i.test(stmt) &&
      !/\bWHERE\b/i.test(stmt)
    ) {
      findings.push({
        ruleId: "sql.update-no-where",
        title: "UPDATE without WHERE",
        severity: "high",
        message: "UPDATE without a WHERE clause changes every row in the table.",
        suggestion: "Add a WHERE clause to target specific rows.",
        line,
      });
    }
  }

  if (SQL_DESTRUCTIVE.test(stripped)) {
    const dm = stripped.match(SQL_DESTRUCTIVE)!;
    findings.push({
      ruleId: "sql.destructive-ddl",
      title: "Destructive DDL",
      severity: "high",
      message: `Destructive statement detected: ${dm[0].toUpperCase()}.`,
      suggestion: "Ensure you have a backup before running schema/data drops.",
      line: lineOf(text, stripped.indexOf(dm[0])),
    });
  }

  return findings;
}

/** Run all guard rules over the text and return an aggregated risk level. */
export function review(text: string): GuardResult {
  const findings: GuardFinding[] = [];

  for (const rule of GUARD_RULES) {
    const re = new RegExp(rule.test.source, rule.test.flags.includes("g") ? rule.test.flags : rule.test.flags + "g");
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = re.exec(text)) !== null && guard++ < 50) {
      findings.push({
        ruleId: rule.ruleId,
        title: rule.title,
        severity: rule.severity,
        message: rule.message,
        suggestion: rule.suggestion,
        line: lineOf(text, m.index),
      });
      if (m[0] === "") re.lastIndex++;
    }
  }

  findings.push(...reviewSql(text));

  // De-duplicate by ruleId + line.
  const seen = new Set<string>();
  const unique = findings.filter((f) => {
    const key = `${f.ruleId}:${f.line ?? 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort(
    (a, b) =>
      SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] ||
      (a.line ?? 0) - (b.line ?? 0)
  );

  const level: GuardResult["level"] = unique.length
    ? unique[0].severity
    : "none";

  return { level, findings: unique };
}
