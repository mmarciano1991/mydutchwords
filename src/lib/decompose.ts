/* ──────────────────────────────────────────────────────────────────────────
   decompose — splits a Dutch compound into the dictionary words it's built
   from.

   This is the half of "missing words" that no dictionary can ever fix by
   growing. Dutch forms compounds productively and writes them as one word,
   so the set of legal Dutch words is open-ended: "belastingaanslag",
   "huurtoeslag", "betalingsregeling", "inburgeringscursus" are ordinary
   municipal vocabulary and none of them can be in a 14,000-word list,
   because the list would have to be infinite. Every one of them, though, is
   built from words the dictionary already has.

   Dutch compounds are head-final: the LAST part carries the meaning and the
   article ("de belasting" + "de aanslag" → "de belastingaanslag"; "de huur"
   + "het bedrag" → "het huurbedrag"). So the head is what a learner needs
   glossed, and the parts before it are what makes the gloss make sense.

   Parts are often joined by a linking letter that belongs to neither word —
   "betaling·s·regeling", "boek·en·kast" — so those are tried between every
   pair.

   Same contract as lib/deinflect: this proposes, the caller's dictionary
   disposes. A wrong split just produces parts that aren't words and never
   surfaces. The guards below exist for the opposite failure — a split that
   IS all real words but isn't how the word is actually built ("kanaal" is
   not "kan" + "aal") — which is why parts have a minimum length and short
   words are never split at all.
   ────────────────────────────────────────────────────────────────────────── */
import { deinflect } from "./deinflect";

export interface Compound {
  /** The dictionary words it's built from, in order, as base forms. */
  parts: string[];
  /** The last part: the head, which carries the meaning and the article. */
  head: string;
}

/** Letters that can sit between two parts, belonging to neither of them.
 *  "" first, so a plain join is preferred over one that assumes a linker. */
const LINKERS = ["", "s", "en", "e"];

/** No part shorter than this. Dutch has plenty of three-letter words ("kan",
 *  "aal", "oor", "aar"), and allowing them turns ordinary long words into
 *  confident nonsense splits. Four is where that stops paying off. */
const MIN_PART = 4;

/** Nothing shorter than this is a compound worth looking for — below it, a
 *  successful split is far more likely to be a coincidence than a parse. */
const MIN_WORD = 8;

/** At most this many parts. Three covers real municipal vocabulary
 *  ("ziektekostenverzekering") without opening up combinatorial noise. */
const MAX_PARTS = 3;

/** How many splits to hand back. More than a couple is never a useful
 *  question to put to a learner. */
const MAX_RESULTS = 2;

/** The head may itself be inflected — "belastingaanslagen" is the plural of
 *  a compound, and its head "aanslagen" has to come back as "aanslag" for
 *  the gloss to be findable. Returns the base form, or null. */
function resolveHead(segment: string, lookup: (t: string) => boolean): string | null {
  if (lookup(segment)) return segment;
  const [first] = deinflect(segment, lookup);
  return first ? first.lemma : null;
}

/** Every way `rest` splits into at most `budget` real words. Longest first
 *  part first: Dutch compounds are overwhelmingly parsed that way, and it
 *  keeps "belasting|aanslag" ahead of any shorter accidental prefix. */
function splitsOf(rest: string, lookup: (t: string) => boolean, budget: number): string[][] {
  const out: string[][] = [];

  // The whole remainder as the head — the base case that ends a split.
  const head = resolveHead(rest, lookup);
  if (head) out.push([head]);

  if (budget <= 1) return out;

  for (let i = rest.length - MIN_PART; i >= MIN_PART; i--) {
    const first = rest.slice(0, i);
    if (!lookup(first)) continue;
    for (const linker of LINKERS) {
      if (linker && !rest.startsWith(linker, i)) continue;
      const tail = rest.slice(i + linker.length);
      if (tail.length < MIN_PART) continue;
      for (const sub of splitsOf(tail, lookup, budget - 1)) {
        out.push([first, ...sub]);
      }
    }
  }
  return out;
}

/**
 * Splits `word` into the dictionary words it's compounded from, or returns
 * [] when it isn't a compound of known words.
 *
 * Only ever called for a word the dictionary missed AND that deinflection
 * couldn't explain — a real headword must never be re-explained as a
 * compound of two others ("aanslag" is a word, not "aan" + "slag").
 *
 * Results are ordered fewest-parts first, so the simplest parse wins, and
 * capped: offering a learner five ways to read one word is worse than
 * offering one.
 */
export function decompose(word: string, lookup: (term: string) => boolean): Compound[] {
  const q = word.trim().toLowerCase();
  if (q.length < MIN_WORD || !/^[a-z]+$/.test(q)) return [];
  if (lookup(q)) return []; // a real word explains itself

  const seen = new Set<string>();
  const found: Compound[] = [];

  for (const parts of splitsOf(q, lookup, MAX_PARTS)) {
    if (parts.length < 2) continue; // not a compound
    const key = parts.join("+");
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ parts, head: parts[parts.length - 1] });
  }

  found.sort((a, b) => a.parts.length - b.parts.length);
  return found.slice(0, MAX_RESULTS);
}
