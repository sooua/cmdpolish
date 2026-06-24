import type { FormatResult, Language } from "../types";
import { normalizeHeredocTerminators } from "../format/heredoc";
import { aiComplete, aiCompleteStream } from "./client";
import { buildFormatPrompt, stripFence } from "./prompts";
import type { AiCompleteOptions, AiProvider, AiTask } from "./types";

/**
 * Pick an output-token budget for a reformat. The output is roughly the size of
 * the input, so we scale with it (≈3 chars/token, +25% headroom) and clamp to a
 * model-safe ceiling: Claude allows large single responses, while most
 * OpenAI-compatible models (DeepSeek, Qwen, …) cap output around 8K. A request
 * above the model's real limit would 400, so we stay conservative per kind.
 */
function formatMaxTokens(text: string, provider: AiProvider): number {
  // CJK text is ~1 token/char, Latin ~3 chars/token. Estimate per-character so
  // Chinese-heavy input doesn't under-budget and truncate.
  const cjk = (text.match(/[㐀-鿿豈-﫿぀-ヿ]/g) ?? []).length;
  const rest = text.length - cjk;
  const estimate = Math.ceil((cjk + rest / 3) * 1.3);
  const ceiling = provider.kind === "anthropic" ? 32768 : 8192;
  return Math.min(Math.max(estimate, 4096), ceiling);
}

export type { AiProvider, AiTask, ProviderKind, AiErrorKind } from "./types";
export { AiError } from "./types";
export {
  PROVIDER_PRESETS,
  presetById,
  isLocalEndpoint,
  DEFAULT_PROVIDER_KEYS,
} from "./presets";
export { AI_TASKS } from "./prompts";
export { aiComplete, aiCompleteStream, aiPrewarm } from "./client";
export { stripFence } from "./prompts";

/**
 * Format via AI. Returns a FormatResult shaped like the rule formatters so the
 * store can treat both paths uniformly. Throws on transport/provider errors so
 * the caller can fall back to the local rule formatter.
 */
export async function aiFormat(
  text: string,
  language: Language,
  provider: AiProvider
): Promise<FormatResult> {
  const out = normalizeHeredocTerminators(
    stripFence(
      await aiComplete(provider, buildFormatPrompt(text, language), {
        maxTokens: formatMaxTokens(text, provider),
      })
    )
  );
  return {
    text: out,
    language,
    warnings: [],
    changed: out !== text,
  };
}

/**
 * Streaming format. Calls `onText(partial)` as the model emits tokens so the UI
 * can render output live, then resolves with the final fence-stripped result.
 */
export async function aiFormatStream(
  text: string,
  language: Language,
  provider: AiProvider,
  onText: (partial: string) => void,
  opts: AiCompleteOptions = {}
): Promise<FormatResult> {
  const { text: full, truncated } = await aiCompleteStream(
    provider,
    buildFormatPrompt(text, language),
    (_delta, acc) => onText(acc),
    { ...opts, maxTokens: formatMaxTokens(text, provider) }
  );
  const out = normalizeHeredocTerminators(stripFence(full));
  return { text: out, language, warnings: [], changed: out !== text, truncated };
}

/** Run an arbitrary AI task, returning raw text (caller decides where it goes). */
export async function runAiTask(
  task: AiTask,
  text: string,
  language: Language,
  provider: AiProvider,
  opts: AiCompleteOptions = {}
): Promise<string> {
  const raw = await aiComplete(provider, task.build(text, language), opts);
  return task.output === "code" ? stripFence(raw) : raw.trim();
}
