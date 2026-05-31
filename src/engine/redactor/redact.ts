import type {
  RedactFinding,
  RedactMode,
  RedactResult,
  RedactSettings,
} from "../types";
import { SECRET_PATTERNS } from "./patterns";

/** Build the replacement string for a finding under the given mode. */
function buildReplacement(
  value: string,
  type: string,
  mode: RedactMode
): string {
  switch (mode) {
    case "preserve-ends": {
      if (value.length <= 8) return "*".repeat(value.length);
      return `${value.slice(0, 5)}...${value.slice(-4)}`;
    }
    case "placeholder": {
      const key = type
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      return `<${key}>`;
    }
    case "hidden":
      return "********";
    case "delivery":
      return "<REDACTED>";
  }
}

/**
 * Scan text for secrets and produce findings plus the redacted text.
 * Overlapping matches are resolved by preferring the earliest, then longest.
 */
export function redact(
  text: string,
  settings: RedactSettings
): RedactResult {
  const findings: RedactFinding[] = [];

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.optional === "email" && !settings.redactEmail) continue;
    if (pattern.optional === "ip" && !settings.redactIp) continue;
    if (pattern.optional === "domain" && !settings.redactDomain) continue;

    const re = new RegExp(pattern.regex.source, pattern.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0] === "") {
        re.lastIndex++;
        continue;
      }
      const groupIdx = pattern.group ?? 0;
      const value = m[groupIdx] ?? m[0];
      if (!value) continue;
      const start = m.index + m[0].indexOf(value);
      const end = start + value.length;
      findings.push({
        type: pattern.type,
        value,
        start,
        end,
        severity: pattern.severity,
        replacement: buildReplacement(value, pattern.type, settings.mode),
      });
    }
  }

  // Resolve overlaps: sort by start, drop any finding that overlaps a kept one.
  findings.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: RedactFinding[] = [];
  let lastEnd = -1;
  for (const f of findings) {
    if (f.start >= lastEnd) {
      kept.push(f);
      lastEnd = f.end;
    }
  }

  // Apply replacements right-to-left so indices stay valid.
  let out = text;
  for (let i = kept.length - 1; i >= 0; i--) {
    const f = kept[i];
    out = out.slice(0, f.start) + f.replacement + out.slice(f.end);
  }

  return { text: out, findings: kept };
}

/** Quick check used by history to decide whether to store plaintext. */
export function hasSecrets(text: string): boolean {
  return redact(text, {
    mode: "hidden",
    redactEmail: false,
    redactIp: false,
    redactDomain: false,
  }).findings.length > 0;
}
