// Shared engine types for CmdPolish.

export type Language =
  | "bash"
  | "docker"
  | "docker-compose"
  | "powershell"
  | "sql"
  | "json"
  | "yaml"
  | "env"
  | "markdown"
  | "curl"
  | "kubectl"
  | "plain-text";

export type DetectResult = {
  language: Language;
  confidence: number; // 0..1
  reason: string[];
};

export type FormatOptions = {
  indentSize?: number;
  lineWidth?: number;
  quoteStyle?: "single" | "double" | "preserve";
  markdownFence?: boolean;
};

export type FormatInput = {
  text: string;
  language: Language;
  options?: FormatOptions;
};

export type FormatResult = {
  text: string;
  language: Language;
  warnings: string[];
  changed: boolean;
  /** True when the model hit its output-token limit and the result is cut off. */
  truncated?: boolean;
};

export interface Formatter {
  id: string;
  name: string;
  /** Languages this formatter is responsible for. */
  languages: Language[];
  format(input: FormatInput): Promise<FormatResult>;
}

// ---- Redactor ----

export type Severity = "low" | "medium" | "high" | "critical";

export type RedactMode = "preserve-ends" | "placeholder" | "hidden" | "delivery";

export type RedactFinding = {
  type: string;
  value: string;
  start: number;
  end: number;
  severity: Severity;
  replacement: string;
};

export type RedactResult = {
  text: string;
  findings: RedactFinding[];
};

export type RedactSettings = {
  mode: RedactMode;
  redactEmail: boolean;
  redactIp: boolean;
  redactDomain: boolean;
};

// ---- Guard ----

export type GuardFinding = {
  ruleId: string;
  title: string;
  severity: Severity;
  message: string;
  suggestion?: string;
  line?: number;
};

export type GuardResult = {
  level: Severity | "none";
  findings: GuardFinding[];
};
