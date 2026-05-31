// Wire @monaco-editor/react to the locally bundled monaco-editor instead of the
// default CDN loader, so CmdPolish works fully offline. Web workers are bundled
// by Vite via the ?worker imports.
import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";

import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

// Only JSON needs a dedicated language worker for the languages we use; the
// rest (shell, sql, yaml, ini, powershell, markdown) tokenize on the main
// thread via Monarch and only need the base editor worker.
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === "json") return new jsonWorker();
    return new editorWorker();
  },
};

// A light editor theme tuned to the Vercel/Geist canvas: pure-white background,
// #171717 ink, restrained syntax colours drawn from the Geist console palette.
monaco.editor.defineTheme("cmdpolish-light", {
  base: "vs",
  inherit: true,
  rules: [
    { token: "", foreground: "171717" },
    { token: "comment", foreground: "808080", fontStyle: "italic" },
    { token: "string", foreground: "0070f3" },
    { token: "number", foreground: "7928ca" },
    { token: "keyword", foreground: "eb367f" },
    { token: "type", foreground: "0070f3" },
    { token: "delimiter", foreground: "4d4d4d" },
    { token: "variable", foreground: "171717" },
  ],
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#171717",
    "editorLineNumber.foreground": "#c7c7c7",
    "editorLineNumber.activeForeground": "#4d4d4d",
    "editor.selectionBackground": "#ebf5ff",
    "editor.inactiveSelectionBackground": "#f1f1f1",
    "editorCursor.foreground": "#171717",
    "editor.lineHighlightBackground": "#fafafa",
    "editorIndentGuide.background1": "#ebebeb",
    "editorWidget.background": "#ffffff",
    "editorWidget.border": "#ebebeb",
    // Solid (non-transparent) scrollbar slider.
    "scrollbarSlider.background": "#dcdcdc",
    "scrollbarSlider.hoverBackground": "#c2c2c2",
    "scrollbarSlider.activeBackground": "#a8a8a8",
    "scrollbar.shadow": "#ffffff",
  },
});

loader.config({ monaco });
