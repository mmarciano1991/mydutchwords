/* WordRowCompact — single-line word row: chip + word + gloss, no expand
   affordance and no add button (Figma node 154:623, "WordRow_compact").
   Used for read-only word lists, e.g. the session report's review list. */
import { GenderChip } from "./GenderChip";
import type { Gender } from "../lib/types";

export function WordRowCompact({
  dutch,
  english,
  gender,
  tricky = false,
}: {
  dutch: string;
  english: string;
  gender: Gender;
  /** Leech word (4+ lapses) — shown with a caution tag. */
  tricky?: boolean;
}) {
  return (
    <div className="wordrow-compact">
      <GenderChip gender={gender} size="sm" />
      <span className="wordrow-compact__dutch">{dutch}</span>
      <span className="wordrow-compact__gloss">{english}</span>
      {tricky && <span className="tricky-tag">Tricky</span>}
    </div>
  );
}
