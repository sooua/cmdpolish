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

// A light editor theme tuned to the Claude parchment canvas: warm ivory
// background, near-black ink, restrained warm syntax colours (terracotta
// keywords, muted-green strings, plum numbers) — no cool blues.
monaco.editor.defineTheme("cmdpolish-light", {
  base: "vs",
  inherit: true,
  rules: [
    { token: "", foreground: "141413" },
    { token: "comment", foreground: "87867f", fontStyle: "italic" },
    { token: "string", foreground: "5f7a45" },
    { token: "number", foreground: "8a5a9e" },
    { token: "keyword", foreground: "c96442" },
    { token: "type", foreground: "a8512f" },
    { token: "delimiter", foreground: "5e5d59" },
    { token: "variable", foreground: "141413" },
  ],
  colors: {
    "editor.background": "#faf9f5",
    "editor.foreground": "#141413",
    "editorLineNumber.foreground": "#bdb9ac",
    "editorLineNumber.activeForeground": "#5e5d59",
    "editor.selectionBackground": "#f0e3da",
    "editor.inactiveSelectionBackground": "#efede3",
    "editorCursor.foreground": "#c96442",
    "editor.lineHighlightBackground": "#f3f1e8",
    "editorIndentGuide.background1": "#ece9df",
    "editorWidget.background": "#faf9f5",
    "editorWidget.border": "#e8e6dc",
    // Solid (non-transparent) scrollbar slider — warm grays.
    "scrollbarSlider.background": "#d4d0c4",
    "scrollbarSlider.hoverBackground": "#c0bcae",
    "scrollbarSlider.activeBackground": "#a8a399",
    "scrollbar.shadow": "#faf9f5",
  },
});

// Dark counterpart — mirrors Claude's warm Near Black canvas in globals.css.
monaco.editor.defineTheme("cmdpolish-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "f0eee6" },
    { token: "comment", foreground: "87867f", fontStyle: "italic" },
    { token: "string", foreground: "a3c489" },
    { token: "number", foreground: "b58fc4" },
    { token: "keyword", foreground: "d97757" },
    { token: "type", foreground: "e0936f" },
    { token: "delimiter", foreground: "a6a49b" },
    { token: "variable", foreground: "f0eee6" },
  ],
  colors: {
    "editor.background": "#141413",
    "editor.foreground": "#f0eee6",
    "editorLineNumber.foreground": "#45443f",
    "editorLineNumber.activeForeground": "#a6a49b",
    "editor.selectionBackground": "#3a2a1d",
    "editor.inactiveSelectionBackground": "#26241f",
    "editorCursor.foreground": "#d97757",
    "editor.lineHighlightBackground": "#1c1c1a",
    "editorIndentGuide.background1": "#2a2a27",
    "editorWidget.background": "#1c1c1a",
    "editorWidget.border": "#34332f",
    "scrollbarSlider.background": "#3a3935",
    "scrollbarSlider.hoverBackground": "#45443f",
    "scrollbarSlider.activeBackground": "#52514a",
    "scrollbar.shadow": "#141413",
  },
});

loader.config({ monaco });
