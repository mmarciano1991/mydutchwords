/* MasteryBar — word confidence indicator (Figma node 59:15, US-38).
   A pill track with a colour-coded fill that grows with successful recalls.
   The track tint and fill colour change per confidence level; the fill width
   reflects progress toward mastery (15 recalls = full). */
import { confidenceLevel, masteryProgress } from "../lib/confidence";

export function MasteryBar({ recalls }: { recalls: number }) {
  const level = confidenceLevel(recalls);
  const pct = Math.round(masteryProgress(recalls) * 100);
  return (
    <span
      className={`mastery mastery--${level}`}
      role="img"
      aria-label={`Confidence: ${level} (${recalls} recall${recalls === 1 ? "" : "s"})`}
    >
      <span className="mastery__fill" style={{ width: `${pct}%` }} />
    </span>
  );
}
