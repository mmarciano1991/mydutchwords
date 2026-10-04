/* DeinflectionCard — one candidate lemma when a typed word's inflection is
   ambiguous ("sloten" is the plural of both "slot" and "sloot"). Same visual
   pattern as SenseCard for the same reason: picking one candidate silently
   would show the learner a confident wrong word. Each candidate is a
   genuinely different word (not a second sense of the same one), so it
   carries its own dutch spelling. */
import type { DictionaryEntry } from "../lib/types";
import { GenderChip } from "./GenderChip";

export function DeinflectionCard({
  entry,
  reason,
  inDeck = false,
  onAdd,
}: {
  entry: DictionaryEntry;
  reason: string;
  /** Already saved — offering "Add" again would make an add that changes
   *  nothing, which the capture screen would still confirm (with an Undo
   *  that then removes the word that was already there). */
  inDeck?: boolean;
  onAdd: () => void;
}) {
  return (
    <div className={`sensecard${inDeck ? " sensecard--indeck" : ""}`}>
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
      {inDeck ? (
        <button className="btn btn--secondary sensecard__btn" disabled>
          Already in your deck
        </button>
      ) : (
        <button className="btn btn--secondary sensecard__btn" onClick={onAdd}>
          Add this word
        </button>
      )}
    </div>
  );
}
