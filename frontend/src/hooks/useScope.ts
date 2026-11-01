import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { matchRoute, type ScopeKey } from "@/navigation/manifest";
import { useScopeStore } from "@/stores/scopeStore";

export interface Scope {
  farmId: string | null;
  seasonId: string | null;
  /** Scope dimensions the current route declares in the manifest. */
  applies: ScopeKey[];
  /**
   * Query params for the current route, including only the dimensions that
   * route actually uses. Stable by value so it is safe in a query key.
   */
  params: Record<string, string>;
  setFarmId: (id: string | null) => void;
  setSeasonId: (id: string | null) => void;
}

/**
 * Resolve the active data scope for the current route.
 *
 * Routes declare what they care about (`scope: ["farm", "season"]`), so the
 * dashboard does not get a stray `farm` filter and settings pages get neither.
 */
export function useScope(): Scope {
  const { pathname } = useLocation();
  const farmId = useScopeStore((s) => s.farmId);
  const seasonId = useScopeStore((s) => s.seasonId);
  const setFarmId = useScopeStore((s) => s.setFarmId);
  const setSeasonId = useScopeStore((s) => s.setSeasonId);

  const applies = useMemo(() => matchRoute(pathname)?.scope ?? [], [pathname]);

  const params = useMemo(() => {
    const out: Record<string, string> = {};
    if (applies.includes("farm") && farmId) out.farm = farmId;
    if (applies.includes("season") && seasonId) out.season_id = seasonId;
    return out;
  }, [applies, farmId, seasonId]);

  return { farmId, seasonId, applies, params, setFarmId, setSeasonId };
}
