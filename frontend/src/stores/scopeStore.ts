import { create } from "zustand";

const FARM_KEY = "agrinexa_farm";
const SEASON_KEY = "agrinexa_season";

/**
 * Global data scope: which farm and season the user is looking at.
 *
 * Season was already global but lived in `uiStore` next to sidebar state; farm
 * was re-picked locally on every page that needed it (the map had its own
 * selector, lists had their own filters). Both now live here so that moving
 * between Fields → Map → Irrigation keeps the same farm in view.
 */
interface ScopeState {
  farmId: string | null;
  seasonId: string | null;
  setFarmId: (id: string | null) => void;
  setSeasonId: (id: string | null) => void;
  reset: () => void;
}

function persist(key: string, value: string | null) {
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

export const useScopeStore = create<ScopeState>((set) => ({
  farmId: localStorage.getItem(FARM_KEY),
  seasonId: localStorage.getItem(SEASON_KEY),
  setFarmId: (farmId) => {
    persist(FARM_KEY, farmId);
    set({ farmId });
  },
  setSeasonId: (seasonId) => {
    persist(SEASON_KEY, seasonId);
    set({ seasonId });
  },
  reset: () => {
    persist(FARM_KEY, null);
    persist(SEASON_KEY, null);
    set({ farmId: null, seasonId: null });
  },
}));
