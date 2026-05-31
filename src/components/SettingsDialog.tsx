import { useEffect, useState } from "react";
import { X, Loader2, Sparkles, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { aiComplete, isLocalEndpoint } from "../engine/ai";
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

const MODES: { value: RedactMode; key: "redactMode.preserve" | "redactMode.placeholder" }[] =
  [
    { value: "preserve-ends", key: "redactMode.preserve" },
    { value: "placeholder", key: "redactMode.placeholder" },
  ];

export function SettingsDialog() {
  const {
    settings,
    updateSettings,
    updateProvider,
    setActiveProvider,
    settingsOpen,
    setSettingsOpen,
  } = useAppStore();
  const t = useT();
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "fail">(
    "idle"
  );
  const [testMsg, setTestMsg] = useState("");

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
    "w-full rounded-md bg-white px-2.5 py-1.5 text-[13px] text-[#171717] shadow-[var(--shadow-ring)] outline-none transition-shadow focus:shadow-[0_0_0_1px_var(--color-focus)]";
  const label = "text-[12px] text-[#666666]";

  return (
    <div className="animate-fade fixed inset-0 z-40 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-[#171717]/20"
        onClick={() => setSettingsOpen(false)}
      />
      <div className="animate-modal relative flex max-h-[85vh] w-[460px] max-w-full flex-col overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-pop)]">
        <header className="flex items-center justify-between px-5 py-3.5 shadow-[var(--shadow-border)]">
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#171717]">
            {t("settings.title")}
          </span>
          <button
            onClick={() => setSettingsOpen(false)}
            className="rounded-md p-1.5 text-[#666666] transition-colors hover:bg-[#fafafa] hover:text-[#171717]"
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
            <p className="-mt-1 text-[11px] text-[#6e6e6e]">
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
                      <span className="text-[#a3a3a3]">
                        {t("aiMenu.localNoKey")}
                      </span>
                    )}
                  </span>
                  <input
                    className={field}
                    type="password"
                    value={active.apiKey}
                    placeholder={local ? t("aiMenu.apiKeyLocal") : "sk-…"}
                    onChange={(e) =>
                      updateProvider(active.id, { apiKey: e.target.value })
                    }
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={test}
                    disabled={testState === "testing"}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium text-[#171717] shadow-[var(--shadow-ring)] transition-all hover:bg-[#fafafa] active:scale-[0.97] disabled:opacity-50"
                  >
                    {testState === "testing" ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    {t("aiMenu.test")}
                  </button>
                  {testState === "ok" && (
                    <span className="flex items-center gap-1 text-[12px] text-[#15803d]">
                      <CheckCircle2 size={13} /> {testMsg}
                    </span>
                  )}
                  {testState === "fail" && (
                    <span
                      className="flex items-center gap-1 truncate text-[12px] text-[#e5484d]"
                      title={testMsg}
                    >
                      <XCircle size={13} /> {t("aiMenu.fail")}
                    </span>
                  )}
                </div>
                {!local && (
                  <p className="text-[11px] text-[#9a3412]">
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
              <span className="text-[11px] text-[#6e6e6e]">
                {t("shortcut.hint")}
              </span>
              <button
                onClick={() =>
                  updateSettings({ shortcuts: { ...DEFAULT_SHORTCUTS } })
                }
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-[#171717] shadow-[var(--shadow-ring)] transition-all hover:bg-[#fafafa] active:scale-[0.97]"
              >
                <RotateCcw size={13} />
                {t("shortcut.reset")}
              </button>
            </div>
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
    <div className="flex items-center justify-between gap-3 py-1.5 text-[13px] text-[#4d4d4d]">
      <span>{label}</span>
      <button
        onClick={() => setRecording((r) => !r)}
        className={
          "min-w-[88px] rounded-md px-2.5 py-1 text-center font-mono text-[12px] transition-all active:scale-[0.97] " +
          (recording
            ? "bg-[#ebf5ff] text-[#0068d6] shadow-[inset_0_0_0_1px_#bfdbfe]"
            : "text-[#171717] shadow-[var(--shadow-ring)] hover:bg-[#fafafa]")
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
      <h3 className="font-mono text-[10px] uppercase tracking-tight text-[#6e6e6e]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px] text-[#4d4d4d]">
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
    <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px] text-[#4d4d4d]">
      <span>{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </label>
  );
}
