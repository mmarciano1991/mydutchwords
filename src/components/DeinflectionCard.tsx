/* DeinflectionCard — one candidate lemma when a typed word's inflection is
   ambiguous ("sloten" is the plural of both "slot" and "sloot"). Same visual
   pattern as SenseCard for the same reason: the old contract picked one
   candidate silently, which was exactly the "attack" vs. "tax assessment"
   failure 1b fixed — replaying it inside deinflection was the run-05 finding
   this card answers. Each candidate is a genuinely different word (not a
   second sense of the same one), so it carries its own dutch spelling. */
import type { DictionaryEntry } from "../lib/types";
import { GenderChip } from "./GenderChip";

export function DeinflectionCard({
  entry,
  reason,
  onAdd,
}: {
  entry: DictionaryEntry;
  reason: string;
  onAdd: () => void;
}) {
  return (
    <div className="sensecard">
      <div className="sensecard__head">
        <GenderChip gender={entry.gender} size="sm" />
        <span className="sensecard__word">{entry.dutch}</span>
        <span className="sensecard__tag">{reason}</span>
      </div>
      <div className="sensecard__gloss">{entry.english}</div>
      {entry.example && (
        <div className="sensecard__example">
          <div className="quote">{entry.example}</div>
          <div className="sensecard__example-en">{entry.exampleEn}</div>
        </div>
      )}
      <button className="btn btn--secondary sensecard__btn" onClick={onAdd}>
        Add this word
      </button>
    </div>
  );
}
