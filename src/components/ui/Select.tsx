import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

// Styled select: strips the native chrome and adds a consistent shadow-border
// shell with a custom chevron, so dropdowns match the rest of the system.

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  density?: "sm" | "md";
};

export function Select({ className = "", density = "md", ...props }: Props) {
  const pad = density === "sm" ? "py-1 pl-2.5 pr-7" : "py-1.5 pl-2.5 pr-7";
  return (
    <div className="relative inline-flex">
      <select
        {...props}
        className={
          "w-full appearance-none rounded-md bg-white text-[13px] text-[#171717] shadow-[var(--shadow-ring)] outline-none transition-shadow focus:shadow-[0_0_0_1px_var(--color-focus)] " +
          pad +
          " " +
          className
        }
      />
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#6e6e6e]"
      />
    </div>
  );
}
