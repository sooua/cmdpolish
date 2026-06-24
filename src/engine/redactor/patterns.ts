import type { Severity } from "../types";

export type SecretPattern = {
  type: string;
  severity: Severity;
  regex: RegExp;
  /** Which capture group holds the secret value (default: whole match). */
  group?: number;
  /**
   * For patterns whose value can land in one of several alternation groups
   * (e.g. quoted vs. unquoted). The first non-empty group wins.
   */
  valueGroups?: number[];
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
    type: "GitLab Token",
    severity: "critical",
    regex: /\bglpat-[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    type: "AWS Access Key ID",
    severity: "critical",
    regex: /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA|ANVA)[A-Z0-9]{16}\b/g,
  },
  {
    type: "Google API Key",
    severity: "high",
    regex: /\bAIza[A-Za-z0-9_-]{35}\b/g,
  },
  {
    type: "Slack Token",
    severity: "high",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    type: "Slack App Token",
    severity: "high",
    regex: /\bxapp-\d-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    type: "Slack Webhook",
    severity: "high",
    regex: /\bhttps:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]{20,}\b/g,
  },
  {
    type: "Discord Bot Token",
    severity: "high",
    regex: /\b[MNO][A-Za-z\d_-]{23,25}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,}\b/g,
  },
  {
    type: "Discord Webhook",
    severity: "high",
    regex:
      /\bhttps:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+\b/g,
  },
  {
    type: "Telegram Bot Token",
    severity: "high",
    regex: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g,
  },
  {
    type: "Twilio Account SID",
    severity: "high",
    regex: /\bAC[a-f0-9]{32}\b/g,
  },
  {
    type: "Twilio API Key",
    severity: "high",
    regex: /\bSK[a-f0-9]{32}\b/g,
  },
  {
    type: "SendGrid API Key",
    severity: "high",
    regex: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g,
  },
  {
    type: "npm Token",
    severity: "high",
    regex: /\bnpm_[A-Za-z0-9]{36}\b/g,
  },
  {
    type: "Hugging Face Token",
    severity: "high",
    regex: /\bhf_[A-Za-z0-9]{34}\b/g,
  },
  {
    type: "DigitalOcean Token",
    severity: "critical",
    regex: /\b(?:dop|dor|doo)_v1_[a-f0-9]{64}\b/g,
  },
  {
    type: "Supabase Key",
    severity: "high",
    regex: /\bsb[ps]_[A-Za-z0-9]{40,}\b/g,
  },
  {
    type: "PlanetScale Token",
    severity: "high",
    regex: /\bpscale_(?:pw|tkn)_[A-Za-z0-9_.-]{32,}\b/g,
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
    regex: /\b[Bb]earer\s+([A-Za-z0-9._\-+/=]{12,})\b/g,
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
    // Matches FOO_PASSWORD=bar, export API_KEY="ba r", set TOKEN: 'x'. The value
    // may be quoted (capturing internal spaces) or an unquoted non-space run.
    regex:
      /\b([A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CLIENT_?SECRET|AUTH|CREDENTIAL)[A-Z0-9_]*)\s*[:=]\s*(?:"([^"\n]+)"|'([^'\n]+)'|([^\s'"#]+))/gi,
    valueGroups: [2, 3, 4],
  },
  {
    type: "Password Flag",
    severity: "high",
    // e.g. -p mypass, --password=mypass, PGPASSWORD=...
    regex:
      /(?:--?password[=\s]+|--?passwd[=\s]+|--?pwd[=\s]+|--?pass[=\s]+|PGPASSWORD[=\s]+|MYSQL_PWD[=\s]+)(?:"([^"\n]+)"|'([^'\n]+)'|([^\s'"]+))/g,
    valueGroups: [1, 2, 3],
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
  {
    type: "IPv6 Address",
    severity: "low",
    optional: "ip",
    // Require a full 8-group form or "::" compression so colon-separated
    // numbers like a "12:34:56" timestamp aren't mistaken for an address.
    regex:
      /(?<![\w:])(?:(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}|(?:[A-Fa-f0-9]{1,4}:){1,6}:[A-Fa-f0-9]{1,4}|(?:[A-Fa-f0-9]{1,4}:){1,5}(?::[A-Fa-f0-9]{1,4}){1,2}|(?:[A-Fa-f0-9]{1,4}:){1,4}(?::[A-Fa-f0-9]{1,4}){1,3}|(?:[A-Fa-f0-9]{1,4}:){1,3}(?::[A-Fa-f0-9]{1,4}){1,4}|(?:[A-Fa-f0-9]{1,4}:){1,2}(?::[A-Fa-f0-9]{1,4}){1,5}|[A-Fa-f0-9]{1,4}:(?::[A-Fa-f0-9]{1,4}){1,6}|::(?:[A-Fa-f0-9]{1,4}:){0,6}[A-Fa-f0-9]{1,4}|(?:[A-Fa-f0-9]{1,4}:){1,7}:)(?![\w:])/g,
  },
  {
    type: "Domain",
    severity: "low",
    optional: "domain",
    // Hostnames with a known multi-label shape; excludes bare words.
    regex:
      /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|ai|dev|cn|co|app|cloud|internal|local|svc)\b/gi,
  },
];
