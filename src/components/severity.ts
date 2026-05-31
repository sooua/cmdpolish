import type { Severity } from "../engine/types";

// Light-theme functional status tints: subtle tinted surface + readable ink,
// in the spirit of Vercel's pill badges. Status colour is functional, not decor.
export const SEVERITY_COLOR: Record<Severity, string> = {
  low: "text-[#4d4d4d] bg-[#fafafa] shadow-[var(--shadow-border)]",
  medium: "text-[#92400e] bg-[#fffbeb] shadow-[inset_0_0_0_1px_#fde68a]",
  high: "text-[#9a3412] bg-[#fff7ed] shadow-[inset_0_0_0_1px_#fed7aa]",
  critical: "text-[#b91c1c] bg-[#fef2f2] shadow-[inset_0_0_0_1px_#fecaca]",
};

export const SEVERITY_DOT: Record<Severity, string> = {
  low: "bg-[#a3a3a3]",
  medium: "bg-[#f59e0b]",
  high: "bg-[#f97316]",
  critical: "bg-[#ef4444]",
};
