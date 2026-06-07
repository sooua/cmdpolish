import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Terminal,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Sparkles,
  ArrowUpCircle,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { EditorPane } from "../components/EditorPane";
import { Toolbar } from "../components/Toolbar";
import { SecurityPanel } from "../components/SecurityPanel";
import { OutputActions } from "../components/OutputActions";
import { HistoryDrawer } from "../components/HistoryDrawer";
import { SettingsDialog } from "../components/SettingsDialog";
import { AiActionsMenu } from "../components/AiActionsMenu";
import { WindowControls } from "../components/WindowControls";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { aiPrewarm } from "../engine/ai";
import { copyToClipboard } from "../lib/clipboard";
import { comboFromEvent, SHORTCUT_ACTIONS, type ShortcutAction } from "../lib/shortcuts";
import { useT } from "../i18n/useT";

type Tab = "security" | "warnings" | "ai";

export default function App() {
  const s = useAppStore();
  const t = useT();
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<Tab>("security");

  useEffect(() => {
    s.initHistory().catch((e) => console.error("History init failed:", e));
    const p = s.activeProvider();
    if (p && s.settings.aiEnabled) aiPrewarm(p);
    s.checkForUpdate(true); // silent check on launch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (s.aiResult || s.aiError) setTab("ai");
  }, [s.aiResult, s.aiError]);

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(""), 2000);
  }, []);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(s.output || s.input);
    flash(ok ? t("toolbar.copied") : t("toolbar.copyFailed"));
    return ok;
  }, [s.output, s.input, flash, t]);

  const handleCopyMarkdown = useCallback(async () => {
    const ok = await copyToClipboard(s.copyAsMarkdownText());
    flash(ok ? t("toolbar.copiedMd") : t("toolbar.copyFailed"));
    return ok;
  }, [s, flash, t]);

  const handleRedact = useCallback(() => {
    s.redactNow();
    setTab("security");
  }, [s]);

  const handleFormat = useCallback(async () => {
    await s.format();
    if (s.guard.findings.length) setTab("security");
  }, [s]);

  const handleClear = useCallback(() => {
    s.clearInput();
    s.clearOutput();
  }, [s]);

  // Keyboard shortcuts (user-configurable; bindings live in settings).
  useEffect(() => {
    const actions: Record<ShortcutAction, () => void> = {
      format: handleFormat,
      redact: handleRedact,
      copy: handleCopy,
      copyMarkdown: handleCopyMarkdown,
      clear: handleClear,
      settings: () => s.setSettingsOpen(true),
      history: () => s.setHistoryOpen(true),
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const combo = comboFromEvent(e);
      if (!combo) return;
      for (const action of SHORTCUT_ACTIONS) {
        if (s.settings.shortcuts[action] === combo) {
          e.preventDefault();
          actions[action]();
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleFormat, handleCopy, handleCopyMarkdown, handleRedact, handleClear, s]);

  const securityBadge = useMemo(() => {
    const n = s.guard.findings.length + s.redactFindings.length;
    return n > 0 ? n : undefined;
  }, [s.guard.findings.length, s.redactFindings.length]);

  const iconBtn =
    "inline-flex items-center justify-center rounded-md p-1.5 text-[#666666] transition-all hover:bg-[#fafafa] hover:text-[#171717] active:scale-[0.95]";

  return (
    <div className="flex h-full flex-col bg-white text-[#171717]">
      {/* Integrated title bar (frameless window) */}
      <header
        data-tauri-drag-region
        className="flex h-10 shrink-0 items-center pl-3 shadow-[var(--shadow-border)]"
      >
        <div data-tauri-drag-region className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#171717]">
            <Terminal size={13} className="text-white" />
          </span>
          <span className="text-body font-semibold tracking-[-0.02em]">
            CmdPolish
          </span>
        </div>

        <div data-tauri-drag-region className="flex-1" />

        <div className="flex items-center gap-1 pr-2">
          {s.updateInfo && (
            <button
              onClick={() => s.setSettingsOpen(true)}
              title={t("updates.available", { v: s.updateInfo.version })}
              className="mr-1 inline-flex items-center gap-1 rounded-full bg-[#ebf5ff] px-2 py-0.5 text-caption font-medium text-[#0068d6] shadow-[inset_0_0_0_1px_#bfdbfe] transition-all hover:bg-[#dceefe] active:scale-[0.97]"
            >
              <ArrowUpCircle size={13} />
              {t("updates.badge")}
            </button>
          )}
          <button
            onClick={() => s.setHistoryOpen(true)}
            title={t("history.title")}
            className={iconBtn}
          >
            <HistoryIcon size={16} />
          </button>
          <button
            onClick={() => s.setSettingsOpen(true)}
            title={t("settings.title")}
            className={iconBtn}
          >
            <SettingsIcon size={16} />
          </button>
        </div>
        <WindowControls />
      </header>

      {/* Onboarding banner — AI is required to format. */}
      {!s.aiReady() && (
        <div className="flex items-center gap-3 bg-[#fafafa] px-5 py-2.5 text-body text-[#4d4d4d] shadow-[var(--shadow-border)]">
          <Sparkles size={15} className="shrink-0 text-[#0a72ef]" />
          <span className="flex-1">{t("banner.needAi")}</span>
          <button
            onClick={() => s.setSettingsOpen(true)}
            className="shrink-0 rounded-md bg-[#171717] px-3 py-1 text-body font-medium text-white transition-all hover:bg-black active:scale-[0.97]"
          >
            {t("banner.configAi")}
          </button>
        </div>
      )}

      {/* Editors — side by side on wide windows, stacked when narrow. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1">
        <section className="flex min-h-0 flex-col shadow-[inset_0_-1px_0_0_#ebebeb] md:shadow-[inset_-1px_0_0_0_#ebebeb]">
          <PaneHeader title={t("pane.input")} hint={t("pane.inputHint")} />
          <div className="min-h-0 flex-1">
            <EditorPane
              value={s.input}
              language={s.language}
              fontSize={s.settings.fontSize}
              onChange={s.setInput}
            />
          </div>
        </section>
        <section className="flex min-h-0 flex-col">
          <PaneHeader title={t("pane.output")} hint={s.language} />
          <div className="relative min-h-0 flex-1">
            <EditorPane
              value={s.output}
              language={s.language}
              fontSize={s.settings.fontSize}
              readOnly
            />
            {s.aiBusy && !s.output && (
              <GeneratingOverlay label={t("overlay.generating")} />
            )}
            {!s.aiBusy && !s.output && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex items-center gap-2 text-body text-[#6e6e6e]">
                  <Sparkles size={15} className="text-[#a3a3a3]" />
                  {t("pane.outputEmpty")}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Inspector tabs */}
      <div className="bg-white shadow-[var(--shadow-border)]">
        <div className="flex items-center px-3">
          <div className="flex items-center gap-1">
            <TabButton
              active={tab === "security"}
              badge={securityBadge}
              onClick={() => setTab("security")}
            >
              {t("tab.security")}
            </TabButton>
            <TabButton
              active={tab === "warnings"}
              badge={s.warnings.length || undefined}
              onClick={() => setTab("warnings")}
            >
              {t("tab.warnings")}
            </TabButton>
            <TabButton active={tab === "ai"} onClick={() => setTab("ai")}>
              {t("tab.ai")}
            </TabButton>
          </div>
          {s.output.trim() && (
            <div className="ml-auto pl-3">
              <OutputActions
                onCopy={handleCopy}
                onCopyMarkdown={handleCopyMarkdown}
              />
            </div>
          )}
        </div>
        <div
          key={tab}
          className="animate-fade max-h-44 overflow-auto border-t border-[#ebebeb]"
        >
          {tab === "security" && (
            <SecurityPanel guard={s.guard} findings={s.redactFindings} />
          )}
          {tab === "warnings" && <WarningsPanel warnings={s.warnings} />}
          {tab === "ai" && (
            <AiPanel
              busy={s.aiBusy}
              result={s.aiResult}
              error={s.aiError}
              onClear={s.clearAiResult}
            />
          )}
        </div>
      </div>

      <Toolbar
        onFormat={handleFormat}
        onRedact={handleRedact}
        onClear={handleClear}
        busy={s.aiBusy}
        aiMode={s.settings.aiEnabled}
        aiActions={<AiActionsMenu />}
        status={status}
      />

      <HistoryDrawer />
      <SettingsDialog />
      <ConfirmDialog />
    </div>
  );
}

function GeneratingOverlay({ label }: { label: string }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const t = window.setInterval(() => setMs(performance.now() - start), 100);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="animate-fade pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
      <div className="flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-body text-[#4d4d4d] shadow-[var(--shadow-pop)]">
        <Sparkles size={15} className="animate-pulse text-[#0a72ef]" />
        {label}{" "}
        <span className="font-mono tabular-nums text-[#171717]">
          {(ms / 1000).toFixed(1)}s
        </span>
      </div>
    </div>
  );
}

function PaneHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-center justify-between bg-white px-4 py-2 shadow-[var(--shadow-border)]">
      <span className="font-mono text-micro font-medium uppercase tracking-tight text-[#171717]">
        {title}
      </span>
      <span className="font-mono text-micro text-[#6e6e6e]">{hint}</span>
    </div>
  );
}

