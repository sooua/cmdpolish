// AI provider configuration and task types.

export type ProviderKind = "openai" | "anthropic";

export type AiProvider = {
  /** Stable id, also used as the settings key. */
  id: string;
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string;
  /** True for localhost endpoints — safe to send secrets to. */
  local: boolean;
  /**
   * Disable server-side chain-of-thought for reasoning models (e.g. Volcano
   * Ark's ark-code-latest). Formatting needs no reasoning, and the long invisible
   * thinking phase blocks streaming. Sends `thinking: {type: "disabled"}`.
   */
  disableThinking?: boolean;
};

export type AiMessage = {
  system: string;
  user: string;
};

export type AiCompleteOptions = {
  maxTokens?: number;
  temperature?: number;
  /** Abort the request (user pressed Stop, or a newer request superseded it). */
  signal?: AbortSignal;
  /** Hard timeout in ms. Defaults to 120s (complete) / 300s (stream). */
  timeoutMs?: number;
};

/** Categorized AI transport error so the UI can show an actionable message. */
export type AiErrorKind =
  | "aborted"
  | "timeout"
  | "auth"
  | "rate-limit"
  | "network"
  | "provider"
  | "unknown";

export class AiError extends Error {
  kind: AiErrorKind;
  status?: number;
  constructor(kind: AiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "AiError";
    this.kind = kind;
    this.status = status;
  }
}

/** Map an HTTP status / raw message to a categorized AiError. */
export function classifyAiError(
  status: number | undefined,
  raw: string
): AiError {
  if (status === 401 || status === 403)
    return new AiError("auth", raw || "Authentication failed", status);
  if (status === 429)
    return new AiError("rate-limit", raw || "Rate limited", status);
  if (status && status >= 500)
    return new AiError("provider", raw || `Provider error ${status}`, status);
  if (status && status >= 400)
    return new AiError("provider", raw || `Request rejected (${status})`, status);
  return new AiError("unknown", raw || "Request failed", status);
}

/** A reusable AI action (explain / convert / generate …). */
export type AiTask = {
  id: string;
  label: string;
  /** Short description shown in the menu. */
  hint: string;
  /** Build the prompt from the current snippet + detected language. */
  build: (text: string, language: string) => AiMessage;
  /** Whether the result is a code block (goes to output) or prose (panel). */
  output: "code" | "prose";
};
