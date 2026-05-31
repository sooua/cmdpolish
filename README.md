# CmdPolish

> **Format. Redact. Review. Ship.**
> 格式化、脱敏、审查，一步到位。

CmdPolish is an offline desktop tool for engineers, DevOps, security and
pre-sales people. Paste a messy command / code / config / log copied from
ChatGPT, a terminal, a webpage, WeChat, Feishu, DingTalk or email, and turn it
into clean, runnable, deliverable, Markdown-ready output in one click.

```
Paste → auto-detect type → format → redact secrets → copy / copy as Markdown
```

Everything runs **locally and offline** — no backend, no telemetry, no AI
dependency.

## Features (MVP)

- **Two-pane editor** — raw input on the left, processed output on the right
  (Monaco editor, bundled locally).
- **Language auto-detection** — Bash, Docker / Docker Compose, PowerShell, SQL,
  JSON, YAML, `.env`, Markdown, curl, kubectl, plain text. Manual override too.
- **Formatters**
  - JSON — beautify / validate with error line reporting
  - SQL — multi-line, keyword-cased (PostgreSQL/MySQL friendly)
  - YAML — normalize indentation, keep comments
  - `.env` — group keys, detect duplicate keys / empty values
  - Shell / Docker — break long commands across lines with `\` continuations,
    preserve heredocs (e.g. `psql <<'SQL'`)
  - PowerShell — backtick continuations, pipeline wrapping
- **Redactor** — detects API keys (OpenAI, Anthropic, Stripe, GitHub, AWS,
  Resend, Slack, Google…), Bearer tokens, JWTs, DB connection strings, private
  keys, bcrypt hashes, `*_PASSWORD/SECRET/TOKEN` assignments and password flags.
  Four masking modes: preserve-ends, placeholder, hidden, delivery.
- **Guard (security review)** — flags dangerous shell (`rm -rf /`, fork bombs,
  `mkfs`, firewall flush…), Docker (`compose down -v`, volume rm, prune…),
  Kubernetes (`delete ns`, `delete all --all`…), `curl | bash`, and risky SQL
  (`DROP`, `TRUNCATE`, `DELETE`/`UPDATE` without `WHERE`).
- **Copy / Copy as Markdown** — wrap output in a fenced code block with the
  right language tag.
- **Templates** — Docker Compose exec, psql, heredoc SQL, curl POST, and more.
- **History** — every format result is auto-saved to a local **SQLite** database
  (via the Tauri SQL plugin; falls back to `localStorage` in the browser).
  Search, filter by language, restore to the editor, delete, or clear all.
  Snippets containing secrets are stored **redacted by default** (toggle in
  Settings).

## Tech stack

Tauri 2 · React 18 · TypeScript · Vite 6 · Tailwind CSS 4 · Monaco Editor ·
Zustand · Rust.

## Development

```bash
npm install

# Run the UI in the browser (fast iteration on the engine/UI):
npm run dev            # http://localhost:1420

# Run the full desktop app (requires the Rust toolchain + WebView2 on Windows):
npm run tauri:dev

# Type-check + production web build:
npm run build

# Build installers (.msi/.exe on Windows, .dmg on macOS, .deb/.AppImage on Linux):
npm run tauri:build
```

## Project layout

```
src/
  app/App.tsx              main two-pane layout + inspector tabs
  components/              EditorPane, Toolbar, LanguageSelector, RiskPanel,
                           RedactionPanel, TemplatesMenu, SettingsMenu
  engine/
    detect/                heuristic language detection
    formatters/            json, sql, yaml, env, shell/docker, powershell + router
    redactor/              secret patterns + masking
    guard/                 dangerous-command/SQL rules + review
    markdown/              fenced code-block wrapping
    templates.ts           built-in snippet templates
  store/useAppStore.ts     Zustand app state wiring the engine together
  lib/
    clipboard.ts           clipboard helper
    monacoSetup.ts         Monaco offline (local workers) setup
    history/               SQLite + localStorage history backends
src-tauri/                 Rust desktop shell (window + clipboard + SQL plugin,
                           snippets table migration)
```

## License

MIT (placeholder).
