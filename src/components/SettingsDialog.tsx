import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Download,
  ArrowUpCircle,
} from "lucide-react";
import { useAppStore, type ThemePref } from "../store/useAppStore";
import { aiComplete, isLocalEndpoint } from "../engine/ai";
import { appVersion } from "../lib/updater";
import { useT } from "../i18n/useT";
import { LOCALES, type Locale, type MsgKey } from "../i18n";
import type { RedactMode } from "../engine/types";
import {
  SHORTCUT_ACTIONS,
  DEFAULT_SHORTCUTS,
  comboFromEvent,
  isValidCombo,
  formatCombo,
  type ShortcutAction,
} from "../lib/shortcuts";
import { Switch } from "./ui/Switch";
import { Select } from "./ui/Select";

const FONT_SIZES = [11, 12, 13, 14, 16, 18];

const ACTION_LABEL: Record<ShortcutAction, MsgKey> = {
  format: "toolbar.format",
  redact: "toolbar.redact",
  copy: "toolbar.copy",
  copyMarkdown: "toolbar.copyMd",
  clear: "toolbar.clear",
  settings: "settings.title",
  history: "history.title",
};

const MODES: { value: RedactMode; key: MsgKey }[] = [
  { value: "preserve-ends", key: "redactMode.preserve" },
  { value: "placeholder", key: "redactMode.placeholder" },
  { value: "hidden", key: "redactMode.hidden" },
  { value: "delivery", key: "redactMode.delivery" },
];

