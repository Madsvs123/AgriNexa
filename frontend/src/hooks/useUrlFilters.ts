import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Keep list filters in the URL instead of component state.
 *
 * List pages previously held `useState` per filter, so a filtered view could
 * not be bookmarked, shared, or restored with the back button, and a remount
 * silently reset it.
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(() => {
    const out = { ...defaults };
    for (const key of Object.keys(defaults) as Array<keyof T & string>) {
      const fromUrl = searchParams.get(key);
      if (fromUrl !== null) out[key] = fromUrl as T[keyof T & string];
    }
    return out;
  }, [searchParams, defaults]);

  const setValue = useCallback(
    (key: keyof T & string, value: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          // Defaults stay out of the URL so clean views have clean links.
          if (!value || value === defaults[key]) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, defaults],
  );

  const reset = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of Object.keys(defaults)) next.delete(key);
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams, defaults]);

  const activeCount = useMemo(
    () => (Object.keys(defaults) as Array<keyof T & string>).filter((k) => values[k] !== defaults[k]).length,
    [values, defaults],
  );

  /** Drop defaults/empties so they never reach the API as `?soil=`. */
  const apiParams = useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of Object.keys(defaults) as Array<keyof T & string>) {
      const v = values[key];
      if (v && v !== defaults[key]) out[key] = v;
    }
    return out;
  }, [values, defaults]);

  return { values, setValue, reset, activeCount, apiParams };
}

/**
 * URL-backed tab selection for detail pages.
 *
 * `FarmDetailPage` held its tab in `useState`, so a refresh dropped you back on
 * "overview" and a tab could not be linked to.
 */
export function useUrlTab(defaultTab: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || defaultTab;

  const setTab = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === defaultTab) params.delete("tab");
          else params.set("tab", next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams, defaultTab],
  );

  return [tab, setTab] as const;
}
