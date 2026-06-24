import type { AiMessage, AiTask } from "./types";

/** Strip a single surrounding Markdown code fence from a model response. */
export function stripFence(text: string): string {
  const trimmed = text.trim();
  // Tolerate an info string after the opening fence (e.g. ```bash title=x) and
  // trailing whitespace after the closing fence.
  const fence = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```\s*$/);
  if (fence) return fence[1];
  return trimmed;
}

const FORMAT_SYSTEM = `You are CmdPolish's formatter. Reformat the input into clean, copy-paste-ready form.
Rules: output ONLY the reformatted content — no explanation, no Markdown fences. Never change semantics (same flags/values/order). Preserve string literals, secrets, heredoc bodies and quoting exactly. If a shell command or one of its quoted arguments was accidentally split across lines — a hard line break with no trailing backslash that lands mid-argument or between arguments (e.g. a wrapped paste) — join it back into a single runnable line so it can be copy-pasted and executed; do not treat such a break as an intentional newline. Long shell/Docker/kubectl: break lines with trailing backslash, keep each flag with its value, indent 2 spaces, keep heredoc bodies intact but ALWAYS place the closing heredoc delimiter (e.g. EOF) at column 0 with no leading whitespace unless the opener uses the <<- form. SQL: uppercase keywords, one clause per line. JSON/YAML/.env: normalize indentation, keep key order and comments. If already clean, return unchanged.`;

/** Build the prompt for the primary Format action. */
export function buildFormatPrompt(text: string, language: string): AiMessage {
  return {
    system: FORMAT_SYSTEM,
    user: `Language: ${language}\n\nReformat the following:\n\n${text}`,
  };
}

const proseSystem = (role: string) =>
  `You are a senior DevOps/SRE assistant inside CmdPolish. ${role} Be concise and practical. Answer in the same language the user's content/comments use (default Chinese if mixed).`;

const codeSystem = (role: string) =>
  `You are CmdPolish's conversion engine. ${role} Output ONLY the resulting code/command, no explanation, no Markdown fences.`;

/** Built-in AI actions (v0.3 capabilities). */
export const AI_TASKS: AiTask[] = [
  {
    id: "explain",
    label: "解释这段命令",
    hint: "逐步说明它做什么、有什么影响",
    output: "prose",
    build: (text, language) => ({
      system: proseSystem("Explain what the given command/code does, step by step, and call out any side effects or risks."),
      user: `Language: ${language}\n\n${text}`,
    }),
  },
  {
    id: "rollback",
    label: "生成回滚命令",
    hint: "给出撤销/回滚操作",
    output: "code",
    build: (text, language) => ({
      system: codeSystem(
        "Produce the commands that safely undo/rollback the given operation. " +
          "ALWAYS begin the output with a one-line commented caveat in the snippet's comment syntax. " +
          "For DELETE/DROP/TRUNCATE or any operation whose original data/state is unknown, the caveat must warn that a true rollback requires a prior backup and the commands below are only a best-effort draft to review, not run blindly."
      ),
      user: `Language: ${language}\n\n${text}`,
    }),
  },
  {
    id: "precheck",
    label: "生成执行前检查",
    hint: "执行前应先验证的命令",
    output: "code",
    build: (text, language) => ({
      system: codeSystem("Produce the commands one should run BEFORE the given operation to verify it is safe (e.g. SELECT before UPDATE, backup before drop)."),
      user: `Language: ${language}\n\n${text}`,
    }),
  },
];
