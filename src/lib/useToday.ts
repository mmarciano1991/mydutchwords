/* useToday — the local calendar day, kept current while the app stays open.

   The daily set, the run and the habit are all scoped to a day, so a
   rollover has to be noticed without a reload: a timer fires just after
   midnight, and coming back to the tab (the usual way a day goes by
   unnoticed — a phone left overnight) re-checks it too. */
import { useEffect, useState } from "react";
import { dayKey } from "./dailySet";

export function useToday(): {
  /** The day key ("2026-10-04") — the dependency for anything per-day. */
  today: string;
  /** A moment within that day, for the habit helpers that take a Date. */
  now: Date;
} {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const check = () => {
      const current = new Date();
      if (dayKey(current) !== dayKey(now)) setNow(current);
    };
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    // A second past midnight, so the check can't land on the old day.
    const timer = window.setTimeout(check, midnight.getTime() - Date.now() + 1000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [now]);

  return { today: dayKey(now), now };
}
