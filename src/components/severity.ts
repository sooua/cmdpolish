import type { Severity } from "../engine/types";

// Light-theme functional status tints: subtle tinted surface + readable ink,
// in the spirit of Vercel's pill badges. Status colour is functional, not decor.
export const SEVERITY_COLOR: Record<Severity, string> = {
  low: "text-[var(--color-fg-secondary)] bg-[var(--color-surface-2)] shadow-[var(--shadow-border)]",
  medium: "text-[var(--color-warn-med)] bg-[var(--color-warn-med-pale)] shadow-[inset_0_0_0_1px_var(--color-warn-med-border)]",
  high: "text-[var(--color-warn)] bg-[var(--color-warn-pale)] shadow-[inset_0_0_0_1px_var(--color-warn-border)]",
  critical: "text-[var(--color-danger-strong)] bg-[var(--color-danger-pale)] shadow-[inset_0_0_0_1px_var(--color-danger-border)]",
};

export const SEVERITY_DOT: Record<Severity, string> = {
  low: "bg-[var(--color-faint)]",
  medium: "bg-[var(--color-warn-med-dot)]",
  high: "bg-[var(--color-warn-dot)]",
  critical: "bg-[var(--color-danger-dot)]",
};
