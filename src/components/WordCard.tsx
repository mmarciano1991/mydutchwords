/* WordCard (Figma 249:2276) — a looked-up word presented for review before
   it's added: gender chip, the Dutch word, its gloss, and the example
   sentence when the entry has one. */
import type { DictionaryEntry } from "../lib/types";
import { GenderChip } from "./GenderChip";
import { SourceNote } from "./SourceNote";

export function WordCard({ entry, note }: { entry: DictionaryEntry; note?: string }) {
  return (
    <div className="wordcard">
      <GenderChip gender={entry.gender} />
      <div className="wordcard__word">{entry.dutch}</div>
      <div className="wordcard__gloss">{entry.english}</div>
      {entry.example && (
        <>
          <div className="wordcard__rule" />
          <div className="eyebrow">In context</div>
          <div className="quote">{entry.example}</div>
          <div className="wordcard__example-en">{entry.exampleEn}</div>
        </>
      )}
      {/* Grammar footnote — why the headword differs from what was typed.
          It belongs after the word, not in a banner above it: the answer is
          the card, and the inflection is a detail about how you got here. */}
      {note && <p className="wordcard__note">{note}</p>}
      {/* Why this card may be thinner than the last one. */}
      <SourceNote source={entry.senses[0]?.source} />
    </div>
  );
}
