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
  PROVIDER_PRESETS,
  DEFAULT_PROVIDER_KEYS,
  isLocalEndpoint,
  type AiProvider,
  type AiTask,
} from "../engine/ai";
import { loadSettings, saveSettings } from "../lib/persist";
import { tFor, detectLocale, type Locale } from "../i18n";
import { ask } from "../components/ui/confirm";
import {
  DEFAULT_SHORTCUTS,
  type ShortcutAction,
} from "../lib/shortcuts";
import { checkUpdate, installUpdate, type UpdateInfo } from "../lib/updater";

export type Settings = {
  locale: Locale;
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
  guard: GuardResult;
  settings: Settings;

  // AI runtime state
  aiBusy: boolean;
  aiResult: string; // prose output from AI tasks
  aiError: string;
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
  redactNow: () => void;
  copyAsMarkdownText: () => string;
  clearInput: () => void;
  clearOutput: () => void;
  useOutputAsInput: () => void;
  updateSettings: (patch: Partial<Settings>) => void;

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
  guard: { level: "none", findings: [] },
  settings: initialSettings(),

  aiBusy: false,
  aiResult: "",
  aiError: "",
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
  historyQuery: { language: "all", search: "" },

  setInput: (text) => {
    const det = get().settings.autoDetect
      ? detectLanguage(text)
      : { language: get().autoLanguage, confidence: 0, reason: [] };
    set((s) => {
      const autoLanguage = det.language;
      const language =
        s.manualLanguage === "auto" ? autoLanguage : s.manualLanguage;
      return {
        input: text,
        autoLanguage,
        confidence: det.confidence,
        detectReasons: det.reason,
        language,
        guard: review(text),
      };
    });
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

    set({ aiBusy: true, aiError: "", output: "" });
    const startedAt = performance.now();
    try {
      // Stream tokens into the output pane as they arrive for instant feedback.
      const res = await aiFormatStream(input, language, provider, (partial) =>
        set({ output: partial })
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
          .catch((e) => console.error("History save failed:", e));
      }
    } catch (e) {
      set({
        aiError: tFor(get().settings.locale)("ai.callFailed", {
          msg: (e as Error).message ?? String(e),
        }),
      });
    } finally {
      set({ aiBusy: false });
    }
  },

  redactNow: () => {
    const { input, output, settings } = get();
    const source = output || input;
    const result = redact(source, {
      mode: settings.redactMode,
      redactEmail: settings.redactEmail,
      redactIp: settings.redactIp,
      redactDomain: settings.redactDomain,
    });
    set({ output: result.text, redactFindings: result.findings });
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
    }),

  clearOutput: () => set({ output: "", warnings: [], redactFindings: [] }),

  useOutputAsInput: () => {
    const { output } = get();
    if (output) get().setInput(output);
  },

  updateSettings: (patch) =>
    set((s) => {
      const settings = { ...s.settings, ...patch };
      saveSettings(settings);
      return { settings };
    }),

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
    return !!p && !!p.baseUrl && !!p.model;
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

    set({ aiBusy: true, aiError: "" });
    try {
      const result = await runAiTask(task, source, language, provider);
      if (task.output === "code") {
        set({ output: result });
      } else {
        set({ aiResult: result });
      }
    } catch (e) {
      set({ aiError: (e as Error).message ?? String(e) });
    } finally {
      set({ aiBusy: false });
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
    set({ output: entry.outputText, historyOpen: false });
  },

  setHistoryOpen: (open) => {
    if (open) get().refreshHistory().catch(() => {});
    set({ historyOpen: open });
  },
}));
