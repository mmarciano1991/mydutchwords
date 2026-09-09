/* SourceNote — one line saying where a meaning came from.
 *
 * Only shown when the answer isn't "the app's own dictionary". An entry
 * fetched from Wiktionary arrives with no article and often no example, and
 * next to a curated entry it simply looks damaged — recommendations.md item 1
 * asked for exactly one line of copy to fix that: "say so, so the difference
 * reads as provenance rather than damage".
 *
 * The same applies to the two thinner sources this change introduced: a
 * meaning split mechanically out of a packed gloss, and one proposed by a
 * model. A learner deciding whether to trust a gloss is entitled to know
 * which of those they're looking at.
 */
import type { WordSense } from "../lib/types";

const NOTES: Partial<Record<NonNullable<WordSense["source"]>, string>> = {
  online: "From the online dictionary — it may have no article or example.",
  imported: "From an imported word list — no article or example was included.",
  derived: "Split from this word's other meaning; no example sentence yet.",
  generated: "Suggested automatically and checked by a person.",
};

export function SourceNote({ source }: { source: WordSense["source"] }) {
  const note = source ? NOTES[source] : undefined;
  if (!note) return null; // "curated" and "authored" are the norm — nothing to say
  return <p className="source-note">{note}</p>;
}
