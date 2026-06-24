// AI completion bridge. Runs the actual HTTP call from Rust so the frontend
// avoids browser CORS limits and the API key never has to live in the webview's
// network layer. Two wire protocols are supported, which together cover every
// provider CmdPolish targets:
//   - "openai"    → POST {base}/chat/completions  (OpenAI, DeepSeek, Qwen,
//                    Ollama, LM Studio, and any OpenAI-compatible endpoint)
//   - "anthropic" → POST {base}/v1/messages       (Claude)

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::ipc::Channel;
use tokio_util::sync::CancellationToken;

/// Registry of in-flight requests keyed by a frontend-supplied id, so a later
/// `ai_cancel(id)` can abort the actual HTTP request (not just unblock the UI).
static CANCELS: OnceLock<Mutex<HashMap<String, CancellationToken>>> = OnceLock::new();

fn cancels() -> &'static Mutex<HashMap<String, CancellationToken>> {
    CANCELS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Register a cancellation token for `id` (no-op for an empty id) and return it.
fn register(id: &str) -> CancellationToken {
    let token = CancellationToken::new();
    if !id.is_empty() {
        cancels().lock().unwrap().insert(id.to_string(), token.clone());
    }
    token
}

fn unregister(id: &str) {
    if !id.is_empty() {
        cancels().lock().unwrap().remove(id);
    }
}

/// Cancel an in-flight `ai_complete`/`ai_complete_stream` by its request id.
/// Dropping the request future aborts the underlying connection.
#[tauri::command]
pub fn ai_cancel(id: String) {
    if let Some(token) = cancels().lock().unwrap().remove(&id) {
        token.cancel();
    }
}

/// Shared HTTP client. Reusing one client keeps the TCP+TLS connection to the
/// provider warm across requests (connection pooling / keep-alive), so only the
/// first call pays the handshake cost. Per-request timeouts are set on the
/// request builder instead of globally.
static HTTP: OnceLock<reqwest::Client> = OnceLock::new();

