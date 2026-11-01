import { create } from "zustand";

const PANEL_KEY = "agrinexa_section_panel";
const RECENTS_KEY = "agrinexa_recents";
const MAX_RECENTS = 6;

export interface RecentEntry {
  /** Manifest route id for nav destinations, or `record:<id>` for records. */
  id: string;
  label: string;
  path: string;
  group: string;
}

interface UiState {
  /** Mobile nav drawer. */
  navDrawerOpen: boolean;
  /** Desktop section panel — persisted, not reset on navigation. */
  sectionPanelOpen: boolean;
  commandPalette: boolean;
  recents: RecentEntry[];
  setNavDrawerOpen: (open: boolean) => void;
  toggleNavDrawer: () => void;
  toggleSectionPanel: () => void;
  setCommandPalette: (open: boolean) => void;
  pushRecent: (entry: RecentEntry) => void;
}

function loadRecents(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentEntry =>
        !!e && typeof e === "object" && typeof (e as RecentEntry).path === "string",
    );
  } catch {
    return [];
  }
}

export const useUiStore = create<UiState>((set) => ({
  navDrawerOpen: false,
  sectionPanelOpen: localStorage.getItem(PANEL_KEY) !== "closed",
  commandPalette: false,
  recents: loadRecents(),
  setNavDrawerOpen: (navDrawerOpen) => set({ navDrawerOpen }),
  toggleNavDrawer: () => set((s) => ({ navDrawerOpen: !s.navDrawerOpen })),
  toggleSectionPanel: () =>
    set((s) => {
      const sectionPanelOpen = !s.sectionPanelOpen;
      localStorage.setItem(PANEL_KEY, sectionPanelOpen ? "open" : "closed");
      return { sectionPanelOpen };
    }),
  setCommandPalette: (commandPalette) => set({ commandPalette }),
  pushRecent: (entry) =>
    set((s) => {
      const recents = [entry, ...s.recents.filter((r) => r.path !== entry.path)].slice(0, MAX_RECENTS);
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
      } catch {
        // Private browsing / quota — recents are a convenience, not critical.
      }
      return { recents };
    }),
}));
