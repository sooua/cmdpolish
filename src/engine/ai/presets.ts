import type { AiProvider } from "./types";

/**
 * Provider presets. baseUrl/model are sensible defaults the user can override;
 * apiKey is filled in by the user. `local` providers are safe to receive
 * un-redacted secrets because nothing leaves the machine.
 */
export const PROVIDER_PRESETS: Omit<AiProvider, "apiKey">[] = [
  {
    id: "ark",
    label: "火山方舟 Ark (豆包 Coding)",
    kind: "openai",
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
    model: "ark-code-latest",
    local: false,
    disableThinking: true,
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-6",
    local: false,
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    local: false,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    local: false,
  },
  {
    id: "qwen",
    label: "通义千问 (Qwen / DashScope)",
    kind: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    local: false,
  },
  {
    id: "ollama",
    label: "Ollama (本地)",
    kind: "openai",
    baseUrl: "http://localhost:11434/v1",
    model: "qwen2.5-coder",
    local: true,
  },
  {
    id: "lmstudio",
    label: "LM Studio (本地)",
    kind: "openai",
    baseUrl: "http://localhost:1234/v1",
    model: "local-model",
    local: true,
  },
  {
    id: "custom",
    label: "自定义 (OpenAI 兼容)",
    kind: "openai",
    baseUrl: "",
    model: "",
    local: false,
  },
];

export function presetById(id: string): Omit<AiProvider, "apiKey"> | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id);
}

/**
 * Optional per-provider default API keys seeded on first run. Intentionally
 * empty in source — never commit real keys. Keys live only in the user's local
 * settings (localStorage); enter them in Settings → AI.
 */
export const DEFAULT_PROVIDER_KEYS: Record<string, string> = {};

/** Heuristic: treat localhost / 127.0.0.1 endpoints as local (no leak risk). */
export function isLocalEndpoint(baseUrl: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(baseUrl);
}
