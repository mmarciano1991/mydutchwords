import { useEffect, useState } from "react";

/** The value as it was `delayMs` ago — updates only after the source has
 *  stopped changing for that long. Compare with the live value to know
 *  whether the debounce has settled (`debounced === live`). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
