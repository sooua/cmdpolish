import type { Language } from "../types";

/** Map internal language ids to Markdown fence info-strings. */
export function fenceLang(language: Language): string {
  switch (language) {
    case "docker":
    case "docker-compose":
    case "curl":
    case "kubectl":
      return "bash";
    case "env":
      return "env";
    case "plain-text":
      return "text";
    default:
      return language;
  }
}

/** Wrap content in a fenced code block, using enough backticks to be safe. */
export function wrapMarkdown(text: string, language: Language): string {
  const info = fenceLang(language);
  // If the body itself contains ``` we must use a longer fence.
  const longest = (text.match(/`+/g) ?? []).reduce(
    (m, run) => Math.max(m, run.length),
    0
  );
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${info}\n${text.replace(/\n$/, "")}\n${fence}`;
}

/** Wrap with a step heading, e.g. for delivery docs. */
export function wrapMarkdownStep(
  text: string,
  language: Language,
  title: string
): string {
  return `### ${title}\n\n${wrapMarkdown(text, language)}`;
}
