import { useEffect } from "react";
import { X, Trash2, RotateCcw, Search, ShieldAlert, Lock, Timer } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { SEVERITY_DOT } from "./severity";
import { ask } from "./ui/confirm";
import { useT } from "../i18n/useT";

/** Compact duration: "850ms" under a second, otherwise "1.2s". */
function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(iso: string, t: ReturnType<typeof useT>): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("time.justNow");
  if (m < 60) return t("time.mAgo", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("time.hAgo", { n: h });
  const d = Math.floor(h / 24);
  return t("time.dAgo", { n: d });
}

export function HistoryDrawer() {
  const t = useT();
  const {
    historyOpen,
    setHistoryOpen,
    history,
    historyQuery,
    historyKind,
    refreshHistory,
    deleteSnippet,
    clearHistory,
    restoreSnippet,
  } = useAppStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHistoryOpen(false);
    };
    if (historyOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [historyOpen, setHistoryOpen]);

  if (!historyOpen) return null;

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div
        className="animate-fade absolute inset-0 bg-[#171717]/20"
        onClick={() => setHistoryOpen(false)}
      />
      <aside className="animate-drawer relative flex h-full w-[420px] max-w-[90vw] flex-col bg-white shadow-[var(--shadow-pop)]">
        <header className="flex items-center justify-between px-4 py-3 shadow-[var(--shadow-border)]">
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-[-0.01em] text-[#171717]">
              {t("history.title")}
            </span>
            <span className="rounded-full bg-[#fafafa] px-2 py-0.5 font-mono text-[10px] uppercase text-[#666666] shadow-[var(--shadow-border)]">
              {historyKind === "sqlite" ? "SQLite" : "local"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                const ok = await ask({
                  title: t("history.clearAll"),
                  message: t("history.clearConfirm"),
                  confirmLabel: t("history.clearAll"),
                  danger: true,
                });
                if (ok) clearHistory();
              }}
              title={t("history.clearAll")}
              className="rounded-md p-1.5 text-[#666666] transition-colors hover:bg-[#fafafa] hover:text-[#e5484d]"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => setHistoryOpen(false)}
              className="rounded-md p-1.5 text-[#666666] transition-colors hover:bg-[#fafafa] hover:text-[#171717]"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Search */}
        <div className="px-3 py-2.5 shadow-[var(--shadow-border)]">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a3a3a3]"
            />
            <input
              value={historyQuery.search ?? ""}
              onChange={(e) =>
                refreshHistory({ ...historyQuery, search: e.target.value })
              }
              placeholder={t("history.search")}
              className="w-full rounded-md bg-white py-1.5 pl-8 pr-2 text-[13px] text-[#171717] shadow-[var(--shadow-ring)] outline-none focus:shadow-[0_0_0_1px_var(--color-focus)]"
            />
          </div>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-auto">
          {history.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-[#6e6e6e]">
              {t("history.empty")}
            </div>
          ) : (
            <ul className="flex flex-col">
              {history.map((e) => (
                <li
                  key={e.id}
                  className="group px-3 py-2.5 shadow-[inset_0_-1px_0_0_#ebebeb] transition-colors hover:bg-[#fafafa]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => restoreSnippet(e)}
                      title={t("history.restore")}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate font-mono text-[13px] text-[#171717]">
                        {e.title}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#6e6e6e]">
                        <span className="rounded-full bg-[#fafafa] px-1.5 py-0.5 font-mono text-[#666666] shadow-[var(--shadow-border)]">
                          {e.language}
                        </span>
                        <span>{timeAgo(e.createdAt, t)}</span>
                        {e.durationMs != null && (
                          <span
                            className="flex items-center gap-1"
                            title={t("history.duration")}
                          >
                            <Timer size={11} />
                            {formatDuration(e.durationMs)}
                          </span>
                        )}
                        {e.hasSecrets && (
                          <span
                            className="flex items-center gap-1 text-[#7928ca]"
                            title={t("history.redacted")}
                          >
                            <Lock size={11} /> {t("history.redacted")}
                          </span>
                        )}
                        {e.riskLevel !== "none" && (
                          <span className="flex items-center gap-1 text-[#9a3412]">
                            <ShieldAlert size={11} />
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT[e.riskLevel]}`}
                            />
                            {e.riskLevel}
                          </span>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => restoreSnippet(e)}
                        title={t("history.restore")}
                        className="rounded-md p-1 text-[#666666] hover:text-[#171717]"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={() => deleteSnippet(e.id)}
                        title={t("history.delete")}
                        className="rounded-md p-1 text-[#666666] hover:text-[#e5484d]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
