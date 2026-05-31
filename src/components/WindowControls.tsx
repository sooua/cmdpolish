import { Minus, Square, X } from "lucide-react";
import { useT } from "../i18n/useT";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function win() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

/**
 * Custom window controls for the frameless (decorations: false) window.
 * Rendered only inside Tauri; in the browser the native chrome is used.
 */
export function WindowControls() {
  const t = useT();
  if (!isTauri()) return null;

  const btn =
    "flex h-8 w-11 items-center justify-center text-[#666666] transition-colors outline-none";

  return (
    <div className="flex items-stretch">
      <button
        title={t("win.minimize")}
        onClick={() => win().then((w) => w.minimize())}
        className={btn + " hover:bg-[#f0f0f0] hover:text-[#171717]"}
      >
        <Minus size={15} />
      </button>
      <button
        title={t("win.maximize")}
        onClick={() => win().then((w) => w.toggleMaximize())}
        className={btn + " hover:bg-[#f0f0f0] hover:text-[#171717]"}
      >
        <Square size={12} />
      </button>
      <button
        title={t("win.close")}
        onClick={() => win().then((w) => w.close())}
        className={btn + " hover:bg-[#e5484d] hover:text-white"}
      >
        <X size={16} />
      </button>
    </div>
  );
}
