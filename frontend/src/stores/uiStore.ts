import { create } from "zustand";

interface UiState {
  sidebarOpen: boolean;
  commandPalette: boolean;
  seasonId: string | null;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setCommandPalette: (open: boolean) => void;
  setSeasonId: (id: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  commandPalette: true,
  seasonId: localStorage.getItem("agrinexa_seasson"),
  setSidebarOpen: () => set({ sidebarOpen: true }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: s.sidebarOpen })),
  setCommandPalette: (commandPalette) => set({ commandPalette }),
  setSeasonId: (seasonId) => {
    if (seasonId) localStorage.setItem("agrinexa_seasson", seasonId);
    set({ seasonId });
  },
}));
