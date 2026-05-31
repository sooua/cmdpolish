import type { Severity } from "../types";

export type SecretPattern = {
  type: string;
  severity: Severity;
  regex: RegExp;
  /** Which capture group holds the secret value (default: whole match). */
  group?: number;
  /** Optional toggle key for patterns that are off by default. */
  optional?: "email" | "ip" | "domain";
};

/**
 * Ordered, most-specific-first. All regexes are global + multiline so the
 * redactor can scan the whole document.
 */
export const SECRET_PATTERNS: SecretPattern[] = [
  // ---- Provider-specific keys (high confidence) ----
  {
    type: "OpenAI API Key",
    severity: "critical",
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    type: "Anthropic API Key",
    severity: "critical",
    regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    type: "Resend API Key",
    severity: "high",
    regex: /\bre_[A-Za-z0-9_]{16,}\b/g,
  },
  {
    type: "Stripe Key",
    severity: "critical",
    regex: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  },
  {
    type: "GitHub Token",
    severity: "critical",
    regex: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{16,}\b/g,
  },
  {
    type: "AWS Access Key ID",
    severity: "critical",
    regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
  {
    type: "Slack Token",
    severity: "high",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    type: "Google API Key",
    severity: "high",
    regex: /\bAIza[A-Za-z0-9_-]{35}\b/g,
  },

  // ---- Structured secrets ----
  {
    type: "JWT",
    severity: "high",
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    type: "Bearer Token",
    severity: "high",
    regex: /\b[Bb]earer\s+([A-Za-z0-9._\-+/=]{12,})/g,
    group: 1,
  },
  {
    type: "Database Connection String",
    severity: "critical",
    regex:
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s'"]*:([^@\s'"]+)@[^\s'"]+/g,
    group: 1,
  },
  {
    type: "Private Key Block",
    severity: "critical",
    regex:
      /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
  },
  {
    type: "bcrypt Hash",
    severity: "medium",
    regex: /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}\b/g,
  },

  // ---- KEY=value style assignments for sensitive field names ----
  {
    type: "Secret Assignment",
    severity: "high",
    regex:
      /\b([A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CLIENT_?SECRET|AUTH|CREDENTIAL)[A-Z0-9_]*)\s*[:=]\s*['"]?([^\s'"#]+)['"]?/gi,
    group: 2,
  },
  {
    type: "Password Flag",
    severity: "high",
    // e.g. -p mypass, --password=mypass, PGPASSWORD=...
    regex:
      /(?:--?password[=\s]+|--?pass[=\s]+|PGPASSWORD[=\s]+|MYSQL_PWD[=\s]+)['"]?([^\s'"]+)['"]?/g,
    group: 1,
  },

  // ---- Optional / off by default ----
  {
    type: "Email",
    severity: "low",
    optional: "email",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    type: "IPv4 Address",
    severity: "low",
    optional: "ip",
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  },
];
