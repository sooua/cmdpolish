import Editor from "@monaco-editor/react";
import type { Language } from "../engine/types";

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
  return (
    <Editor
      height="100%"
      theme="cmdpolish-light"
      language={MONACO_LANG[language] ?? "plaintext"}
      value={value}
      onChange={(v) => onChange?.(v ?? "")}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize,
        fontFamily:
          '"Geist Mono Variable", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
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
