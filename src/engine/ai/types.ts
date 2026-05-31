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
};

export type AiMessage = {
  system: string;
  user: string;
};

export type AiCompleteOptions = {
  maxTokens?: number;
  temperature?: number;
};

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
