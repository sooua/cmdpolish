import type { AiCompleteOptions, AiMessage, AiProvider } from "./types";
import { AiError, classifyAiError } from "./types";

/** Detect the Tauri runtime (vs. plain browser dev). */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let reqCounter = 0;
/** Unique id for a native request so it can be cancelled via `ai_cancel`. */
function genRequestId(): string {
  return `req-${++reqCounter}-${Math.floor(performance.now())}`;
}

/** Best-effort native cancel — aborts the actual HTTP request in Rust. */
async function cancelNative(id: string): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("ai_cancel", { id });
  } catch {
    /* ignore — backend may have already finished */
  }
}

/** Map a raw error (Tauri string / fetch exception) to a categorized AiError. */
function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  if (/abort/i.test(msg)) return new AiError("aborted", "Request cancelled");
  if (/timed out|timeout/i.test(msg)) return new AiError("timeout", msg);
  // Rust returns strings like "provider returned 401: ...".
  const status = msg.match(/returned (\d{3})/)?.[1];
  if (status) return classifyAiError(Number(status), msg);
  if (/Failed to fetch|NetworkError|ECONNREFUSED|dns|connect/i.test(msg))
    return new AiError("network", msg);
  return new AiError("unknown", msg);
}

/**
 * A combined abort signal that fires on the caller's signal OR a timeout. Used
 * for the browser fetch path and to unblock the UI on the Tauri IPC path.
 * Returns the signal plus a `cleanup` to clear the timer.
 */
function withTimeout(
  signal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; cleanup: () => void; timedOut: () => boolean } {
  const ctrl = new AbortController();
  let timed = false;
  const onAbort = () => ctrl.abort();
  const timer = setTimeout(() => {
    timed = true;
    ctrl.abort();
  }, timeoutMs);
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    timedOut: () => timed,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
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
    const timeoutMs = opts.timeoutMs ?? 120_000;
    const requestId = genRequestId();
    // Race the native call against a timeout/abort. On either, we ALSO tell Rust
    // to cancel the real request via ai_cancel — true cancellation, not just a
    // detached background request.
    const gate = new Promise<never>((_, reject) => {
      const t = setTimeout(() => {
        cancelNative(requestId);
        reject(new AiError("timeout", "Request timed out"));
      }, timeoutMs);
      opts.signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          cancelNative(requestId);
          reject(new AiError("aborted", "Request cancelled"));
        },
        { once: true }
      );
    });
    const call = invoke<{ text: string }>("ai_complete", {
      req: {
        kind: provider.kind,
        baseUrl: provider.baseUrl,
        model: provider.model,
        apiKey: provider.apiKey,
        system: message.system,
        user: message.user,
        requestId,
        maxTokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0,
        disableThinking: provider.disableThinking ?? false,
      },
    }).then((r) => r.text, (e) => {
      throw toAiError(e);
    });
    return Promise.race([call, gate]);
  }

  return browserComplete(provider, message, opts);
}

type StreamEvent =
  | { event: "Chunk"; data: string }
  | { event: "Done"; data: { truncated: boolean } }
  | { event: "Error"; data: string };

/** Streaming completion result: the full text plus whether it was cut off. */
export type StreamResult = { text: string; truncated: boolean };

/**
 * Streaming completion. `onChunk(delta, full)` is called as tokens arrive.
 * Resolves with the full accumulated text and a `truncated` flag (true when the
 * model stopped at `max_tokens`). In Tauri this uses a Rust IPC Channel; in the
 * browser it parses the SSE response directly (local providers).
 */
