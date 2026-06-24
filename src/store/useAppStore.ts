import { create } from "zustand";
import type {
  GuardResult,
  Language,
  RedactFinding,
  RedactMode,
} from "../engine/types";
import { detectLanguage } from "../engine/detect/detectLanguage";
import { redact, hasSecrets } from "../engine/redactor/redact";
import { review } from "../engine/guard/review";
import { wrapMarkdown } from "../engine/markdown/wrapMarkdown";
import { newId } from "../lib/id";
import {
  getHistoryBackend,
  type HistoryEntry,
  type HistoryQuery,
} from "../lib/history";
import {
  aiFormatStream,
  runAiTask,
  aiPrewarm,
  AiError,
  PROVIDER_PRESETS,
  DEFAULT_PROVIDER_KEYS,
  isLocalEndpoint,
  type AiProvider,
  type AiErrorKind,
  type AiTask,
} from "../engine/ai";
import type { MsgKey } from "../i18n";
import { loadSettings, saveSettings } from "../lib/persist";
import { tFor, detectLocale, type Locale } from "../i18n";
import { ask } from "../components/ui/confirm";
import {
  DEFAULT_SHORTCUTS,
  type ShortcutAction,
} from "../lib/shortcuts";
import { checkUpdate, installUpdate, type UpdateInfo } from "../lib/updater";

export type ThemePref = "light" | "dark" | "system";

export type Settings = {
  locale: Locale;
  theme: ThemePref;
  fontSize: number;
  shortcuts: Record<ShortcutAction, string>;
  redactMode: RedactMode;
  redactEmail: boolean;
  redactIp: boolean;
  redactDomain: boolean;
  autoDetect: boolean;

  // AI
  /** Use AI as the primary formatter (falls back to local rules on failure). */
  aiEnabled: boolean;
  activeProviderId: string;
  aiProviders: AiProvider[];
};

type AppState = {
  input: string;
  output: string;
  language: Language; // active language (auto or manual)
  autoLanguage: Language; // last auto-detected
  confidence: number;
  detectReasons: string[];
  manualLanguage: Language | "auto";
  warnings: string[];
  redactFindings: RedactFinding[];
  /**
   * The un-redacted text a redaction was last applied to. Kept so changing a
   * redaction toggle can re-scan from the original instead of double-masking
   * already-redacted output. Null when the current output isn't a redaction.
   */
  preRedactSource: string | null;
  guard: GuardResult;
  settings: Settings;
  /** Concrete theme in effect (resolves "system"); drives the Monaco theme. */
  resolvedTheme: "light" | "dark";

  // AI runtime state
  aiBusy: boolean;
  aiResult: string; // prose output from AI tasks
  aiError: string;
  /** Transient, non-error status surfaced in the toolbar (e.g. save failures). */
  notice: string;
  settingsOpen: boolean; // controls the AI config popover

  // Auto-update
  updateInfo: UpdateInfo | null;
  updateChecking: boolean;
  updateChecked: boolean;
  updateInstalling: boolean;
  updateProgress: number; // 0..1, -1 when size unknown
  updateError: string;

  // History
  history: HistoryEntry[];
  historyOpen: boolean;
  historyKind: "sqlite" | "local" | null;
  historyQuery: HistoryQuery;

  setInput: (text: string) => void;
  setManualLanguage: (lang: Language | "auto") => void;
  format: () => Promise<void>;
  /** Abort an in-flight AI request (Stop button). */
  cancelAi: () => void;
  setNotice: (msg: string) => void;
  redactNow: () => void;
  copyAsMarkdownText: () => string;
  clearInput: () => void;
  clearOutput: () => void;
  useOutputAsInput: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Recompute and apply the active theme (after a pref or OS change). */
  applyResolvedTheme: () => void;

  // AI actions
  activeProvider: () => AiProvider | undefined;
  /** True when a provider is configured AND AI formatting is enabled. */
  aiReady: () => boolean;
  updateProvider: (id: string, patch: Partial<AiProvider>) => void;
  setActiveProvider: (id: string) => void;
  setSettingsOpen: (open: boolean) => void;
  runTask: (task: AiTask) => Promise<void>;
  clearAiResult: () => void;

  // Update actions
  checkForUpdate: (silent?: boolean) => Promise<void>;
  runUpdateInstall: () => Promise<void>;

  // History actions
  initHistory: () => Promise<void>;
  refreshHistory: (query?: HistoryQuery) => Promise<void>;
  saveSnippet: (durationMs?: number) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  restoreSnippet: (entry: HistoryEntry) => void;
  setHistoryOpen: (open: boolean) => void;
};