fn http() -> &'static reqwest::Client {
    HTTP.get_or_init(|| {
        reqwest::Client::builder()
            .tcp_nodelay(true)
            .pool_idle_timeout(Duration::from_secs(300))
            .pool_max_idle_per_host(8)
            .build()
            .expect("failed to build HTTP client")
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRequest {
    /// "openai" | "anthropic"
    pub kind: String,
    pub base_url: String,
    pub model: String,
    #[serde(default)]
    pub api_key: String,
    pub system: String,
    pub user: String,
    /// Opaque id used to cancel this request via `ai_cancel`. Empty = no cancel.
    #[serde(default)]
    pub request_id: String,
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    #[serde(default)]
    pub temperature: f32,
    /// Disable server-side reasoning (Volcano Ark / doubao reasoning models).
    #[serde(default)]
    pub disable_thinking: bool,
}

fn default_max_tokens() -> u32 {
    4096
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiResponse {
    pub text: String,
    /// True when the model stopped because it hit `max_tokens` (output cut off).
    pub truncated: bool,
}

/// Read the stop/finish reason from a full (non-streaming) completion and decide
/// whether the output was cut off by the token limit.
fn is_truncated(kind: &str, json: &serde_json::Value) -> bool {
    let reason = if kind == "anthropic" {
        json.get("stop_reason").and_then(|s| s.as_str())
    } else {
        json.get("choices")
            .and_then(|c| c.get(0))
            .and_then(|c| c.get("finish_reason"))
            .and_then(|s| s.as_str())
    };
    matches!(reason, Some("length") | Some("max_tokens"))
}

fn trim_base(base: &str) -> String {
    base.trim_end_matches('/').to_string()
}

#[tauri::command]
pub async fn ai_complete(req: AiRequest) -> Result<AiResponse, String> {
    let id = req.request_id.clone();
    let token = register(&id);
    // Dropping `work` when the token fires aborts the in-flight request.
    let result = token
        .run_until_cancelled(ai_complete_inner(req))
        .await
        .unwrap_or_else(|| Err("cancelled".to_string()));
    unregister(&id);
    result
}

async fn ai_complete_inner(req: AiRequest) -> Result<AiResponse, String> {
    let client = http();
    let base = trim_base(&req.base_url);

    let (url, body, builder_headers): (String, serde_json::Value, Vec<(String, String)>) =
        match req.kind.as_str() {
            "anthropic" => {
                let url = format!("{base}/v1/messages");
                let body = serde_json::json!({
                    "model": req.model,
                    "max_tokens": req.max_tokens,
                    "temperature": req.temperature,
                    "system": req.system,
                    "messages": [{ "role": "user", "content": req.user }],
                });
                let headers = vec![
                    ("x-api-key".to_string(), req.api_key.clone()),
                    ("anthropic-version".to_string(), "2023-06-01".to_string()),
                ];
                (url, body, headers)
            }
            _ => {
                // OpenAI-compatible (default).
                let url = format!("{base}/chat/completions");
                let mut body = serde_json::json!({
                    "model": req.model,
                    "max_tokens": req.max_tokens,
                    "temperature": req.temperature,
                    "stream": false,
                    "messages": [
                        { "role": "system", "content": req.system },
                        { "role": "user", "content": req.user },
                    ],
                });
                if req.disable_thinking {
                    body["thinking"] = serde_json::json!({ "type": "disabled" });
                }
                let mut headers = vec![];
                if !req.api_key.is_empty() {
                    headers.push((
                        "Authorization".to_string(),
                        format!("Bearer {}", req.api_key),
                    ));
                }
                (url, body, headers)
            }
        };

    let mut rb = client
        .post(&url)
        .timeout(Duration::from_secs(120))
        .json(&body);
    for (k, v) in builder_headers {
        rb = rb.header(k, v);
    }

    let resp = rb
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("read body failed: {e}"))?;

    if !status.is_success() {
        return Err(format!("provider returned {status}: {text}"));
    }

    let json: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("invalid JSON from provider: {e}"))?;

    let content = if req.kind == "anthropic" {
        json.get("content")
            .and_then(|c| c.get(0))
            .and_then(|b| b.get("text"))
            .and_then(|t| t.as_str())
            .map(|s| s.to_string())
    } else {
        json.get("choices")
            .and_then(|c| c.get(0))
            .and_then(|c| c.get("message"))
            .and_then(|m| m.get("content"))
            .and_then(|t| t.as_str())
            .map(|s| s.to_string())
    };

    match content {
        Some(s) => Ok(AiResponse {
            text: s,
            truncated: is_truncated(&req.kind, &json),
        }),
        None => Err(format!("could not parse completion from response: {text}")),
    }
}

/// Best-effort: open a pooled TLS connection to the provider host so the first
/// real completion skips the TCP+TLS handshake. Costs no tokens — we ignore the
/// response entirely and only care that the connection is now warm in the pool.
#[tauri::command]
pub async fn ai_prewarm(base_url: String) -> Result<(), String> {
    let base = trim_base(&base_url);
    let _ = http()
        .get(&base)
        .timeout(Duration::from_secs(10))
        .send()
        .await;
    Ok(())
}

// ---- Streaming ----

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum StreamEvent {
    Chunk(String),
    /// Stream finished. `truncated` is true when the model hit `max_tokens`.
    Done { truncated: bool },
    Error(String),
}

/// Build the request body for a streaming completion.
fn stream_body(req: &AiRequest) -> (String, serde_json::Value, Vec<(String, String)>) {
    let base = trim_base(&req.base_url);
    if req.kind == "anthropic" {
        let url = format!("{base}/v1/messages");
        let body = serde_json::json!({
            "model": req.model,
            "max_tokens": req.max_tokens,
            "temperature": req.temperature,
            "stream": true,
            "system": req.system,
            "messages": [{ "role": "user", "content": req.user }],
        });
        let headers = vec![
            ("x-api-key".to_string(), req.api_key.clone()),
            ("anthropic-version".to_string(), "2023-06-01".to_string()),
        ];
        (url, body, headers)
    } else {
        let url = format!("{base}/chat/completions");
        let mut body = serde_json::json!({
            "model": req.model,
            "max_tokens": req.max_tokens,
            "temperature": req.temperature,
            "stream": true,
            "messages": [
                { "role": "system", "content": req.system },
                { "role": "user", "content": req.user },
            ],
        });
        if req.disable_thinking {
            body["thinking"] = serde_json::json!({ "type": "disabled" });
        }
        let mut headers = vec![];
        if !req.api_key.is_empty() {
            headers.push((
                "Authorization".to_string(),
                format!("Bearer {}", req.api_key),
            ));
        }
        (url, body, headers)
    }
}

/// Extract the incremental text delta from one SSE `data:` JSON payload.
fn extract_delta(kind: &str, json: &serde_json::Value) -> Option<String> {
    let text = if kind == "anthropic" {
        json.get("delta")
            .and_then(|d| d.get("text"))
            .and_then(|t| t.as_str())
    } else {
        json.get("choices")
            .and_then(|c| c.get(0))
            .and_then(|c| c.get("delta"))
            .and_then(|d| d.get("content"))
            .and_then(|t| t.as_str())
    };
    text.filter(|s| !s.is_empty()).map(|s| s.to_string())
}

/// Detect a max-tokens stop in one streaming SSE payload. OpenAI puts the reason
/// on `choices[0].finish_reason`; Anthropic emits it on the `message_delta`
/// event's `delta.stop_reason`.
fn stream_truncated(kind: &str, json: &serde_json::Value) -> bool {
    let reason = if kind == "anthropic" {
        json.get("delta")
            .and_then(|d| d.get("stop_reason"))
            .and_then(|s| s.as_str())
    } else {
        json.get("choices")
            .and_then(|c| c.get(0))
            .and_then(|c| c.get("finish_reason"))
            .and_then(|s| s.as_str())
    };
    matches!(reason, Some("length") | Some("max_tokens"))
}

#[tauri::command]
pub async fn ai_complete_stream(
    req: AiRequest,
    on_event: Channel<StreamEvent>,
) -> Result<(), String> {
    let id = req.request_id.clone();
    let token = register(&id);
    // None => cancelled mid-stream; the request future is dropped (connection
    // aborted). The frontend has already unblocked its UI on the same signal.
    let result = token
        .run_until_cancelled(ai_complete_stream_inner(req, on_event))
        .await
        .unwrap_or(Ok(()));
    unregister(&id);
    result
}

async fn ai_complete_stream_inner(
    req: AiRequest,
    on_event: Channel<StreamEvent>,
) -> Result<(), String> {
    let client = http();
    let (url, body, headers) = stream_body(&req);
    // Long read timeout for slow models; the connection itself is pooled.
    let mut rb = client
        .post(&url)
        .timeout(Duration::from_secs(300))
        .json(&body);
    for (k, v) in headers {
        rb = rb.header(k, v);
    }

    let resp = rb.send().await.map_err(|e| format!("request failed: {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        let msg = format!("provider returned {status}: {text}");
        let _ = on_event.send(StreamEvent::Error(msg.clone()));
        return Err(msg);
    }

    let mut stream = resp.bytes_stream();
    let mut buf = String::new();
    let mut truncated = false;

    while let Some(item) = stream.next().await {
        let bytes = item.map_err(|e| format!("stream error: {e}"))?;
        buf.push_str(&String::from_utf8_lossy(&bytes));

        // Process complete lines; keep the trailing partial line in `buf`.
        while let Some(idx) = buf.find('\n') {
            let line = buf[..idx].trim().to_string();
            buf.drain(..=idx);
            if line.is_empty() {
                continue;
            }
            let Some(payload) = line.strip_prefix("data:") else {
                continue; // skip `event:` and other SSE fields
            };
            let payload = payload.trim();
            if payload == "[DONE]" {
                let _ = on_event.send(StreamEvent::Done { truncated });
                return Ok(());
            }
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(payload) {
                if stream_truncated(&req.kind, &json) {
                    truncated = true;
                }
                if let Some(delta) = extract_delta(&req.kind, &json) {
                    let _ = on_event.send(StreamEvent::Chunk(delta));
                }
            }
        }
    }

    let _ = on_event.send(StreamEvent::Done { truncated });
    Ok(())
}