export async function aiCompleteStream(
  provider: AiProvider,
  message: AiMessage,
  onChunk: (delta: string, full: string) => void,
  opts: AiCompleteOptions = {}
): Promise<StreamResult> {
  if (!provider.baseUrl || !provider.model) {
    throw new Error("AI provider is not configured (missing base URL or model).");
  }

  let full = "";
  let truncated = false;

  if (isTauri()) {
    const { invoke, Channel } = await import("@tauri-apps/api/core");
    const channel = new Channel<StreamEvent>();
    let cancelled = false;
    let settle: (() => void) | null = null;
    let failure: ((e: Error) => void) | null = null;
    const done = new Promise<void>((resolve, reject) => {
      settle = resolve;
      failure = reject;
    });
    // The native stream can't be cancelled across IPC, so on abort/timeout we
    // stop forwarding chunks and reject immediately to unblock the UI. Any late
    // events are dropped via the `cancelled` guard.
    const requestId = genRequestId();
    const timeoutMs = opts.timeoutMs ?? 300_000;
    const timer = setTimeout(() => {
      cancelled = true;
      cancelNative(requestId);
      failure?.(new AiError("timeout", "Request timed out"));
    }, timeoutMs);
    const onAbort = () => {
      cancelled = true;
      cancelNative(requestId);
      failure?.(new AiError("aborted", "Request cancelled"));
    };
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    channel.onmessage = (msg) => {
      if (cancelled) return;
      if (msg.event === "Chunk") {
        full += msg.data;
        onChunk(msg.data, full);
      } else if (msg.event === "Done") {
        truncated = msg.data?.truncated ?? false;
        settle?.();
      } else if (msg.event === "Error") {
        failure?.(toAiError(msg.data));
      }
    };
    try {
      const call = invoke("ai_complete_stream", {
        req: {
          kind: provider.kind,
          baseUrl: provider.baseUrl,
          model: provider.model,
          apiKey: provider.apiKey,
          system: message.system,
          user: message.user,
          requestId,
          maxTokens: opts.maxTokens ?? 4096,
          temperature: opts.temperature ?? 0,
          disableThinking: provider.disableThinking ?? false,
        },
        onEvent: channel,
      }).catch((e) => {
        if (!cancelled) failure?.(toAiError(e));
      });
      await Promise.race([done, call.then(() => done)]);
      return { text: full, truncated };
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    }
  }

  // Browser SSE fallback (works for local Ollama / permissive-CORS endpoints).
  const base = provider.baseUrl.replace(/\/+$/, "");
  const isAnthropic = provider.kind === "anthropic";
  const gate = withTimeout(opts.signal, opts.timeoutMs ?? 300_000);
  let res: Response;
  try {
    res = await fetch(
    isAnthropic ? `${base}/v1/messages` : `${base}/chat/completions`,
    {
      signal: gate.signal,
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
              max_tokens: opts.maxTokens ?? 4096,
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
  } catch (e) {
    gate.cleanup();
    if (gate.timedOut()) throw new AiError("timeout", "Request timed out");
    throw toAiError(e);
  }
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    gate.cleanup();
    throw classifyAiError(res.status, t);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
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
        if (payload === "[DONE]") return { text: full, truncated };
        try {
          const json = JSON.parse(payload);
          const reason = isAnthropic
            ? json?.delta?.stop_reason
            : json?.choices?.[0]?.finish_reason;
          if (reason === "length" || reason === "max_tokens") truncated = true;
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
  } catch (e) {
    if (gate.timedOut()) throw new AiError("timeout", "Request timed out");
    throw toAiError(e);
  } finally {
    gate.cleanup();
  }
  return { text: full, truncated };
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
  const isAnthropic = provider.kind === "anthropic";
  const gate = withTimeout(opts.signal, opts.timeoutMs ?? 120_000);
  let res: Response;
  try {
    res = await fetch(
      isAnthropic ? `${base}/v1/messages` : `${base}/chat/completions`,
      {
        signal: gate.signal,
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
                system: message.system,
                messages: [{ role: "user", content: message.user }],
              }
            : {
                model: provider.model,
                max_tokens: opts.maxTokens ?? 4096,
                temperature: opts.temperature ?? 0,
                stream: false,
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
  } catch (e) {
    if (gate.timedOut()) throw new AiError("timeout", "Request timed out");
    throw toAiError(e);
  } finally {
    gate.cleanup();
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw classifyAiError(res.status, json?.error?.message ?? `HTTP ${res.status}`);
  }
  return isAnthropic
    ? json?.content?.[0]?.text ?? ""
    : json?.choices?.[0]?.message?.content ?? "";
}
