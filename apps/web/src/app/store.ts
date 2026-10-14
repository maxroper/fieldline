import { create } from "zustand";

interface Toast {
  id: number;
  text: string;
  tone: "ok" | "error";
}

interface UiState {
  sidebarCollapsed: boolean;
  sidebarOpen: boolean;
  toasts: Toast[];
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toast: (text: string, tone?: "ok" | "error") => void;
  dismissToast: (id: number) => void;
}

let toastSeq = 1;

function readCollapsed(): boolean {
  try {
    return localStorage.getItem("fl.sidebar") === "collapsed";
  } catch {
    return false;
  }
}

/** UI-only state. Server data lives in TanStack Query; nothing here persists beyond the sidebar preference. */
export const useUi = create<UiState>((set) => ({
  sidebarCollapsed: readCollapsed(),
  sidebarOpen: false,
  toasts: [],
  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed;
      try {
        localStorage.setItem("fl.sidebar", next ? "collapsed" : "open");
      } catch {
        /* ignore */
      }
      return { sidebarCollapsed: next };
    }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toast: (text, tone = "ok") => {
    const id = toastSeq++;
    set((state) => ({ toasts: [...state.toasts, { id, text, tone }] }));
    setTimeout(() => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })), tone === "error" ? 6000 : 3000);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (text: string, tone?: "ok" | "error") => useUi.getState().toast(text, tone);
