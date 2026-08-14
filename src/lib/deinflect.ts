/* ──────────────────────────────────────────────────────────────────────────
   deinflect — turns a Dutch word the dictionary doesn't recognise into a
   base form it might, and says which grammatical relation got there.

   Article and letter Dutch is inflected, and the capture screen was matching
   only the exact headword: "huurders" missed even though "huurder" is
   bundled, and the near-match suggestion offered instead ("terwijl" for
   "termijn") was often further from the truth than no suggestion at all.

   This module doesn't decide what's "found" — it proposes candidate lemmas
   and lets the caller's own dictionary be the judge, via the `lookup`
   predicate. A rule that's wrong about Dutch morphology just produces a
   candidate nothing matches, which costs nothing and never surfaces: the
   only way this returns non-null is a real dictionary hit, so an incorrect
   guess (of the "gestegen → gisteren" kind the suggestion list used to make)
   isn't a failure mode this module has.

   Pure, synchronous, no I/O — same shape as learningEngine.ts. Irregular
   verbs (stijgen → gestegen is ablaut, not suffixation) can't be derived by
   stripping endings; those live in data/irregularVerbs.ts, checked first.
   ────────────────────────────────────────────────────────────────────────── */
import { IRREGULAR_PARTICIPLES } from "../data/irregularVerbs";

export interface Deinflection {
  /** The base form that was actually found in the dictionary. */
  lemma: string;
  /** Human-readable grammatical relation, shown as "word → lemma (reason)". */
  reason: string;
}

const VOWELS = "aeiou";

/** True for a plain a–z string of at least `min` letters — every rule below
 *  only fires on ordinary lowercase headwords, never on something already
 *  carrying a space, hyphen, or digit that a suffix strip would mangle. */
function isPlainWord(word: string, min: number): boolean {
  return word.length >= min && /^[a-z]+$/.test(word);
}

/** Spelling-driven variant of `stem`: Dutch writes a long vowel as a single
 *  letter in an open syllable but doubled in a closed one, so a suffix that
 *  opens the final syllable often shortens "aa" → "a" in the process
 *  ("afspraak" → "afspraken"). If `stem` ends in exactly one consonant, one
 *  vowel, one consonant — the closed-syllable shape that pattern reverses —
 *  this returns the form with that vowel doubled back; otherwise null. */
function withDoubledVowel(stem: string): string | null {
  const m = stem.match(/^(.*[^aeiou])([aeiou])([^aeiou])$/);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[2]}${m[3]}`;
}

/** The mirror image: adding a vowel-initial suffix to a stem ending in a
 *  single short vowel then a single consonant would otherwise lengthen that
 *  vowel ("bel" + "en" reads as "be-len"), so Dutch spelling doubles the
 *  consonant instead ("bel" + "len" = "bellen"). Returns the doubled form,
 *  or null if `stem` doesn't end in that short-vowel shape. */
function withDoubledConsonant(stem: string): string | null {
  const m = stem.match(/^(.*)([aeiou])([^aeiou])$/);
  if (!m || VOWELS.includes(m[1].slice(-1))) return null; // needs a SINGLE vowel, not "aa"/"oe"/…
  return `${m[1]}${m[2]}${m[3]}${m[3]}`;
}

interface Rule {
  reason: string;
  /** Base forms to try, most likely first. Never includes `word` itself. */
  candidates: (word: string) => string[];
}

const RULES: Rule[] = [
  {
    // huurders → huurder, aanvragers → aanvrager: agent nouns and other -s
    // plurals. Broad on purpose — see the module comment on why an
    // over-eager candidate is harmless.
    reason: "plural",
    candidates: (w) => (isPlainWord(w, 4) && w.endsWith("s") ? [w.slice(0, -1)] : []),
  },
  {
    // maatregelen → maatregel (plain strip); afspraken → afspraak (the
    // stripped stem is also tried with its vowel doubled back).
    reason: "plural",
    candidates: (w) => {
      if (!isPlainWord(w, 5) || !w.endsWith("en")) return [];
      const stem = w.slice(0, -2);
      const doubled = withDoubledVowel(stem);
      return doubled ? [stem, doubled] : [stem];
    },
  },
  {
    // duurder → duur: "-er" becomes "-der" after a stem already ending in
    // "r", so the comparative suffix here is "der", not "er" + an extra r.
    reason: "comparative",
    candidates: (w) => (isPlainWord(w, 5) && w.endsWith("der") ? [w.slice(0, -3)] : []),
  },
  {
    // kleiner → klein (plain strip); groter → groot (vowel doubled back).
    reason: "comparative",
    candidates: (w) => {
      if (!isPlainWord(w, 4) || !w.endsWith("er")) return [];
      const stem = w.slice(0, -2);
      const doubled = withDoubledVowel(stem);
      return doubled ? [stem, doubled] : [stem];
    },
  },
  {
    // huisje → huis, kopje → kop: the two common diminutive endings.
    reason: "diminutive",
    candidates: (w) => {
      if (!isPlainWord(w, 5)) return [];
      if (w.endsWith("tje")) return [w.slice(0, -3)];
      if (w.endsWith("je")) return [w.slice(0, -2)];
      return [];
    },
  },
  {
    // Regular (weak) past participles: ge-…-d/-t → the -en infinitive.
    // gewerkt → werkt → werk → werken (no doubling needed, "werk" already
    // ends in two consonants). gebeld → beld → bel → bellen (the vowel-
    // consonant doubling above applies, since "bel" ends in a single short
    // vowel + single consonant). Both candidates are offered; only one will
    // ever be a real word.
    reason: "past participle",
    candidates: (w) => {
      if (!isPlainWord(w, 6) || !w.startsWith("ge") || !/[dt]$/.test(w)) return [];
      const stem = w.slice(2, -1); // drop "ge…" prefix and the final d/t
      const plain = `${stem}en`;
      const doubled = withDoubledConsonant(stem);
      return doubled ? [plain, `${doubled}en`] : [plain];
    },
  },
];

/**
 * Explains a word the dictionary missed, by testing candidate base forms
 * against `lookup` (typically `wordSources.lookupLocal`, wrapped to return a
 * boolean) until one is a real hit. Irregular participles are checked first,
 * since no suffix rule derives "stijgen" from "gestegen"; everything else
 * follows regular Dutch morphology, tried in the order above.
 */
export function deinflect(word: string, lookup: (term: string) => boolean): Deinflection | null {
  const q = word.trim().toLowerCase();
  if (!isPlainWord(q, 3)) return null;

  const irregular = IRREGULAR_PARTICIPLES[q];
  if (irregular && irregular !== q && lookup(irregular)) {
    return { lemma: irregular, reason: "past participle" };
  }

  for (const rule of RULES) {
    for (const candidate of rule.candidates(q)) {
      if (candidate && candidate !== q && lookup(candidate)) {
        return { lemma: candidate, reason: rule.reason };
      }
    }
  }
  return null;
}
