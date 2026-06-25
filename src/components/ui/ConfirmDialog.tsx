import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useConfirmStore } from "./confirm";
import { useT } from "../../i18n/useT";

/** Single host for themed confirm dialogs — render once near the app root. */
export function ConfirmDialog() {
  const { open, opts, respond } = useConfirmStore();
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") respond(false);
      if (e.key === "Enter") respond(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, respond]);

  if (!open || !opts) return null;

  const confirmLabel = opts.confirmLabel ?? t("common.confirm");
  const cancelLabel = opts.cancelLabel ?? t("common.cancel");

  return (
    <div className="animate-fade fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[var(--color-overlay)]" onClick={() => respond(false)} />
      <div className="animate-modal relative w-[400px] max-w-full overflow-hidden rounded-2xl bg-[var(--color-panel)] shadow-[var(--shadow-pop)]">
        <div className="flex gap-3 px-5 pb-4 pt-5">
          {opts.danger && (
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger-pale)] text-[var(--color-danger)]">
              <AlertTriangle size={15} />
            </span>
          )}
          <div className="flex flex-col gap-1">
            {opts.title && (
              <h2 className="font-serif text-title text-[var(--color-fg)]">
                {opts.title}
              </h2>
            )}
            <p className="text-body leading-relaxed text-[var(--color-fg-secondary)]">
              {opts.message}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 shadow-[inset_0_1px_0_0_var(--color-border)]">
          <button
            onClick={() => respond(false)}
            className="rounded-md px-3 py-1.5 text-body font-medium text-[var(--color-fg)] shadow-[var(--shadow-ring)] transition-all hover:bg-[var(--color-surface-2)] active:scale-[0.97]"
          >
            {cancelLabel}
          </button>
          <button
            autoFocus
            onClick={() => respond(true)}
            className={
              "rounded-md px-3 py-1.5 text-body font-medium transition-all active:scale-[0.97] " +
              (opts.danger
                ? "bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-hover)]"
                : "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]")
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
