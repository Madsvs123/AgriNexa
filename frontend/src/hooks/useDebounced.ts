import { useEffect, useState } from "react";

/**
 * Debounce a rapidly-changing value.
 *
 * The search palette keyed its query on every keystroke, so "north ridge"
 * fired eleven requests and each one became its own React Query cache entry.
 */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
