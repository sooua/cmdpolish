import type { ReactNode } from "react";
import { Wand2, EyeOff, Eraser, Square } from "lucide-react";
import { useT } from "../i18n/useT";
import { useAppStore } from "../store/useAppStore";
import { formatCombo } from "../lib/shortcuts";

type ButtonProps = {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
  title?: string;
};

function ToolButton({ icon, label, onClick, primary, title }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title ?? label}
      className={
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-body font-medium transition-all active:scale-[0.97] " +
        (primary
          ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]"
          : "text-[var(--color-fg)] shadow-[var(--shadow-ring)] hover:bg-[var(--color-surface-2)]")
      }
    >
      {icon}
      {label}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-[var(--color-border)]" />;
}

type Props = {
  onFormat: () => void;
  onStop?: () => void;
  onRedact: () => void;
  onClear: () => void;
  busy?: boolean;
  aiMode?: boolean;
  /** AI Actions menu — sits next to Format in the generate group. */
  aiActions?: ReactNode;
  status?: string;
};

export function Toolbar({
  onFormat,
  onStop,
  onRedact,
  onClear,
  busy,
  aiMode,
  aiActions,
  status,
}: Props) {
  const t = useT();
  const sc = useAppStore((s) => s.settings.shortcuts);
  return (
    <div className="flex flex-wrap items-center gap-2 bg-[var(--color-panel)] px-4 py-2.5 shadow-[var(--shadow-border)]">
      {/* Generate group */}
      {busy ? (
        <ToolButton
          icon={<Square size={13} className="fill-current" />}
          label={t("toolbar.stop")}
          onClick={() => onStop?.()}
          title={t("toolbar.stop")}
          primary
        />
      ) : (
        <ToolButton
          icon={<Wand2 size={15} />}
          label={aiMode ? t("toolbar.formatAi") : t("toolbar.format")}
          onClick={onFormat}
          title={`${t("toolbar.format")} · ${formatCombo(sc.format)}`}
          primary
        />
      )}
      {aiActions}

      <Divider />

      {/* Security + reset group */}
      <ToolButton
        icon={<EyeOff size={15} />}
        label={t("toolbar.redact")}
        onClick={onRedact}
        title={`${t("toolbar.redact")} · ${formatCombo(sc.redact)}`}
      />
      <ToolButton
        icon={<Eraser size={15} />}
        label={t("toolbar.clear")}
        onClick={onClear}
        title={`${t("toolbar.clear")} · ${formatCombo(sc.clear)}`}
      />

      <div className="ml-auto min-h-[20px] text-caption font-medium text-[var(--color-accent)]">
        {status}
      </div>
    </div>
  );
}
