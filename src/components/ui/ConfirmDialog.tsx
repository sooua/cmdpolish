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
      <div className="absolute inset-0 bg-[#171717]/25" onClick={() => respond(false)} />
      <div className="animate-modal relative w-[400px] max-w-full overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-pop)]">
        <div className="flex gap-3 px-5 pb-4 pt-5">
          {opts.danger && (
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fef2f2] text-[#e5484d]">
              <AlertTriangle size={15} />
            </span>
          )}
          <div className="flex flex-col gap-1">
            {opts.title && (
              <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[#171717]">
                {opts.title}
              </h2>
            )}
            <p className="text-[13px] leading-relaxed text-[#4d4d4d]">
              {opts.message}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 shadow-[inset_0_1px_0_0_#ebebeb]">
          <button
            onClick={() => respond(false)}
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-[#171717] shadow-[var(--shadow-ring)] transition-all hover:bg-[#fafafa] active:scale-[0.97]"
          >
            {cancelLabel}
          </button>
          <button
            autoFocus
            onClick={() => respond(true)}
            className={
              "rounded-md px-3 py-1.5 text-[13px] font-medium text-white transition-all active:scale-[0.97] " +
              (opts.danger
                ? "bg-[#e5484d] hover:bg-[#d13b40]"
                : "bg-[#171717] hover:bg-black")
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
