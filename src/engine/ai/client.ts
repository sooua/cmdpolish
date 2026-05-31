import type { AiCompleteOptions, AiMessage, AiProvider } from "./types";

/** Detect the Tauri runtime (vs. plain browser dev). */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Run a completion. In Tauri we go through the Rust `ai_complete` command
 * (no CORS, key stays native). In the browser we fall back to a direct fetch,
 * which works for local providers (Ollama/LM Studio) and any endpoint that
 * sends permissive CORS headers.
 */
export async function aiComplete(
  provider: AiProvider,
  message: AiMessage,
  opts: AiCompleteOptions = {}
): Promise<string> {
  if (!provider.baseUrl || !provider.model) {
    throw new Error("AI provider is not configured (missing base URL or model).");
  }

  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const res = await invoke<{ text: string }>("ai_complete", {
      req: {
        kind: provider.kind,
        baseUrl: provider.baseUrl,
        model: provider.model,
        apiKey: provider.apiKey,
        system: message.system,
        user: message.user,
        maxTokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0,
        disableThinking: provider.disableThinking ?? false,
      },
    });
    return res.text;
  }

  return browserComplete(provider, message, opts);
}

type StreamEvent =
  | { event: "Chunk"; data: string }
  | { event: "Done" }
  | { event: "Error"; data: string };

/**
 * Streaming completion. `onChunk(delta, full)` is called as tokens arrive.
 * Resolves with the full accumulated text. In Tauri this uses a Rust IPC
 * Channel; in the browser it parses the SSE response directly (local providers).
 */
export async function aiCompleteStream(
  provider: AiProvider,
  message: AiMessage,
  onChunk: (delta: string, full: string) => void,
  opts: AiCompleteOptions = {}
): Promise<string> {
  if (!provider.baseUrl || !provider.model) {
    throw new Error("AI provider is not configured (missing base URL or model).");
  }

  let full = "";

  if (isTauri()) {
    const { invoke, Channel } = await import("@tauri-apps/api/core");
    const channel = new Channel<StreamEvent>();
    let settle: (() => void) | null = null;
    let failure: ((e: Error) => void) | null = null;
    const done = new Promise<void>((resolve, reject) => {
      settle = resolve;
      failure = reject;
    });
    channel.onmessage = (msg) => {
      if (msg.event === "Chunk") {
        full += msg.data;
        onChunk(msg.data, full);
      } else if (msg.event === "Done") {
        settle?.();
      } else if (msg.event === "Error") {
        failure?.(new Error(msg.data));
      }
    };
    await invoke("ai_complete_stream", {
      req: {
        kind: provider.kind,
        baseUrl: provider.baseUrl,
        model: provider.model,
        apiKey: provider.apiKey,
        system: message.system,
        user: message.user,
        maxTokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0,
        disableThinking: provider.disableThinking ?? false,
      },
      onEvent: channel,
    });
    await done;
    return full;
  }

  // Browser SSE fallback (works for local Ollama / permissive-CORS endpoints).
  const base = provider.baseUrl.replace(/\/+$/, "");
  const isAnthropic = provider.kind === "anthropic";
  const res = await fetch(
    isAnthropic ? `${base}/v1/messages` : `${base}/chat/completions`,
    {
      method: "POST",
      headers: isAnthropic
        ? {
            "content-type": "application/json",
            "x-api-key": provider.apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          }
        : {
            "content-type": "application/json",
            ...(provider.apiKey
              ? { authorization: `Bearer ${provider.apiKey}` }
              : {}),
          },
      body: JSON.stringify(
        isAnthropic
          ? {
              model: provider.model,
              max_tokens: opts.maxTokens ?? 4096,
              temperature: opts.temperature ?? 0,
              stream: true,
              system: message.system,
              messages: [{ role: "user", content: message.user }],
            }
          : {
              model: provider.model,
              temperature: opts.temperature ?? 0,
              stream: true,
              ...(provider.disableThinking
                ? { thinking: { type: "disabled" } }
                : {}),
              messages: [
                { role: "system", content: message.system },
                { role: "user", content: message.user },
              ],
            }
      ),
    }
  );
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return full;
      try {
        const json = JSON.parse(payload);
        const delta = isAnthropic
          ? json?.delta?.text
          : json?.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onChunk(delta, full);
        }
      } catch {
        /* ignore keep-alive / non-JSON lines */
      }
    }
  }
  return full;
}

/**
 * Pre-warm the pooled TLS connection to the provider (Tauri only, no-op in the
 * browser). Best-effort and fire-and-forget — failures are ignored.
 */
export async function aiPrewarm(provider: AiProvider): Promise<void> {
  if (!isTauri() || !provider.baseUrl) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("ai_prewarm", { baseUrl: provider.baseUrl });
  } catch {
    /* ignore — warming is an optimization, not a requirement */
  }
}

async function browserComplete(
  provider: AiProvider,
  message: AiMessage,
  opts: AiCompleteOptions
): Promise<string> {
  const base = provider.baseUrl.replace(/\/+$/, "");
  if (provider.kind === "anthropic") {
    const res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0,
        system: message.system,
        messages: [{ role: "user", content: message.user }],
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
    return json?.content?.[0]?.text ?? "";
  }

  // OpenAI-compatible
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(provider.apiKey
        ? { authorization: `Bearer ${provider.apiKey}` }
        : {}),
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: opts.temperature ?? 0,
      stream: false,
      messages: [
        { role: "system", content: message.system },
        { role: "user", content: message.user },
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  return json?.choices?.[0]?.message?.content ?? "";
}
