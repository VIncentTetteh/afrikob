import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Theme = "light" | "dark";

interface UiState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  theme: Theme;
  /** Hidden column ids per table id. */
  hiddenColumns: Record<string, string[]>;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  toggleTheme: () => void;
  setHiddenColumns: (tableId: string, ids: string[]) => void;
}

/** Client UI preferences; persisted per browser (non-sensitive only). */
export const useUi = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      theme: "light",
      hiddenColumns: {},
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNav: (open) => set({ mobileNavOpen: open }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      setHiddenColumns: (tableId, ids) => set((s) => ({ hiddenColumns: { ...s.hiddenColumns, [tableId]: ids } })),
    }),
    {
      name: "afk-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, theme: s.theme, hiddenColumns: s.hiddenColumns }),
    },
  ),
);
