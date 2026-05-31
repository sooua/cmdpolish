# Product

## Register

product

## Users
Engineers, DevOps/SRE, security staff, and pre-sales/delivery people. They copy a
messy command / code / config / log from ChatGPT, a terminal, a webpage, IM
(WeChat/Feishu/DingTalk), or email, and need it cleaned up fast — often mid-incident
or while writing a runbook/delivery doc. Desktop, keyboard-heavy, frequently bilingual
(English/Chinese).

## Product Purpose
CmdPolish turns a pasted blob into clean, runnable, deliverable, Markdown-ready output:
paste → AI-format → redact secrets → review danger → copy. Formatting is AI-driven
(streaming, multi-provider). Redaction and dangerous-command review are local rules
(security-critical, never sent to a model before masking). Success = the user trusts
the output enough to paste it straight into a terminal, a doc, or a customer handoff.

## Brand Personality
Precise, restrained, engineered. Three words: exact, quiet, fast. The interface should
feel like good infrastructure — invisible until needed, then instantly legible. It
earns trust through craft and honesty (it tells you when a rollback can't be trusted),
not through decoration or persuasion.

## Anti-references
- Generic SaaS dashboards (gradient hero metric cards, rounded pastel everything).
- Heavy "AI app" chrome (purple gradients, sparkle confetti, chat-bubble maximalism).
- Cluttered IDE settings sprawl. Toy-like skeuomorphic toggles and bouncy motion.
- Dark-by-default "developer tool cool". This one is intentionally light.

## Design Principles
- **Every pixel earns its place.** Gallery emptiness over density; structure over decoration.
- **Shadow-as-border.** Depth and separation come from layered 1px shadows, not heavy lines or cards.
- **Honest over impressive.** Surface caveats (cloud-secret warnings, unreliable rollbacks) plainly; never hide a risk to look clean.
- **Keyboard-first, low-latency.** Streaming feedback, instant micro-interactions, configurable shortcuts.
- **Security is local, formatting is AI.** Keep that boundary visible and trustworthy.

## Accessibility & Inclusion
- WCAG AA: body text ≥4.5:1 on white (#171717 ink), large/secondary ≥3:1.
- Full keyboard operability; visible focus rings (Vercel focus blue).
- `prefers-reduced-motion`: every entrance/transition has a no-motion fallback.
- Bilingual EN/ZH UI; functional status color paired with icon + text (not color alone).
