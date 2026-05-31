// A small, designed toggle switch — replaces the default checkbox look.
// Black-when-on (Vercel primary), smooth knob travel, accessible.

type Props = {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
};

export function Switch({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full transition-colors duration-200 outline-none focus-visible:shadow-[var(--focus-ring)] " +
        (checked ? "bg-[#171717]" : "bg-[#e2e2e2]")
      }
    >
      <span
        className={
          "inline-block h-[14px] w-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform duration-200 " +
          (checked ? "translate-x-[14px]" : "translate-x-[2px]")
        }
      />
    </button>
  );
}

/** A labelled row wrapping the switch — the common settings pattern. */
export function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-[13px] text-[#4d4d4d]">
      <span>{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </label>
  );
}
