/* ──────────────────────────────────────────────────────────────────────────
   Typo tolerance — "Did you mean…?".

   Only ever offered when nothing matches by prefix and the query is not an
   inflected form of a real word: a guess about typing must never sit next
   to an answer grammar can justify ("gestegen" is stijgen, never
   "gisteren").

   Distance is Damerau-Levenshtein on the search keys, at most 1 for words up
   to 6 letters and 2 for longer, same first letter. Confusions a learner
   makes (ei/ij, ou/au, g/ch, final -d/-t, double vowels and consonants, y for
   ij) cost half an edit: "klijn" → klein and "yzer" → ijzer are found even
   though their plain distance is 2.

   Pure, no imports beyond normalize.
   ────────────────────────────────────────────────────────────────────────── */
import { confusionKey, searchKey } from "./normalize.ts";

/** Damerau-Levenshtein (optimal string alignment), with an early exit once
 *  every path is beyond `max`. */
export function damerauLevenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    let best = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2][j - 2] + 1);
      }
      d[i][j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** The largest distance allowed for a query of this many letters. */
export function typoBudget(query: string): number {
  return searchKey(query).length <= 6 ? 1 : 2;
}

/** Distance between what was typed and a candidate, with learner
 *  confusions at half cost. */
export function learnerDistance(query: string, candidate: string): number {
  const q = searchKey(query);
  const c = searchKey(candidate);
  const plain = damerauLevenshtein(q, c, 3);
  const cq = confusionKey(query);
  const cc = confusionKey(candidate);
  if (cq === cc) return Math.min(plain, 0.5);
  return Math.min(plain, damerauLevenshtein(cq, cc, 3) + 0.5);
}

/** True when a candidate is close enough to offer as "Did you mean…?". */
export function isTypoOf(query: string, candidate: string): boolean {
  const q = searchKey(query);
  const c = searchKey(candidate);
  if (!q || !c || q === c) return false;
  // Same first letter — compared on the confusion keys too, so "yzer"
  // (y typed for ij) still matches "ijzer".
  if (q[0] !== c[0] && confusionKey(query)[0] !== confusionKey(candidate)[0]) return false;
  return learnerDistance(query, candidate) <= typoBudget(query);
}

/** At most `max` candidates that are typos of the query, closest first,
 *  then by frequency (lower rank = more common). */
export function rankTypos<T extends { form: string; frequency: number }>(query: string, candidates: T[], max = 3): T[] {
  const seen = new Set<string>();
  return candidates
    .filter((c) => isTypoOf(query, c.form))
    .map((c) => ({ c, d: learnerDistance(query, c.form) }))
    .sort((x, y) => x.d - y.d || x.c.frequency - y.c.frequency)
    .map((x) => x.c)
    .filter((c) => {
      const k = searchKey(c.form);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, max);
}
