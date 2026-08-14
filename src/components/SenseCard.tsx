/* SenseCard — one alternative meaning of a looked-up word, shown on the
   capture screen when more than one is on offer ("Which meaning fits?").
   A compact WordCard with its own Add button: picking a sense is one tap,
   the same shape as the ordinary single-sense card's own button, so seeing
   several of these in a row doesn't ask for a different gesture than usual —
   just a choice before it. */
import type { WordSense } from "../lib/types";
import { GenderChip } from "./GenderChip";

export function SenseCard({
  dutch,
  sense,
  onAdd,
}: {
  dutch: string;
  sense: WordSense;
  onAdd: () => void;
}) {
  return (
    <div className="sensecard">
      <div className="sensecard__head">
        <GenderChip gender={sense.gender} size="sm" />
        <span className="sensecard__word">{dutch}</span>
        {sense.label && <span className="sensecard__tag">{sense.label}</span>}
      </div>
      <div className="sensecard__gloss">{sense.english}</div>
      {sense.example && (
        <div className="sensecard__example">
          <div className="quote">{sense.example}</div>
          <div className="sensecard__example-en">{sense.exampleEn}</div>
        </div>
      )}
      <button className="btn btn--secondary sensecard__btn" onClick={onAdd}>
        Add this meaning
      </button>
    </div>
  );
}
