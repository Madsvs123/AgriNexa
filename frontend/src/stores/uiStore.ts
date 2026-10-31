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
  sidebarOpen: false,
  commandPalette: false,
  seasonId: localStorage.getItem("agrinexa_season"),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setCommandPalette: (commandPalette) => set({ commandPalette }),
  setSeasonId: (seasonId) => {
    if (seasonId) localStorage.setItem("agrinexa_season", seasonId);
    else localStorage.removeItem("agrinexa_season");
    set({ seasonId });
  },
}));
