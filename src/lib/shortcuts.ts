// Keyboard shortcut model. Combos are stored platform-neutrally with "Mod"
// (Ctrl on Windows/Linux, Cmd on macOS), e.g. "Mod+Shift+M".

export type ShortcutAction =
  | "format"
  | "redact"
  | "copy"
  | "copyMarkdown"
  | "clear"
  | "settings"
  | "history";

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  "format",
  "redact",
  "copy",
  "copyMarkdown",
  "clear",
  "settings",
  "history",
];

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  format: "Mod+Enter",
  redact: "Mod+Shift+R",
  copy: "Mod+Shift+C",
  copyMarkdown: "Mod+Shift+M",
  clear: "Mod+Shift+K",
  settings: "Mod+,",
  history: "Mod+Shift+H",
};

const IS_MAC =
  typeof navigator !== "undefined" &&
  navigator.platform.toLowerCase().includes("mac");

/** Build a normalized combo string from a keyboard event, or null if invalid. */
export function comboFromEvent(e: KeyboardEvent): string | null {
  const key = e.key;
  if (key === "Control" || key === "Meta" || key === "Shift" || key === "Alt")
    return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Mod");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  let k = key.length === 1 ? key.toUpperCase() : key;
  if (k === " ") k = "Space";
  parts.push(k);
  return parts.join("+");
}

/** Does the event match a stored combo? */
export function matchCombo(e: KeyboardEvent, combo: string): boolean {
  return comboFromEvent(e) === combo;
}

/** A combo is only usable if it includes the Mod key (avoids typing clashes). */
export function isValidCombo(combo: string | null): combo is string {
  return !!combo && combo.startsWith("Mod+");
}

/** Human-readable, platform-aware rendering of a combo. */
export function formatCombo(combo: string): string {
  return combo
    .split("+")
    .map((p) => {
      if (p === "Mod") return IS_MAC ? "⌘" : "Ctrl";
      if (p === "Shift") return IS_MAC ? "⇧" : "Shift";
      if (p === "Alt") return IS_MAC ? "⌥" : "Alt";
      return p;
    })
    .join(IS_MAC ? "" : "+");
}
