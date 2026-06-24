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
    const text = s.output || s.input;
    const ok = await copyToClipboard(text);
    flash(
      ok
        ? t("toolbar.copiedSize", { n: humanSize(text.length) })
        : t("toolbar.copyFailed")
    );
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
      // Esc stops an in-flight AI request.
      if (e.key === "Escape" && s.aiBusy) {
        e.preventDefault();
        s.cancelAi();
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      // Ctrl/⌘+1/2/3 switch inspector tabs.
      if (e.key === "1") {
        e.preventDefault();
        setTab("security");
        return;
      }
      if (e.key === "2") {
        e.preventDefault();
        setTab("warnings");
        return;
      }
      if (e.key === "3") {
        e.preventDefault();
        setTab("ai");
        return;
      }
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
    "inline-flex items-center justify-center rounded-md p-1.5 text-[var(--color-fg-muted)] transition-all hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)] active:scale-[0.95]";

  return (
    <div className="flex h-full flex-col bg-[var(--color-panel)] text-[var(--color-fg)]">
      {/* Integrated title bar (frameless window) */}
      <header
        data-tauri-drag-region
        className="flex h-10 shrink-0 items-center pl-3 shadow-[var(--shadow-border)]"
      >
        <div data-tauri-drag-region className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-primary)]">
            <Terminal size={13} className="text-[var(--color-on-primary)]" />
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
              className="mr-1 inline-flex items-center gap-1 rounded-full bg-[var(--color-badge-bg)] px-2 py-0.5 text-caption font-medium text-[var(--color-badge-text)] shadow-[inset_0_0_0_1px_var(--color-badge-border)] transition-all hover:bg-[var(--color-badge-bg-hover)] active:scale-[0.97]"
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
        <div className="flex items-center gap-3 bg-[var(--color-surface-2)] px-5 py-2.5 text-body text-[var(--color-fg-secondary)] shadow-[var(--shadow-border)]">
          <Sparkles size={15} className="shrink-0 text-[var(--color-accent)]" />
          <span className="flex-1">{t("banner.needAi")}</span>
          <button
            onClick={() => s.setSettingsOpen(true)}
            className="shrink-0 rounded-md bg-[var(--color-primary)] px-3 py-1 text-body font-medium text-[var(--color-on-primary)] transition-all hover:bg-[var(--color-primary-hover)] active:scale-[0.97]"
          >
            {t("banner.configAi")}
          </button>
        </div>
      )}

      {/* Editors — side by side on wide windows, stacked when narrow. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1">
        <section className="flex min-h-0 flex-col shadow-[inset_0_-1px_0_0_var(--color-border)] md:shadow-[inset_-1px_0_0_0_var(--color-border)]">
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
                <span className="flex items-center gap-2 text-body text-[var(--color-muted-2)]">
                  <Sparkles size={15} className="text-[var(--color-faint)]" />
                  {t("pane.outputEmpty")}
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Inspector tabs */}
      <div className="bg-[var(--color-panel)] shadow-[var(--shadow-border)]">
        <div className="flex items-center px-3">
          <div className="flex items-center gap-1">
            <TabButton
              active={tab === "security"}
              badge={securityBadge}
              onClick={() => setTab("security")}
              title={`${t("tab.security")} · ${t("tab.hint.security")}`}
            >
              {t("tab.security")}
            </TabButton>
            <TabButton
              active={tab === "warnings"}
              badge={s.warnings.length || undefined}
              onClick={() => setTab("warnings")}
              title={`${t("tab.warnings")} · ${t("tab.hint.warnings")}`}
            >
              {t("tab.warnings")}
            </TabButton>
            <TabButton
              active={tab === "ai"}
              onClick={() => setTab("ai")}
              title={`${t("tab.ai")} · ${t("tab.hint.ai")}`}
            >
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
          className="animate-fade max-h-44 overflow-auto border-t border-[var(--color-border)]"
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
        onStop={s.cancelAi}
        onRedact={handleRedact}
        onClear={handleClear}
        busy={s.aiBusy}
        aiMode={s.settings.aiEnabled}
        aiActions={<AiActionsMenu />}
        status={status || s.notice}
      />

      <HistoryDrawer />
      <SettingsDialog />
      <ConfirmDialog />
    </div>
  );
}

/** Human-readable byte size for copy feedback (chars ≈ bytes for ASCII). */
function humanSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function GeneratingOverlay({ label }: { label: string }) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const t = window.setInterval(() => setMs(performance.now() - start), 100);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="animate-fade pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--color-overlay-panel)] backdrop-blur-[1px]">
      <div className="flex items-center gap-2 rounded-lg bg-[var(--color-panel)] px-3.5 py-2 text-body text-[var(--color-fg-secondary)] shadow-[var(--shadow-pop)]">
        <Sparkles size={15} className="animate-pulse text-[var(--color-accent)]" />
        {label}{" "}
        <span className="font-mono tabular-nums text-[var(--color-fg)]">
          {(ms / 1000).toFixed(1)}s
        </span>
      </div>
    </div>
  );
}

function PaneHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-center justify-between bg-[var(--color-panel)] px-4 py-2 shadow-[var(--shadow-border)]">
      <span className="font-mono text-micro font-medium uppercase tracking-tight text-[var(--color-fg)]">
        {title}
      </span>
      <span className="font-mono text-micro text-[var(--color-muted-2)]">{hint}</span>
    </div>
  );
}

function TabButton({
  active,
  badge,
  onClick,
  title,
  children,
}: {
  active: boolean;
  badge?: number;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        "flex items-center gap-1.5 border-b-2 px-2 py-2.5 text-body font-medium transition-colors " +
        (active
          ? "border-[var(--color-fg)] text-[var(--color-fg)]"
          : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]")
      }
    >
      {children}
      {badge ? (
        <span className="rounded-full bg-[var(--color-badge-bg)] px-1.5 text-micro font-medium text-[var(--color-badge-text)]">
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
      <div className="px-4 py-3 text-body text-[var(--color-fg-muted)]">
        {t("ai.panel.processing")}
      </div>
    );
  if (error)
    return (
      <div className="px-4 py-3">
        <p className="text-body text-[var(--color-danger)]">{error}</p>
        <button
          onClick={onClear}
          className="mt-2 text-caption text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          {t("common.clear")}
        </button>
      </div>
    );
  if (!result)
    return (
      <div className="px-4 py-3 text-body text-[var(--color-fg-muted)]">
        {t("ai.panel.empty")}
      </div>
    );
  return (
    <div className="px-4 py-3">
      <pre className="whitespace-pre-wrap break-words font-mono text-caption leading-relaxed text-[var(--color-fg)]">
        {result}
      </pre>
      <button
        onClick={onClear}
        className="mt-2 text-caption text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
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
      <div className="px-4 py-3 text-body text-[var(--color-fg-muted)]">
        {t("warnings.none")}
      </div>
    );
  return (
    <ul className="flex flex-col gap-1.5 px-4 py-3">
      {warnings.map((w, i) => (
        <li key={i} className="text-caption text-[var(--color-warn)]">
          • {w}
        </li>
      ))}
    </ul>
  );
}