/** Build a short title from the most meaningful line of a snippet. */
function deriveTitle(text: string): string {
  const line =
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? "Untitled";
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}

const DEFAULT_SETTINGS: Settings = {
  locale: detectLocale(),
  theme: "system",
  fontSize: 13,
  shortcuts: { ...DEFAULT_SHORTCUTS },
  redactMode: "preserve-ends",
  redactEmail: false,
  redactIp: false,
  redactDomain: false,
  autoDetect: true,
  aiEnabled: true,
  activeProviderId: "ark",
  aiProviders: PROVIDER_PRESETS.map((p) => ({
    ...p,
    apiKey: DEFAULT_PROVIDER_KEYS[p.id] ?? "",
  })),
};

/** Load persisted settings, merging in any newly-added preset providers. */
function initialSettings(): Settings {
  const loaded = loadSettings(DEFAULT_SETTINGS);
  // Ensure every preset exists even if the saved config predates it.
  const byId = new Map(loaded.aiProviders?.map((p) => [p.id, p]) ?? []);
  const aiProviders = PROVIDER_PRESETS.map((p) => {
    const saved = byId.get(p.id);
    // Keep the user's key/url/model overrides; refresh label/kind from preset.
    return saved
      ? {
          ...p,
          ...saved,
          label: p.label,
          kind: p.kind,
          disableThinking: p.disableThinking,
        }
      : { ...p, apiKey: DEFAULT_PROVIDER_KEYS[p.id] ?? "" };
  });
  // Merge shortcuts so newly-added actions get their defaults.
  const shortcuts = { ...DEFAULT_SHORTCUTS, ...(loaded.shortcuts ?? {}) };
  return { ...DEFAULT_SETTINGS, ...loaded, aiProviders, shortcuts };
}

/** True when sending `text` to `provider` would risk leaking secrets. */
function needsSecretConfirm(provider: AiProvider, text: string): boolean {
  const local = provider.local || isLocalEndpoint(provider.baseUrl);
  return !local && hasSecrets(text);
}

function resolveLanguage(state: {
  manualLanguage: Language | "auto";
  autoLanguage: Language;
}): Language {
  return state.manualLanguage === "auto"
    ? state.autoLanguage
    : state.manualLanguage;
}

/** Map a categorized AI error to a localized, actionable message key. */
const AI_ERROR_KEY: Record<AiErrorKind, MsgKey> = {
  aborted: "ai.err.aborted",
  timeout: "ai.err.timeout",
  auth: "ai.err.auth",
  "rate-limit": "ai.err.rateLimit",
  network: "ai.err.network",
  provider: "ai.err.provider",
  unknown: "ai.callFailed",
};

function aiErrorMessage(e: unknown, locale: Locale): string {
  const t = tFor(locale);
  if (e instanceof AiError) {
    const msg = t(AI_ERROR_KEY[e.kind], { msg: e.message });
    return e.kind === "unknown" || e.kind === "provider"
      ? msg
      : `${msg}${e.status ? ` (${e.status})` : ""}`;
  }
  return t("ai.callFailed", { msg: (e as Error)?.message ?? String(e) });
}

/** Debounce timer for expensive per-keystroke detection + guard review. */
let detectTimer: ReturnType<typeof setTimeout> | null = null;

/** Resolve a theme preference to a concrete light/dark value. */
function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref === "system") {
    return typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return pref;
}

/** Apply a resolved theme to <html data-theme> and return the resolved value. */
function applyTheme(pref: ThemePref): "light" | "dark" {
  const resolved = resolveTheme(pref);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = resolved;
  }
  return resolved;
}

