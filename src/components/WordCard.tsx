/* WordCard (Figma 249:2276) — a looked-up word presented for review before
   it's added: gender chip, the Dutch word, its gloss, and the example
   sentence when the entry has one. */
import type { DictionaryEntry } from "../lib/types";
import { GenderChip } from "./GenderChip";

export function WordCard({ entry }: { entry: DictionaryEntry }) {
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
    </div>
  );
}
