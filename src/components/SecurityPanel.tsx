import { ShieldCheck, ShieldAlert, EyeOff, Lock } from "lucide-react";
import type { GuardResult, RedactFinding } from "../engine/types";
import { SEVERITY_COLOR, SEVERITY_DOT } from "./severity";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { localizeGuard } from "../i18n/guard";
import type { MsgKey } from "../i18n";

/**
 * Unified security view: dangerous-command review (auto, from the guard engine)
 * and secret redaction findings (after the Redact action) in one place.
 */
export function SecurityPanel({
  guard,
  findings,
}: {
  guard: GuardResult;
  findings: RedactFinding[];
}) {
  const t = useT();
  const locale = useAppStore((st) => st.settings.locale);
  const clean = guard.level === "none" && findings.length === 0;
  if (clean) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-body text-[var(--color-success)]">
        <ShieldCheck size={16} />
        <span>{t("security.allClean")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {/* Dangerous-command review */}
      {guard.level !== "none" && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-body font-medium text-[var(--color-fg)]">
            <ShieldAlert size={15} className="text-[var(--color-warn-dot)]" />
            <span>
              {t("security.riskCount", {
                label: t(`risk.${guard.level}` as MsgKey),
                n: guard.findings.length,
              })}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {guard.findings.map((f, i) => {
              const g = localizeGuard(f, locale);
              return (
                <li
                  key={`${f.ruleId}-${i}`}
                  className={`rounded-lg px-3 py-2 text-caption ${SEVERITY_COLOR[f.severity]}`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT[f.severity]}`}
                    />
                    {g.title}
                    {f.line ? (
                      <span className="text-[var(--color-muted-2)]">line {f.line}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 opacity-90">{g.message}</p>
                  {g.suggestion && (
                    <p className="mt-1 opacity-70">→ {g.suggestion}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Redaction findings */}
      {findings.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-body font-medium text-[var(--color-fg)]">
            <EyeOff size={15} className="text-[var(--color-purple)]" />
            <span>{t("security.redactedCount", { n: findings.length })}</span>
          </div>
          <ul className="flex flex-col gap-1">
            {findings.map((f, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-md px-3 py-1.5 text-caption shadow-[var(--shadow-border)]"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT[f.severity]}`}
                  />
                  <span className="text-[var(--color-fg)]">{f.type}</span>
                </span>
                <code
                  className="truncate font-mono text-[var(--color-fg-muted)]"
                  title={f.replacement}
                >
                  {f.replacement}
                </code>
              </li>
            ))}
          </ul>
        </section>
      )}

      {guard.level !== "none" && findings.length === 0 && (
        <p className="flex items-center gap-1.5 text-micro text-[var(--color-muted-2)]">
          <Lock size={11} /> {t("security.redactHint")}
        </p>
      )}
    </div>
  );
}
