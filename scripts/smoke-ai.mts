// Verifies the AI client (browser path) shapes requests correctly for both
// protocols, parses responses, and that aiFormat strips code fences. Uses a
// mocked fetch — no network / API key needed.
import { stripFence } from "../src/engine/ai/prompts";
import { isLocalEndpoint, presetById } from "../src/engine/ai/presets";
import { aiComplete } from "../src/engine/ai/client";
import { aiFormat } from "../src/engine/ai";
import type { AiProvider } from "../src/engine/ai/types";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`, extra ?? "");
  }
}

// --- pure helpers ---
console.log("Helpers:");
check("stripFence removes fence", stripFence("```bash\necho hi\n```") === "echo hi");
check("stripFence passthrough", stripFence("plain text") === "plain text");
check("isLocalEndpoint localhost", isLocalEndpoint("http://localhost:11434/v1"));
check("isLocalEndpoint cloud false", !isLocalEndpoint("https://api.openai.com/v1"));
check("preset anthropic kind", presetById("anthropic")?.kind === "anthropic");
check("preset deepseek openai", presetById("deepseek")?.kind === "openai");

// --- mocked fetch to capture outgoing requests ---
type Captured = { url: string; body: any; headers: any };
let captured: Captured | null = null;

function mockFetch(response: any) {
  (globalThis as any).fetch = async (url: string, init: any) => {
    captured = {
      url,
      body: JSON.parse(init.body),
      headers: init.headers,
    };
    return {
      ok: true,
      status: 200,
      json: async () => response,
    };
  };
}
// Ensure the client takes the browser path (no Tauri).
delete (globalThis as any).window;

console.log("OpenAI-compatible request:");
const openai: AiProvider = {
  id: "openai",
  label: "OpenAI",
  kind: "openai",
  baseUrl: "https://api.example.com/v1",
  model: "gpt-test",
  apiKey: "sk-xyz",
  local: false,
};
mockFetch({ choices: [{ message: { content: "```json\n{\n  \"a\": 1\n}\n```" } }] });
const r1 = await aiComplete(openai, { system: "S", user: "U" });
check("openai url", captured?.url === "https://api.example.com/v1/chat/completions", captured?.url);
check("openai auth header", captured?.headers.authorization === "Bearer sk-xyz");
check("openai messages", captured?.body.messages?.[0]?.role === "system" && captured?.body.messages?.[1]?.content === "U");
check("openai parses content", r1.includes('"a": 1'));

console.log("Anthropic request:");
const claude: AiProvider = {
  id: "anthropic",
  label: "Claude",
  kind: "anthropic",
  baseUrl: "https://api.anthropic.com",
  model: "claude-test",
  apiKey: "ak-123",
  local: false,
};
mockFetch({ content: [{ type: "text", text: "hello" }] });
const r2 = await aiComplete(claude, { system: "Sys", user: "Usr" });
check("anthropic url", captured?.url === "https://api.anthropic.com/v1/messages", captured?.url);
check("anthropic x-api-key", captured?.headers["x-api-key"] === "ak-123");
check("anthropic version header", captured?.headers["anthropic-version"] === "2023-06-01");
check("anthropic system top-level", captured?.body.system === "Sys");
check("anthropic parses text", r2 === "hello");

console.log("aiFormat:");
mockFetch({ choices: [{ message: { content: "```sql\nSELECT 1;\n```" } }] });
const fr = await aiFormat("select 1;", "sql", openai);
check("aiFormat strips fence", fr.text === "SELECT 1;", fr.text);
check("aiFormat changed flag", fr.changed === true);

// --- streaming (browser SSE path) ---
const { aiCompleteStream } = await import("../src/engine/ai/client");

function sseStream(lines: string[]) {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const l of lines) controller.enqueue(enc.encode(l));
      controller.close();
    },
  });
}

console.log("Streaming (OpenAI SSE):");
(globalThis as any).fetch = async () => ({
  ok: true,
  status: 200,
  body: sseStream([
    'data: {"choices":[{"delta":{"content":"SE"}}]}\n',
    'data: {"choices":[{"delta":{"content":"LECT"}}]}\n',
    'data: {"choices":[{"delta":{"content":" 1;"}}]}\n',
    "data: [DONE]\n",
  ]),
  text: async () => "",
});
let streamed = "";
const sres = await aiCompleteStream(
  openai,
  { system: "S", user: "U" },
  (_d, full) => (streamed = full)
);
check("stream accumulates full", sres === "SELECT 1;", sres);
check("stream onChunk sees full", streamed === "SELECT 1;", streamed);

console.log("Streaming (chunk split across reads):");
(globalThis as any).fetch = async () => ({
  ok: true,
  status: 200,
  // a JSON line deliberately split across two stream reads
  body: sseStream([
    'data: {"choices":[{"delta":{"con',
    'tent":"ok"}}]}\n',
    "data: [DONE]\n",
  ]),
  text: async () => "",
});
const split = await aiCompleteStream(openai, { system: "S", user: "U" }, () => {});
check("stream handles split lines", split === "ok", split);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
