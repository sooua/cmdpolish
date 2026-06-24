import { useEffect, useRef, useState } from "react";
import { Wand2, ChevronDown, Loader2 } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { AI_TASKS } from "../engine/ai";
import { useT } from "../i18n/useT";
import type { MsgKey } from "../i18n";

export function AiActionsMenu() {
  const { runTask, aiBusy, activeProvider } = useAppStore();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const provider = activeProvider();
  const ready = !!provider && !!provider.baseUrl && !!provider.model;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-body font-medium text-[var(--color-fg)] shadow-[var(--shadow-ring)] transition-all hover:bg-[var(--color-surface-2)] active:scale-[0.97]"
        title={t("aiActions.title")}
      >
        {aiBusy ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Wand2 size={15} />
        )}
        {t("aiActions.title")}
        <ChevronDown size={13} className="text-[var(--color-muted-2)]" />
      </button>

      {open && (
        <div className="animate-pop-up absolute bottom-full left-0 z-20 mb-1.5 w-72 overflow-hidden rounded-xl bg-[var(--color-panel)] p-1 shadow-[var(--shadow-pop)]">
          {!ready && (
            <div className="px-3 py-2 text-caption text-[var(--color-warn)]">
              {t("aiActions.needProvider")}
            </div>
          )}
          {AI_TASKS.map((task) => (
            <button
              key={task.id}
              disabled={!ready || aiBusy}
              onClick={() => {
                runTask(task);
                setOpen(false);
              }}
              className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--color-surface-2)] disabled:opacity-40"
            >
              <span className="text-body text-[var(--color-fg)]">
                {t(`task.${task.id}.label` as MsgKey)}
              </span>
              <span className="text-micro text-[var(--color-muted-2)]">
                {t(`task.${task.id}.hint` as MsgKey)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
