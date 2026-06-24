import Editor from "@monaco-editor/react";
import type { Language } from "../engine/types";
import { useAppStore } from "../store/useAppStore";

const MONACO_LANG: Record<Language, string> = {
  bash: "shell",
  docker: "shell",
  "docker-compose": "shell",
  curl: "shell",
  kubectl: "shell",
  powershell: "powershell",
  sql: "sql",
  json: "json",
  yaml: "yaml",
  env: "ini",
  markdown: "markdown",
  "plain-text": "plaintext",
};

type Props = {
  value: string;
  language: Language;
  readOnly?: boolean;
  placeholder?: string;
  fontSize?: number;
  onChange?: (value: string) => void;
};

export function EditorPane({
  value,
  language,
  readOnly = false,
  fontSize = 13,
  onChange,
}: Props) {
  const resolvedTheme = useAppStore((s) => s.resolvedTheme);
  return (
    <Editor
      height="100%"
      theme={resolvedTheme === "dark" ? "cmdpolish-dark" : "cmdpolish-light"}
      language={MONACO_LANG[language] ?? "plaintext"}
      value={value}
      onChange={(v) => onChange?.(v ?? "")}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize,
        // Keep this chain in sync with `--font-mono` in globals.css so the
        // editor and the rest of the UI render the same monospace stack.
        fontFamily:
          '"Geist Mono Variable", ui-monospace, SFMono-Regular, "Roboto Mono", Menlo, Monaco, "Liberation Mono", "Courier New", monospace',
        fontLigatures: true,
        wordWrap: "on",
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        padding: { top: 12, bottom: 12 },
        renderLineHighlight: "none",
        automaticLayout: true,
        tabSize: 2,
        // Slider fades naturally when idle; the lane background stays opaque
        // (see the .scrollbar.vertical override in globals.css).
        scrollbar: {
          vertical: "auto",
          horizontal: "auto",
          verticalScrollbarSize: 11,
          horizontalScrollbarSize: 11,
          useShadows: false,
        },
      }}
    />
  );
}
