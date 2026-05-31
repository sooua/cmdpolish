import { messages, type Locale, type MsgKey } from "./messages";

export type { Locale, MsgKey } from "./messages";
export { LOCALES } from "./messages";

type Vars = Record<string, string | number>;

/** Translate a key for a locale, falling back to English, with {var} interpolation. */
export function translate(locale: Locale, key: MsgKey, vars?: Vars): string {
  const dict = messages[locale] ?? messages.en;
  let s: string = (dict as Record<string, string>)[key] ?? messages.en[key] ?? key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
    }
  }
  return s;
}

/** Detect a sensible default locale from the browser/OS. */
export function detectLocale(): Locale {
  if (typeof navigator !== "undefined" && navigator.language) {
    if (navigator.language.toLowerCase().startsWith("zh")) return "zh";
  }
  return "en";
}

/** Non-hook accessor for use outside React (e.g. the store). */
export function tFor(locale: Locale) {
  return (key: MsgKey, vars?: Vars) => translate(locale, key, vars);
}
