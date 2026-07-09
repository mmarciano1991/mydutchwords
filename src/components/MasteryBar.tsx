/* MasteryBar — word progress indicator (Figma node 114:202).
   Shows the word's position on the spaced-repetition ladder (level 0–6,
   see lib/learningEngine): the fill width is level / MAX_LEVEL and the
   colour tier steps from grey-blue (new) through gold (learning) to green
   (mature). With `withLabel`, the tier name is shown beneath the bar
   (as in the WordRow, Figma 104:161). */
import { MAX_LEVEL } from "../lib/learningEngine";

type Tier = "weak" | "medium" | "mastering" | "mastered";

function tierFor(level: number): Tier {
  if (level >= MAX_LEVEL) return "mastered";
  if (level >= 4) return "mastering";
  if (level >= 2) return "medium";
  return "weak";
}

const LABEL: Record<Tier, string> = {
  weak: "New",
  medium: "Learning",
  mastering: "Strong",
  mastered: "Mature",
};

export function MasteryBar({
  level,
  withLabel = false,
}: {
  /** Ladder level 0–MAX_LEVEL from the word's spaced-repetition state. */
  level: number;
  withLabel?: boolean;
}) {
  const tier = tierFor(level);
  const pct = Math.round((Math.max(0, Math.min(MAX_LEVEL, level)) / MAX_LEVEL) * 100);
  const bar = (
    <span
      className={`mastery mastery--${tier}`}
      role="img"
      aria-label={`Progress: ${LABEL[tier]} (level ${level} of ${MAX_LEVEL})`}
    >
      <span className="mastery__fill" style={{ width: `${pct}%` }} />
    </span>
  );

  if (!withLabel) return bar;
  return (
    <span className="mastery-meter">
      {bar}
      <span className="mastery-meter__label">{LABEL[tier]}</span>
    </span>
  );
}