// React to OS theme changes while the user is on "system".
if (typeof window !== "undefined" && window.matchMedia) {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      const st = useAppStore.getState();
      if (st.settings.theme === "system") {
        st.applyResolvedTheme();
      }
    });
}

/** Controller for the current AI request, so a new one (or Stop) can abort it. */
let aiAbort: AbortController | null = null;

const INITIAL_SETTINGS = initialSettings();

export const useAppStore = create<AppState>((set, get) => ({
  input: "",
  output: "",
  language: "plain-text",
  autoLanguage: "plain-text",
  confidence: 0,
  detectReasons: [],
  manualLanguage: "auto",
  warnings: [],
  redactFindings: [],
  preRedactSource: null,
  guard: { level: "none", findings: [] },
  settings: INITIAL_SETTINGS,
  resolvedTheme: applyTheme(INITIAL_SETTINGS.theme),

  aiBusy: false,
  aiResult: "",
  aiError: "",
  notice: "",
  settingsOpen: false,

  updateInfo: null,
  updateChecking: false,
  updateChecked: false,
  updateInstalling: false,
  updateProgress: 0,
  updateError: "",

  history: [],
  historyOpen: false,
  historyKind: null,
  historyQuery: { language: "all", risk: "all", search: "" },

  setInput: (text) => {
    // Update the text immediately so typing stays responsive; defer the
    // expensive detection + guard review to a short idle debounce.
    set({ input: text });
    if (detectTimer) clearTimeout(detectTimer);
    const run = () => {
      const s = get();
      const det = s.settings.autoDetect
        ? detectLanguage(text)
        : { language: s.autoLanguage, confidence: 0, reason: [] };
      set((st) => ({
        autoLanguage: det.language,
        confidence: det.confidence,
        detectReasons: det.reason,
        language:
          st.manualLanguage === "auto" ? det.language : st.manualLanguage,
        guard: review(text),
      }));
    };
    // Tiny inputs feel better updating synchronously; large ones get debounced.
    if (text.length < 2000) run();
    else detectTimer = setTimeout(run, 150);
  },

  setManualLanguage: (lang) =>
    set((s) => ({
      manualLanguage: lang,
      language: resolveLanguage({ manualLanguage: lang, autoLanguage: s.autoLanguage }),
    })),

  format: async () => {
    const { input, language } = get();
    if (!input.trim()) return;

    const provider = get().activeProvider();
    if (!get().aiReady() || !provider) {
      // AI is mandatory — there is no rule fallback. Guide the user to set it up.
      set({
        aiError: tFor(get().settings.locale)("ai.notConfigured"),
        settingsOpen: true,
      });
      return;
    }

    // Guard against leaking secrets to a cloud provider.
    if (needsSecretConfirm(provider, input)) {
      const tt = tFor(get().settings.locale);
      const ok = await ask({
        message: tt("confirm.cloudSecrets"),
        confirmLabel: tt("common.continue"),
        danger: true,
      });
      if (!ok) return;
    }

    // Supersede any in-flight request (rapid re-clicks) and start a fresh one.
    aiAbort?.abort();
    const ctrl = new AbortController();
    aiAbort = ctrl;

    set({ aiBusy: true, aiError: "", notice: "", output: "", preRedactSource: null });
    const startedAt = performance.now();
    try {
      // Stream tokens into the output pane as they arrive for instant feedback.
      const res = await aiFormatStream(
        input,
        language,
        provider,
        (partial) => {
          if (!ctrl.signal.aborted) set({ output: partial });
        },
        { signal: ctrl.signal }
      );
      const durationMs = Math.round(performance.now() - startedAt);
      const warnings = res.truncated
        ? [tFor(get().settings.locale)("warnings.truncated"), ...res.warnings]
        : res.warnings;
      set({
        output: res.text,
        warnings,
        language: res.language,
        guard: review(res.text),
      });
      if (res.text.trim()) {
        get()
          .saveSnippet(durationMs)
          .catch((e) => {
            console.error("History save failed:", e);
            set({ notice: tFor(get().settings.locale)("history.saveFailed") });
          });
      }
    } catch (e) {
      // A cancelled request is intentional — keep whatever streamed in, no error.
      if (!(e instanceof AiError && e.kind === "aborted")) {
        set({ aiError: aiErrorMessage(e, get().settings.locale) });
      }
    } finally {
      // Only the still-active request clears busy; a superseded one must not.
      if (aiAbort === ctrl) {
        aiAbort = null;
        set({ aiBusy: false });
      }
    }
  },

  cancelAi: () => {
    aiAbort?.abort();
    aiAbort = null;
    set({ aiBusy: false });
  },

  setNotice: (msg) => set({ notice: msg }),

  redactNow: () => {
    const { input, output, settings, preRedactSource } = get();
    // Re-scan from the original text if we already redacted once, so switching
    // modes/toggles doesn't mask the placeholders from a previous pass.
    const source = preRedactSource ?? (output || input);
    if (!source) return;
    const result = redact(source, {
      mode: settings.redactMode,
      redactEmail: settings.redactEmail,
      redactIp: settings.redactIp,
      redactDomain: settings.redactDomain,
    });
    set({
      output: result.text,
      redactFindings: result.findings,
      preRedactSource: source,
    });
  },

  copyAsMarkdownText: () => {
    const { output, input, language } = get();
    return wrapMarkdown(output || input, language);
  },

  clearInput: () =>
    set({
      input: "",
      autoLanguage: "plain-text",
      confidence: 0,
      detectReasons: [],
      guard: { level: "none", findings: [] },
      redactFindings: [],
      preRedactSource: null,
    }),

  clearOutput: () =>
    set({ output: "", warnings: [], redactFindings: [], preRedactSource: null }),

  useOutputAsInput: () => {
    const { output } = get();
    if (output) get().setInput(output);
  },

  updateSettings: (patch) =>
    set((s) => {
      const settings = { ...s.settings, ...patch };
      saveSettings(settings);
      const next: Partial<AppState> = { settings };
      if (patch.theme && patch.theme !== s.settings.theme) {
        next.resolvedTheme = applyTheme(patch.theme);
      }
      // If a redaction option changed while a redaction is applied, re-scan the
      // original text so the output reflects the new mode immediately.
      const touchesRedaction =
        "redactMode" in patch ||
        "redactEmail" in patch ||
        "redactIp" in patch ||
        "redactDomain" in patch;
      if (touchesRedaction && s.preRedactSource != null) {
        const r = redact(s.preRedactSource, {
          mode: settings.redactMode,
          redactEmail: settings.redactEmail,
          redactIp: settings.redactIp,
          redactDomain: settings.redactDomain,
        });
        next.output = r.text;
        next.redactFindings = r.findings;
      }
      return next;
    }),

  applyResolvedTheme: () =>
    set((s) => ({ resolvedTheme: applyTheme(s.settings.theme) })),

  activeProvider: () => {
    const { settings } = get();
    return settings.aiProviders.find((p) => p.id === settings.activeProviderId);
  },

  aiReady: () => {
    const { settings } = get();
    if (!settings.aiEnabled) return false;
    const p = settings.aiProviders.find(
      (x) => x.id === settings.activeProviderId
    );
    if (!p || !p.baseUrl || !p.model) return false;
    // Cloud providers need a key; local ones (Ollama/LM Studio) don't.
    const local = p.local || isLocalEndpoint(p.baseUrl);
    return local || !!p.apiKey.trim();
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  updateProvider: (id, patch) =>
    set((s) => {
      const aiProviders = s.settings.aiProviders.map((p) =>
        p.id === id ? { ...p, ...patch } : p
      );
      const settings = { ...s.settings, aiProviders };
      saveSettings(settings);
      return { settings };
    }),

  setActiveProvider: (id) => {
    get().updateSettings({ activeProviderId: id });
    const p = get().activeProvider();
    if (p) aiPrewarm(p);
  },

  runTask: async (task) => {
    const { input, output, language } = get();
    const source = output.trim() || input;
    if (!source.trim()) return;

    const provider = get().activeProvider();
    if (!provider || !provider.baseUrl || !provider.model) {
      set({ aiError: tFor(get().settings.locale)("ai.notConfigured") });
      return;
    }
    if (needsSecretConfirm(provider, source)) {
      const tt = tFor(get().settings.locale);
      const ok = await ask({
        message: tt("confirm.cloudSecrets"),
        confirmLabel: tt("common.continue"),
        danger: true,
      });
      if (!ok) return;
    }

    aiAbort?.abort();
    const ctrl = new AbortController();
    aiAbort = ctrl;

    set({ aiBusy: true, aiError: "", notice: "" });
    try {
      const result = await runAiTask(task, source, language, provider, {
        signal: ctrl.signal,
      });
      if (task.output === "code") {
        set({ output: result, preRedactSource: null });
      } else {
        set({ aiResult: result });
      }
    } catch (e) {
      if (!(e instanceof AiError && e.kind === "aborted")) {
        set({ aiError: aiErrorMessage(e, get().settings.locale) });
      }
    } finally {
      if (aiAbort === ctrl) {
        aiAbort = null;
        set({ aiBusy: false });
      }
    }
  },

  clearAiResult: () => set({ aiResult: "", aiError: "" }),

  checkForUpdate: async (silent) => {
    if (get().updateChecking || get().updateInstalling) return;
    set({ updateChecking: true, updateError: "" });
    try {
      const info = await checkUpdate();
      set({ updateInfo: info, updateChecked: true });
    } catch (e) {
      if (!silent) set({ updateError: (e as Error).message ?? String(e) });
      console.error("Update check failed:", e);
    } finally {
      set({ updateChecking: false });
    }
  },

  runUpdateInstall: async () => {
    if (!get().updateInfo || get().updateInstalling) return;
    set({ updateInstalling: true, updateError: "", updateProgress: 0 });
    try {
      await installUpdate((downloaded, total) => {
        set({ updateProgress: total ? downloaded / total : -1 });
      });
      // installUpdate relaunches the app; nothing runs after this on success.
    } catch (e) {
      set({
        updateInstalling: false,
        updateError: (e as Error).message ?? String(e),
      });
    }
  },

  initHistory: async () => {
    const backend = await getHistoryBackend();
    set({ historyKind: backend.kind });
    await get().refreshHistory();
  },

  refreshHistory: async (query) => {
    const q = query ?? get().historyQuery;
    set({ historyQuery: q });
    const backend = await getHistoryBackend();
    const history = await backend.list(q);
    set({ history });
  },

  saveSnippet: async (durationMs) => {
    const { input, output, language } = get();
    if (!input.trim() && !output.trim()) return;

    const secrets = hasSecrets(input) || hasSecrets(output);
    const risk = review(output || input).level;

    let inputText = input;
    let outputText = output;
    // Never persist plaintext secrets — always store a redacted copy.
    if (secrets) {
      const opts = {
        mode: "placeholder" as const,
        redactEmail: false,
        redactIp: false,
        redactDomain: false,
      };
      inputText = redact(input, opts).text;
      outputText = redact(output, opts).text;
    }

    const now = new Date().toISOString();
    const entry: HistoryEntry = {
      id: newId(),
      title: deriveTitle(output || input),
      language,
      inputText,
      outputText,
      createdAt: now,
      updatedAt: now,
      hasSecrets: secrets,
      riskLevel: risk,
      durationMs,
    };

    const backend = await getHistoryBackend();
    await backend.add(entry);
    await get().refreshHistory();
  },

  deleteSnippet: async (id) => {
    const backend = await getHistoryBackend();
    await backend.remove(id);
    await get().refreshHistory();
  },

  clearHistory: async () => {
    const backend = await getHistoryBackend();
    await backend.clear();
    await get().refreshHistory();
  },

  restoreSnippet: (entry) => {
    get().setInput(entry.inputText);
    set({ output: entry.outputText, historyOpen: false, preRedactSource: null });
  },

  setHistoryOpen: (open) => {
    if (open) get().refreshHistory().catch(() => {});
    set({ historyOpen: open });
  },
}));
