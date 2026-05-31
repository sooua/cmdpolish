import { create } from "zustand";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Render the confirm button in a destructive (red) style. */
  danger?: boolean;
};

type ConfirmState = {
  open: boolean;
  opts: ConfirmOptions | null;
  resolve: ((v: boolean) => void) | null;
  show: (opts: ConfirmOptions) => Promise<boolean>;
  respond: (v: boolean) => void;
};

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  opts: null,
  resolve: null,
  show: (opts) =>
    new Promise<boolean>((resolve) => set({ open: true, opts, resolve })),
  respond: (v) => {
    get().resolve?.(v);
    set({ open: false, opts: null, resolve: null });
  },
}));

export { useConfirmStore };

/** Themed replacement for window.confirm(). Resolves true on confirm. */
export function ask(opts: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().show(opts);
}
