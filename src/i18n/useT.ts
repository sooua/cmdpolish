import { useAppStore } from "../store/useAppStore";
import { translate, type MsgKey } from "./index";

type Vars = Record<string, string | number>;

/** Hook: returns a `t` bound to the current locale (re-renders on change). */
export function useT() {
  const locale = useAppStore((s) => s.settings.locale);
  return (key: MsgKey, vars?: Vars) => translate(locale, key, vars);
}
