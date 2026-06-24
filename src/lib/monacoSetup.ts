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

// Dark counterpart — mirrors the dark canvas tokens in globals.css.
monaco.editor.defineTheme("cmdpolish-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "ededed" },
    { token: "comment", foreground: "6e6e6e", fontStyle: "italic" },
    { token: "string", foreground: "6fb1ff" },
    { token: "number", foreground: "c084fc" },
    { token: "keyword", foreground: "ff67a3" },
    { token: "type", foreground: "6fb1ff" },
    { token: "delimiter", foreground: "b4b4b4" },
    { token: "variable", foreground: "ededed" },
  ],
  colors: {
    "editor.background": "#0a0a0a",
    "editor.foreground": "#ededed",
    "editorLineNumber.foreground": "#3a3a3a",
    "editorLineNumber.activeForeground": "#b4b4b4",
    "editor.selectionBackground": "#1e3a5f",
    "editor.inactiveSelectionBackground": "#1a1a1a",
    "editorCursor.foreground": "#ededed",
    "editor.lineHighlightBackground": "#141414",
    "editorIndentGuide.background1": "#262626",
    "editorWidget.background": "#0f0f0f",
    "editorWidget.border": "#2a2a2a",
    "scrollbarSlider.background": "#2e2e2e",
    "scrollbarSlider.hoverBackground": "#3a3a3a",
    "scrollbarSlider.activeBackground": "#4a4a4a",
    "scrollbar.shadow": "#0a0a0a",
  },
});

loader.config({ monaco });