export function SettingsDialog() {
  const {
    settings,
    updateSettings,
    updateProvider,
    setActiveProvider,
    settingsOpen,
    setSettingsOpen,
    updateInfo,
    updateChecking,
    updateChecked,
    updateInstalling,
    updateProgress,
    updateError,
    checkForUpdate,
    runUpdateInstall,
  } = useAppStore();
  const t = useT();
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "fail">(
    "idle"
  );
  const [testMsg, setTestMsg] = useState("");
  const [version, setVersion] = useState("");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (settingsOpen) appVersion().then(setVersion);
  }, [settingsOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    if (settingsOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [settingsOpen, setSettingsOpen]);

  if (!settingsOpen) return null;

  const active = settings.aiProviders.find(
    (p) => p.id === settings.activeProviderId
  );
  const local = active ? active.local || isLocalEndpoint(active.baseUrl) : false;

  const test = async () => {
    if (!active) return;
    setTestState("testing");
    setTestMsg("");
    try {
      const out = await aiComplete(
        active,
        { system: "You are a connectivity test.", user: "Reply with: ok" },
        { maxTokens: 8 }
      );
      setTestState("ok");
      setTestMsg(out.trim().slice(0, 40) || "ok");
    } catch (e) {
      setTestState("fail");
      setTestMsg((e as Error).message ?? String(e));
    }
  };

  const field =
    "w-full rounded-md bg-[var(--color-panel)] px-2.5 py-1.5 text-body text-[var(--color-fg)] shadow-[var(--shadow-ring)] outline-none transition-shadow focus:shadow-[0_0_0_1px_var(--color-focus)]";
  const label = "text-caption text-[var(--color-fg-muted)]";

  return (
    <div className="animate-fade fixed inset-0 z-40 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-[var(--color-overlay)]"
        onClick={() => setSettingsOpen(false)}
      />
      <div className="animate-modal relative flex max-h-[85vh] w-[460px] max-w-full flex-col overflow-hidden rounded-2xl bg-[var(--color-panel)] shadow-[var(--shadow-pop)]">
        <header className="flex items-center justify-between px-5 py-3.5 shadow-[var(--shadow-border)]">
          <span className="font-serif text-title text-[var(--color-fg)]">
            {t("settings.title")}
          </span>
          <button
            onClick={() => setSettingsOpen(false)}
            className="rounded-md p-1.5 text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex flex-col gap-5 overflow-auto px-5 py-4">
          {/* General */}
          <Section title={t("settings.general")}>
            <Row label={t("settings.language")}>
              <Select
                value={settings.locale}
                onChange={(e) =>
                  updateSettings({ locale: e.target.value as Locale })
                }
              >
                {LOCALES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Row>
            <Row label={t("settings.theme")}>
              <Select
                value={settings.theme}
                onChange={(e) =>
                  updateSettings({ theme: e.target.value as ThemePref })
                }
              >
                <option value="system">{t("theme.system")}</option>
                <option value="light">{t("theme.light")}</option>
                <option value="dark">{t("theme.dark")}</option>
              </Select>
            </Row>
            <Row label={t("settings.fontSize")}>
              <Select
                value={settings.fontSize}
                onChange={(e) =>
                  updateSettings({ fontSize: Number(e.target.value) })
                }
              >
                {FONT_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}px
                  </option>
                ))}
              </Select>
            </Row>
            <SwitchRow
              label={t("settings.autoDetect")}
              checked={settings.autoDetect}
              onChange={(v) => updateSettings({ autoDetect: v })}
            />
          </Section>

          {/* AI */}
          <Section title="AI">
            <SwitchRow
              label={t("aiMenu.useAi")}
              checked={settings.aiEnabled}
              onChange={(v) => updateSettings({ aiEnabled: v })}
            />
            <p className="-mt-1 text-micro text-[var(--color-muted-2)]">
              {t("aiMenu.useAiHint")}
            </p>

            <div className="flex flex-col gap-1.5">
              <span className={label}>{t("aiMenu.provider")}</span>
              <Select
                value={settings.activeProviderId}
                onChange={(e) => {
                  setActiveProvider(e.target.value);
                  setTestState("idle");
                }}
                className="w-full"
              >
                {settings.aiProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>

            {active && (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className={label}>Base URL</span>
                  <input
                    className={field}
                    value={active.baseUrl}
                    placeholder="https://api.example.com/v1"
                    onChange={(e) =>
                      updateProvider(active.id, { baseUrl: e.target.value })
                    }
                  />
                  {active.baseUrl.trim() &&
                    !/^https?:\/\//i.test(active.baseUrl.trim()) && (
                      <span className="text-micro text-[var(--color-warn)]">
                        {t("aiMenu.badUrl")}
                      </span>
                    )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className={label}>Model</span>
                  <input
                    className={field}
                    value={active.model}
                    placeholder="model name"
                    onChange={(e) =>
                      updateProvider(active.id, { model: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className={label}>
                    API Key{" "}
                    {local && (
                      <span className="text-[var(--color-faint)]">
                        {t("aiMenu.localNoKey")}
                      </span>
                    )}
                  </span>
                  <div className="relative">
                    <input
                      className={`${field} pr-14`}
                      type={showKey ? "text" : "password"}
                      value={active.apiKey}
                      placeholder={local ? t("aiMenu.apiKeyLocal") : "sk-…"}
                      onChange={(e) =>
                        updateProvider(active.id, { apiKey: e.target.value })
                      }
                    />
                    {active.apiKey && (
                      <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-micro text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
                      >
                        {showKey ? t("aiMenu.hideKey") : t("aiMenu.showKey")}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={test}
                    disabled={testState === "testing"}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-caption font-medium text-[var(--color-fg)] shadow-[var(--shadow-ring)] transition-all hover:bg-[var(--color-surface-2)] active:scale-[0.97] disabled:opacity-50"
                  >
                    {testState === "testing" ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    {t("aiMenu.test")}
                  </button>
                  {testState === "ok" && (
                    <span className="flex items-center gap-1 text-caption text-[var(--color-success)]">
                      <CheckCircle2 size={13} /> {testMsg}
                    </span>
                  )}
                  {testState === "fail" && (
                    <span
                      className="flex items-center gap-1 truncate text-caption text-[var(--color-danger)]"
                      title={testMsg}
                    >
                      <XCircle size={13} /> {t("aiMenu.fail")}
                    </span>
                  )}
                </div>
                {!local && (
                  <p className="text-micro text-[var(--color-warn)]">
                    {t("aiMenu.cloudWarn")}
                  </p>
                )}
              </>
            )}
          </Section>

          {/* Redaction */}
          <Section title={t("settings.redaction")}>
            <div className="flex flex-col gap-1.5">
              <span className={label}>{t("settings.redactMode")}</span>
              <Select
                value={settings.redactMode}
                onChange={(e) =>
                  updateSettings({ redactMode: e.target.value as RedactMode })
                }
                className="w-full"
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {t(m.key)}
                  </option>
                ))}
              </Select>
            </div>
            <SwitchRow
              label={t("settings.redactEmail")}
              checked={settings.redactEmail}
              onChange={(v) => updateSettings({ redactEmail: v })}
            />
            <SwitchRow
              label={t("settings.redactIp")}
              checked={settings.redactIp}
              onChange={(v) => updateSettings({ redactIp: v })}
            />
            <SwitchRow
              label={t("settings.redactDomain")}
              checked={settings.redactDomain}
              onChange={(v) => updateSettings({ redactDomain: v })}
            />
          </Section>

          {/* Shortcuts */}
          <Section title={t("settings.shortcuts")}>
            <div className="flex flex-col">
              {SHORTCUT_ACTIONS.map((action) => (
                <ShortcutRow
                  key={action}
                  label={t(ACTION_LABEL[action])}
                  combo={settings.shortcuts[action]}
                  recordingLabel={t("shortcut.recording")}
                  onChange={(combo) =>
                    updateSettings({
                      shortcuts: { ...settings.shortcuts, [action]: combo },
                    })
                  }
                />
              ))}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-micro text-[var(--color-muted-2)]">
                {t("shortcut.hint")}
              </span>
              <button
                onClick={() =>
                  updateSettings({ shortcuts: { ...DEFAULT_SHORTCUTS } })
                }
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-caption font-medium text-[var(--color-fg)] shadow-[var(--shadow-ring)] transition-all hover:bg-[var(--color-surface-2)] active:scale-[0.97]"
              >
                <RotateCcw size={13} />
                {t("shortcut.reset")}
              </button>
            </div>
          </Section>

          {/* Updates */}
          <Section title={t("updates.title")}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-body text-[var(--color-fg-secondary)]">
                {version ? t("updates.version", { v: version }) : "—"}
              </span>
              <button
                onClick={() => checkForUpdate(false)}
                disabled={updateChecking || updateInstalling}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-caption font-medium text-[var(--color-fg)] shadow-[var(--shadow-ring)] transition-all hover:bg-[var(--color-surface-2)] active:scale-[0.97] disabled:opacity-50"
              >
                {updateChecking ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RotateCcw size={13} />
                )}
                {updateChecking ? t("updates.checking") : t("updates.check")}
              </button>
            </div>

            {updateInfo ? (
              <div className="flex flex-col gap-2 rounded-lg bg-[var(--color-badge-bg)] px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--color-badge-border)]">
                <span className="flex items-center gap-1.5 text-body font-medium text-[var(--color-badge-text)]">
                  <ArrowUpCircle size={15} />
                  {t("updates.available", { v: updateInfo.version })}
                </span>
                {updateInfo.notes && (
                  <p className="max-h-20 overflow-auto whitespace-pre-wrap text-caption leading-relaxed text-[var(--color-fg-secondary)]">
                    {updateInfo.notes}
                  </p>
                )}
                <button
                  onClick={() => runUpdateInstall()}
                  disabled={updateInstalling}
                  className="inline-flex w-fit items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-caption font-medium text-[var(--color-on-primary)] transition-all hover:bg-[var(--color-primary-hover)] active:scale-[0.97] disabled:opacity-60"
                >
                  {updateInstalling ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Download size={13} />
                  )}
                  {updateInstalling
                    ? t("updates.installing", {
                        pct:
                          updateProgress >= 0
                            ? `${Math.round(updateProgress * 100)}%`
                            : "",
                      })
                    : t("updates.install")}
                </button>
                <span className="text-micro text-[var(--color-muted-2)]">
                  {t("updates.restartNote")}
                </span>
              </div>
            ) : updateChecked && !updateError ? (
              <span className="flex items-center gap-1.5 text-caption text-[var(--color-success)]">
                <CheckCircle2 size={13} /> {t("updates.upToDate")}
              </span>
            ) : null}

            {updateError && (
              <span className="text-caption text-[var(--color-danger)]">
                {t("updates.failed", { msg: updateError })}
              </span>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({
  label,
  combo,
  recordingLabel,
  onChange,
}: {
  label: string;
  combo: string;
  recordingLabel: string;
  onChange: (combo: string) => void;
}) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      const c = comboFromEvent(e);
      if (isValidCombo(c)) {
        onChange(c);
        setRecording(false);
      }
    };
    // Capture phase so we intercept before the app's global shortcut handler.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [recording, onChange]);

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-body text-[var(--color-fg-secondary)]">
      <span>{label}</span>
      <button
        onClick={() => setRecording((r) => !r)}
        className={
          "min-w-[88px] rounded-md px-2.5 py-1 text-center font-mono text-caption transition-all active:scale-[0.97] " +
          (recording
            ? "bg-[var(--color-badge-bg)] text-[var(--color-badge-text)] shadow-[inset_0_0_0_1px_var(--color-badge-border)]"
            : "text-[var(--color-fg)] shadow-[var(--shadow-ring)] hover:bg-[var(--color-surface-2)]")
        }
      >
        {recording ? recordingLabel : formatCombo(combo)}
      </button>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-micro font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-2)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-body text-[var(--color-fg-secondary)]">
      <span>{label}</span>
      {children}
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-body text-[var(--color-fg-secondary)]">
      <span>{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </label>
  );
}
