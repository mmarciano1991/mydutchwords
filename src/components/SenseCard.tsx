/* SenseCard — one meaning of a looked-up word, shown whenever a word has
   more than one ("Which meaning fits?").

   A compact WordCard with its own Add button: picking a meaning is one tap,
   the same shape as the ordinary single-sense card's own button, so seeing
   several of these in a row doesn't ask for a different gesture than usual —
   just a choice before it.

   Each meaning tracks its own place in the deck, because each is its own
   card (see lib/wordSources on sense keys). That's what lets a learner who
   already saved "aanslag" as a tax assessment still add the attack sense
   later, instead of being told they already have the word. */
import type { WordSense } from "../lib/types";
import { GenderChip } from "./GenderChip";
import { SourceNote } from "./SourceNote";

export function SenseCard({
  dutch,
  sense,
  inDeck = false,
  onAdd,
}: {
  dutch: string;
  sense: WordSense;
  /** True when THIS meaning is already saved — not merely this word. */
  inDeck?: boolean;
  onAdd: () => void;
}) {
  return (
    <div className={`sensecard${inDeck ? " sensecard--indeck" : ""}`}>
      <div className="sensecard__head">
        <GenderChip gender={sense.gender} size="sm" />
        <span className="sensecard__word">{dutch}</span>
        {sense.label && <span className="sensecard__tag">{sense.label}</span>}
      </div>
      <div className="sensecard__gloss">{sense.english}</div>
      {sense.context && <div className="sensecard__context">Used {sense.context}</div>}
      {sense.example && (
        <div className="sensecard__example">
          <div className="quote">{sense.example}</div>
          <div className="sensecard__example-en">{sense.exampleEn}</div>
        </div>
      )}
      <SourceNote source={sense.source} />
      {inDeck ? (
        <button className="btn btn--secondary sensecard__btn" disabled>
          Already in your deck
        </button>
      ) : (
        <button className="btn btn--secondary sensecard__btn" onClick={onAdd}>
          Add this meaning
        </button>
      )}
    </div>
  );
}