function TabButton({
  active,
  badge,
  onClick,
  children,
}: {
  active: boolean;
  badge?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-1.5 border-b-2 px-2 py-2.5 text-body font-medium transition-colors " +
        (active
          ? "border-[#171717] text-[#171717]"
          : "border-transparent text-[#666666] hover:text-[#171717]")
      }
    >
      {children}
      {badge ? (
        <span className="rounded-full bg-[#ebf5ff] px-1.5 text-micro font-medium text-[#0068d6]">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function AiPanel({
  busy,
  result,
  error,
  onClear,
}: {
  busy: boolean;
  result: string;
  error: string;
  onClear: () => void;
}) {
  const t = useT();
  if (busy && !result)
    return (
      <div className="px-4 py-3 text-body text-[#666666]">
        {t("ai.panel.processing")}
      </div>
    );
  if (error)
    return (
      <div className="px-4 py-3">
        <p className="text-body text-[#e5484d]">{error}</p>
        <button
          onClick={onClear}
          className="mt-2 text-caption text-[#666666] hover:text-[#171717]"
        >
          {t("common.clear")}
        </button>
      </div>
    );
  if (!result)
    return (
      <div className="px-4 py-3 text-body text-[#666666]">
        {t("ai.panel.empty")}
      </div>
    );
  return (
    <div className="px-4 py-3">
      <pre className="whitespace-pre-wrap break-words font-mono text-caption leading-relaxed text-[#171717]">
        {result}
      </pre>
      <button
        onClick={onClear}
        className="mt-2 text-caption text-[#666666] hover:text-[#171717]"
      >
        {t("common.clear")}
      </button>
    </div>
  );
}

function WarningsPanel({ warnings }: { warnings: string[] }) {
  const t = useT();
  if (warnings.length === 0)
    return (
      <div className="px-4 py-3 text-body text-[#666666]">
        {t("warnings.none")}
      </div>
    );
  return (
    <ul className="flex flex-col gap-1.5 px-4 py-3">
      {warnings.map((w, i) => (
        <li key={i} className="text-caption text-[#b45309]">
          • {w}
        </li>
      ))}
    </ul>
  );
}
