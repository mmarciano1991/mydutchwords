/* WeekGoalStatus (Figma 359:1055) — this week against the weekly target:
   "This week · 3 of 4 days", then a bar with one segment per target day.

   A done day fills a segment and names its weekday; segments still open are
   just empty track — a missed day is never drawn differently from one still
   to come. Days done past the target add segments rather than overflowing.

   Shared by the Weekly goal screen and the session report, so the week reads
   the same wherever it appears. `card` puts it on the porcelain card surface
   for screens where it sits among other cards. */
import { Badge } from "./Badge";
import { Check } from "../icons";
import type { WeekProgress } from "../lib/habit";

/** Dutch weekday abbreviations, Monday first — matches WeekDay order. */
const DUTCH_DAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

export function WeekGoalStatus({ week, card = false }: { week: WeekProgress; card?: boolean }) {
  const reached = week.done >= week.target;
  const doneLabels = week.days.flatMap((d, i) => (d.done ? [DUTCH_DAYS[i]] : []));
  const segments = Array.from({ length: Math.max(week.target, week.done) }, (_, i) => doneLabels[i] ?? null);

  return (
    <section className={`weekgoal__status${card ? " weekgoal__status--card" : ""}`}>
      <div className="weekgoal__head">
        <div className="weekgoal__title">
          <p className="weekgoal__eyebrow">This week</p>
          <p className="weekgoal__count">{week.count}</p>
        </div>
        {reached && <Badge>Goal reached</Badge>}
      </div>
      <ol className="weekgoal__bar" aria-label={`${week.count} this week`}>
        {segments.map((label, i) => (
          <li key={i} className={`weekgoal__seg${label ? " is-done" : ""}`}>
            {label && <Check />}
          </li>
        ))}
      </ol>
      <div className="weekgoal__labels" aria-hidden="true">
        {segments.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
    </section>
  );
}
