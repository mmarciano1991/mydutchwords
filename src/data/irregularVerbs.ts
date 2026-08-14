/* Irregular past participles — a small hand-authored overlay, the same
   pattern as src/data/senses.ts: not an attempt at a complete list of Dutch
   strong verbs, just the ones this app has actually met a learner miss.
   Strong verbs change their stem vowel rather than just adding an ending
   (stijgen → gestegen, not "gestijgd"), and separable/inseparable-prefix
   verbs can insert or drop "ge-" in ways no suffix rule can derive
   (toenemen → toegenomen, with "ge" moving inside the compound; verbieden →
   verboden, with no "ge" at all because "ver-" already blocks it). Neither
   is mechanically derivable from the inflected form — hence the list rather
   than a rule.

   Extend it the same way as senses.ts: add an entry, no build step. */
export const IRREGULAR_PARTICIPLES: Record<string, string> = {
  gestegen: "stijgen", // to rise — ablaut (ij → e)
  toegenomen: "toenemen", // to increase — compound verb, ablaut (ij → o series via nemen)
  verboden: "verbieden", // to forbid — ablaut (ie → o), "ver-" blocks "ge-"
};
