/* MasteryBar — word progress indicator (Figma node 114:202).
   Shows the word's learning state — New, Learning, Learned — via its
   derived 0–6 level (lib/learningEngine.legacyLevel: 0 is New, 6 is
   Learned, 1–5 is Learning by interval). The fill width is level / MAX_LEVEL.
   Colour is never the only signal: with `withLabel` the state's name is
   shown beneath the bar (as in the WordRow, Figma 104:161), and the
   accessible name always carries it. */
import { MAX_LEVEL } from "../lib/learningEngine";

type Tier = "new" | "learning" | "mastered";

function tierFor(level: number): Tier {
  if (level <= 0) return "new";
  return level >= MAX_LEVEL ? "mastered" : "learning";
}

const LABEL: Record<Tier, string> = {
  new: "New",
  learning: "Learning",
  mastered: "Learned",
};

export function MasteryBar({
  level,
  withLabel = false,
}: {
  /** The word's derived level 0–MAX_LEVEL (see lib/learningEngine). */
  level: number;
  withLabel?: boolean;
}) {
  const tier = tierFor(level);
  const pct = Math.round((Math.max(0, Math.min(MAX_LEVEL, level)) / MAX_LEVEL) * 100);
  const bar = (
    <span
      className={`mastery mastery--${tier}`}
      role="img"
      aria-label={`Progress: ${LABEL[tier]}`}
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
