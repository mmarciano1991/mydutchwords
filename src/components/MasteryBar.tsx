/* MasteryBar — word confidence indicator (Figma node 114:202, US-38).
   A track with a colour-coded fill that grows with successful recalls. The
   track tint and fill colour change per confidence level; the fill width
   reflects progress toward mastery (15 recalls = full). With `withLabel`, the
   level name is shown beneath the bar (as in the WordRow, Figma 104:161). */
import type { ConfidenceLevel } from "../lib/types";
import { confidenceLevel, masteryProgress } from "../lib/confidence";

const LABEL: Record<ConfidenceLevel, string> = {
  weak: "New",
  medium: "Learning",
  mastering: "Mature",
  mastered: "Mature",
};

export function MasteryBar({
  recalls,
  withLabel = false,
}: {
  recalls: number;
  withLabel?: boolean;
}) {
  const level = confidenceLevel(recalls);
  const pct = Math.round(masteryProgress(recalls) * 100);
  const bar = (
    <span
      className={`mastery mastery--${level}`}
      role="img"
      aria-label={`Confidence: ${LABEL[level]} (${recalls} recall${recalls === 1 ? "" : "s"})`}
    >
      <span className="mastery__fill" style={{ width: `${pct}%` }} />
    </span>
  );

  if (!withLabel) return bar;
  return (
    <span className="mastery-meter">
      {bar}
      <span className="mastery-meter__label">{LABEL[level]}</span>
    </span>
  );
}
