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
   candidate nothing matches, which costs nothing and never surfaces.

   It does NOT stop at the first real hit, though — that used to be the
   contract, and a real article broke it: "sloten" (ditches) and "slot"
   (lock) pluralise identically, and the bundled dictionary has both
   singulars, so returning on the first match silently asserted "slot" was
   right and never tried "sloot" at all. Every real candidate is returned;
   the caller decides what to do with more than one (see Capture.tsx, which
   offers them as a choice — the same shape as picking a word sense).

   Pure, synchronous, no I/O — same shape as learningEngine.ts. Irregular
   verbs (stijgen → gestegen is ablaut, not suffixation) can't be derived by
   stripping endings; those live in data/irregularVerbs.ts, checked first.
   ────────────────────────────────────────────────────────────────────────── */
import { IRREGULAR_PARTICIPLES } from "../data/irregularVerbs";

export interface Deinflection {
  /** A base form that was actually found in the dictionary. */
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
  /** Base forms to try. Never includes `word` itself. All are tested — this
   *  is not "most likely first" any more, since every real hit is kept. */
  candidates: (word: string) => string[];
}

/** The specific patterns, checked before the generic fallback below. Order
 *  doesn't gate correctness any more (every rule's real hits are kept
 *  regardless of position) — it only affects nothing observable, since
 *  results are deduplicated by lemma as they're collected. */
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
    // stripped stem is also tried with its vowel doubled back). sloten
    // matches both "slot" (plain) and "sloot" (doubled) — both real words,
    // both returned; see the module comment.
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

/** Adjective agreement: "aanhoudende" is "aanhoudend" plus the -e ending
 *  Dutch adjectives take before a noun. This is deliberately the LAST thing
 *  tried, never merged with RULES above (see deinflect): stripping a bare
 *  trailing "e" is the least specific pattern here — nearly any word could
 *  coincidentally end in one — so it only runs once every more specific
 *  rule has already come back empty, the same way the irregular list is
 *  checked before the specific rules rather than folded in among them. */
const AGREEMENT_RULE: Rule = {
  reason: "adjective agreement",
  candidates: (w) => {
    if (!isPlainWord(w, 5) || !w.endsWith("e")) return [];
    const stem = w.slice(0, -1);
    const doubled = withDoubledVowel(stem);
    return doubled ? [stem, doubled] : [stem];
  },
};

/** Runs `rules` against `q`, keeping every candidate `lookup` confirms as a
 *  real word, deduplicated by lemma (a word can't be its own inflection). */
function collectHits(q: string, rules: Rule[], lookup: (term: string) => boolean): Deinflection[] {
  const hits: Deinflection[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    for (const candidate of rule.candidates(q)) {
      if (candidate && candidate !== q && !seen.has(candidate) && lookup(candidate)) {
        hits.push({ lemma: candidate, reason: rule.reason });
        seen.add(candidate);
      }
    }
  }
  return hits;
}

/**
 * Explains a word the dictionary missed, by testing candidate base forms
 * against `lookup` (typically `wordSources.lookupLocal`, wrapped to return a
 * boolean). Returns every real dictionary hit, not just the first: Dutch
 * genuinely pluralises unrelated words identically often enough ("sloten" is
 * both "locks" and "ditches") that "first match" was itself a source of
 * confidently wrong answers — the same failure this module exists to fix.
 * An empty array means nothing suggests this word is a known inflection.
 *
 * Irregular participles are checked first, since no suffix rule derives
 * "stijgen" from "gestegen". The regular rules run next, together — if any
 * of them find a real word, that's the answer (ambiguous or not) and the
 * generic adjective-agreement fallback never runs, since a bare trailing
 * "-e" is the least specific pattern here and would just add noise to an
 * already-resolved case.
 */
export function deinflect(word: string, lookup: (term: string) => boolean): Deinflection[] {
  const q = word.trim().toLowerCase();
  if (!isPlainWord(q, 3)) return [];

  const hits: Deinflection[] = [];
  const seen = new Set<string>();

  const irregular = IRREGULAR_PARTICIPLES[q];
  if (irregular && irregular !== q && lookup(irregular)) {
    hits.push({ lemma: irregular, reason: "past participle" });
    seen.add(irregular);
  }

  for (const rule of RULES) {
    for (const candidate of rule.candidates(q)) {
      if (candidate && candidate !== q && !seen.has(candidate) && lookup(candidate)) {
        hits.push({ lemma: candidate, reason: rule.reason });
        seen.add(candidate);
      }
    }
  }
  if (hits.length > 0) return hits;

  return collectHits(q, [AGREEMENT_RULE], lookup);
}
