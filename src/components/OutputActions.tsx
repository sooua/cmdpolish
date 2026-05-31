import { useState } from "react";
import { Copy, FileCode2, Check } from "lucide-react";
import { useT } from "../i18n/useT";

type Props = {
  onCopy: () => Promise<boolean>;
  onCopyMarkdown: () => Promise<boolean>;
};

/** Floating copy actions anchored to the bottom-right of the output pane. */
export function OutputActions({ onCopy, onCopyMarkdown }: Props) {
  const t = useT();
  const [done, setDone] = useState<"copy" | "md" | null>(null);

  const run = async (which: "copy" | "md", fn: () => Promise<boolean>) => {
    const ok = await fn();
    if (ok) {
      setDone(which);
      window.setTimeout(() => setDone((d) => (d === which ? null : d)), 1400);
    }
  };

  const btn =
    "inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-[12px] font-medium text-[#171717] shadow-[var(--shadow-ring)] transition-all hover:bg-[#fafafa] active:scale-[0.97]";

  return (
    <div className="flex items-center gap-1.5">
      <button className={btn} onClick={() => run("copy", onCopy)} title={t("toolbar.copy")}>
        {done === "copy" ? (
          <Check size={13} className="text-[#15803d]" />
        ) : (
          <Copy size={13} />
        )}
        {t("toolbar.copy")}
      </button>
      <button
        className={btn}
        onClick={() => run("md", onCopyMarkdown)}
        title={t("toolbar.copyMd")}
      >
        {done === "md" ? (
          <Check size={13} className="text-[#15803d]" />
        ) : (
          <FileCode2 size={13} />
        )}
        {t("toolbar.copyMd")}
      </button>
    </div>
  );
}
