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
   candidate nothing matches, which costs nothing and never surfaces. That
   is what makes it safe to be generous with rules: the dictionary is the
   only thing that can turn a candidate into an answer.

   It does NOT stop at the first real hit: "sloten" is the plural of both
   "slot" (lock) and "sloot" (ditch), and the bundled dictionary has both
   singulars, so returning on the first match would silently assert one of
   them and never offer the other. Every real candidate is returned;
   the caller decides what to do with more than one (see Capture.tsx, which
   offers them as a choice — the same shape as picking a word sense).

   ── Coverage ──────────────────────────────────────────────────────────────
   The rule set below covers, for each of the shapes Dutch actually writes:

     nouns       -s / -en / -'s plurals, stem-changing and Latin plurals,
                 -je / -tje diminutives
     verbs       present (stem, -t), weak past (-de/-te/-den/-ten), weak
                 past participles with and without "ge-" (be-/ver-/ont-/
                 her-/er- block it), strong/irregular forms by table, and
                 separable prefixes wrapped around any of the above
     adjectives  -e agreement, -er/-der comparative, -st/-ste superlative,
                 and the suppletive degrees (goed → beter → best)

   Getting from a verb form back to the infinitive is the part that needs
   real spelling knowledge rather than suffix-stripping, because Dutch
   respells the stem as endings open and close its final syllable — see
   `infinitivesFromStem`.

   Pure, synchronous, no I/O — same shape as learningEngine.ts. What can't
   be derived at all (ablaut: "gestegen" from "stijgen") lives in
   data/irregularForms.ts, checked first.
   ────────────────────────────────────────────────────────────────────────── */
import {
  IRREGULAR_COMPARATIVES,
  IRREGULAR_PRESENTS,
  IRREGULAR_PARTICIPLES,
  IRREGULAR_PLURALS,
  IRREGULAR_PRETERITES,
  IRREGULAR_SUPERLATIVES,
  SEPARABLE_PREFIXES,
} from "../data/irregularForms";

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

/** The reverse of the above, needed going the other way: a verb stem is
 *  written closed ("loop") but its infinitive opens the syllable and drops
 *  one vowel ("lopen"). Returns the single-vowel form, or null when the
 *  stem doesn't end in a doubled vowel plus one consonant. */
function withUndoubledVowel(stem: string): string | null {
  const m = stem.match(/^(.*)([aeiou])\2([^aeiou])$/);
  return m ? `${m[1]}${m[2]}${m[3]}` : null;
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

/** The reverse of withDoubledConsonant, for going from an inflected form
 *  back to the base: "man" doubles its final consonant before a vowel-initial
 *  ending ("mannen", "mannetje"), so stripping the ending leaves "mann".
 *  Returns the single-consonant form, or null when the stem doesn't end in a
 *  doubled consonant. Load-bearing for one of the commonest plurals in the
 *  language — mannen, bussen, sterren, pennen — which resolved to nothing
 *  without it. */
function withUndoubledConsonant(stem: string): string | null {
  const m = stem.match(/^(.*[aeiou])([^aeiou])\2$/);
  return m ? `${m[1]}${m[2]}` : null;
}

/** Both spelling repairs a stripped suffix can need, as candidates: the
 *  vowel doubled back (afsprak → afspraak) or the consonant halved (mann →
 *  man). They apply to different shapes, so at most one ever fires. */
function respellings(stem: string): string[] {
  const out = [stem];
  const doubledVowel = withDoubledVowel(stem);
  if (doubledVowel) out.push(doubledVowel);
  const undoubledConsonant = withUndoubledConsonant(stem);
  if (undoubledConsonant) out.push(undoubledConsonant);
  return out;
}

/** Dutch devoices a final consonant in writing as well as in speech, so a
 *  verb stem ends in "s"/"f" where the infinitive has "z"/"v" ("verhuis" →
 *  "verhuizen", "leef" → "leven"). Returns the voiced form, or null. */
function withVoicedEnding(stem: string): string | null {
  if (stem.endsWith("s")) return `${stem.slice(0, -1)}z`;
  if (stem.endsWith("f")) return `${stem.slice(0, -1)}v`;
  return null;
}

/** Every infinitive a verb stem could plausibly belong to.
 *
 *  This is the one place that needs to know Dutch spelling rather than just
 *  strip letters, because the stem and the infinitive are written
 *  differently whenever the "-en" ending opens the stem's final syllable:
 *
 *    werk  → werken     (nothing changes; the syllable was already closed)
 *    loop  → lopen      (doubled vowel collapses — withUndoubledVowel)
 *    bel   → bellen     (consonant doubles — withDoubledConsonant)
 *    verhuis → verhuizen (final s is really a z — withVoicedEnding)
 *    leef  → leven      (both: undouble the vowel AND voice the f)
 *
 *  All variants are returned rather than the "most likely" one: only a real
 *  word survives the caller's dictionary check, and the wrong ones cost a
 *  Map lookup each. */
function infinitivesFromStem(stem: string): string[] {
  if (stem.length < 2) return [];
  const stems = new Set<string>([stem]);
  const undoubled = withUndoubledVowel(stem);
  if (undoubled) stems.add(undoubled);
  const doubled = withDoubledConsonant(stem);
  if (doubled) stems.add(doubled);

  const out = new Set<string>();
  for (const s of stems) {
    out.add(`${s}en`);
    const voiced = withVoicedEnding(s);
    if (voiced) out.add(`${voiced}en`);
  }
  return Array.from(out);
}

/** Unstressed prefixes that block the "ge-" of a past participle, which is
 *  why "betaald" and "verhuisd" look like bare stems plus an ending. */
const GE_BLOCKING_PREFIXES = ["be", "ver", "ont", "her", "er", "ge"];

interface Rule {
  reason: string;
  /** Base forms to try. Never includes `word` itself. All are tested — this
   *  is not "most likely first", since every real hit is kept. */
  candidates: (word: string) => string[];
}

/** The specific patterns, checked before the generic fallback below. Order
 *  doesn't gate correctness (every rule's real hits are kept regardless of
 *  position) — results are deduplicated by lemma as they're collected. */
const RULES: Rule[] = [
  /* ── nouns ───────────────────────────────────────────────────────────── */
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
      return respellings(w.slice(0, -2));
    },
  },
  {
    // kinderen → kind, eieren → ei: the "-eren" plural, a closed class but
    // one that contains some of the first nouns anyone meets.
    reason: "plural",
    candidates: (w) => (isPlainWord(w, 6) && w.endsWith("eren") ? [w.slice(0, -4)] : []),
  },
  {
    // gemeenten → gemeente, gedachten → gedachte: a noun that already ends
    // in "-e" pluralises with a bare "-n", so the "-en" rule above strips one
    // letter too many and finds nothing.
    reason: "plural",
    candidates: (w) => {
      if (!isPlainWord(w, 5) || !w.endsWith("n")) return [];
      const stem = w.slice(0, -1);
      return stem.endsWith("e") ? [stem] : [];
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

  /* ── adjectives ──────────────────────────────────────────────────────── */
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
      return respellings(w.slice(0, -2));
    },
  },
  {
    // grootst → groot, kleinste → klein, hoogst → hoog. Both the bare "-st"
    // and the inflected "-ste" reach the same base.
    reason: "superlative",
    candidates: (w) => {
      if (!isPlainWord(w, 5)) return [];
      let stem: string | null = null;
      if (w.endsWith("ste")) stem = w.slice(0, -3);
      else if (w.endsWith("st")) stem = w.slice(0, -2);
      if (stem === null || stem.length < 2) return [];
      return respellings(stem);
    },
  },

  /* ── verbs ───────────────────────────────────────────────────────────── */
  {
    // The bare present stem: "werk" → werken, "loop" → lopen, "bel" →
    // bellen. This is also the imperative and the first-person singular, so
    // it's how a verb most often appears at the start of a sentence.
    reason: "present tense",
    candidates: (w) => (isPlainWord(w, 3) ? infinitivesFromStem(w) : []),
  },
  {
    // Second/third person singular: stem + "t". "werkt" → werken, "loopt" →
    // lopen, "betaalt" → betalen.
    reason: "present tense",
    candidates: (w) =>
      isPlainWord(w, 4) && w.endsWith("t") ? infinitivesFromStem(w.slice(0, -1)) : [],
  },
  {
    // Weak past tense, singular and plural: stem + de/te/den/ten. "werkte"
    // → werken, "huurden" → huren, "betaalde" → betalen.
    reason: "past tense",
    candidates: (w) => {
      if (!isPlainWord(w, 5)) return [];
      for (const ending of ["den", "ten", "de", "te"]) {
        if (w.endsWith(ending)) return infinitivesFromStem(w.slice(0, -ending.length));
      }
      return [];
    },
  },
  {
    // Regular (weak) past participles: ge-…-d/-t → the -en infinitive.
    // gewerkt → werk → werken; gebeld → bel → bellen.
    reason: "past participle",
    candidates: (w) => {
      if (!isPlainWord(w, 6) || !w.startsWith("ge") || !/[dt]$/.test(w)) return [];
      // Both readings of the final letter: it's usually the participle's own
      // ending (gewerkt → werk), but when the stem ALREADY ends in d/t no
      // extra one is added (gewacht → wacht, not "wach"), and stripping it
      // then loses the verb entirely.
      return [...infinitivesFromStem(w.slice(2, -1)), ...infinitivesFromStem(w.slice(2))];
    },
  },
  {
    // Weak past participles that never take "ge-", because an unstressed
    // prefix already occupies that slot: "betaald" → betalen, "verhuisd" →
    // verhuizen, "ontmoet" → ontmoeten. Without this they look exactly like
    // a present-tense "-t" form and resolve to nothing.
    reason: "past participle",
    candidates: (w) => {
      if (!isPlainWord(w, 5) || !/[dt]$/.test(w)) return [];
      if (!GE_BLOCKING_PREFIXES.some((p) => w.startsWith(p))) return [];
      return [...infinitivesFromStem(w.slice(0, -1)), ...infinitivesFromStem(w)];
    },
  },
];

/** Adjective agreement: "aanhoudende" is "aanhoudend" plus the -e ending
 *  Dutch adjectives take before a noun. This is deliberately the LAST thing
 *  tried, never merged with RULES above (see deinflect): stripping a bare
 *  trailing "e" is the least specific pattern here — nearly any word could
 *  coincidentally end in one — so it only runs once every more specific
 *  rule has already come back empty, the same way the irregular tables are
 *  checked before the specific rules rather than folded in among them. */
const AGREEMENT_RULE: Rule = {
  reason: "adjective agreement",
  candidates: (w) => {
    // Four letters, not five: "hele" (heel), "late" (laat) and "rode" (rood)
    // are ordinary agreement forms that a five-letter floor never reached.
    if (!isPlainWord(w, 4) || !w.endsWith("e")) return [];
    return respellings(w.slice(0, -1));
  },
};

/** A candidate before the dictionary has confirmed it. */
type Candidate = Deinflection;

/** Every table lookup for this exact form, each carrying the grammatical
 *  relation its table stands for — the tables are split by relation purely
 *  so the learner is told "past tense" or "past participle" rather than a
 *  vaguer catch-all. */
const IRREGULAR_TABLES: ReadonlyArray<readonly [Record<string, string>, string]> = [
  [IRREGULAR_PARTICIPLES, "past participle"],
  [IRREGULAR_PRESENTS, "present tense"],
  [IRREGULAR_PRETERITES, "past tense"],
  [IRREGULAR_PLURALS, "plural"],
  [IRREGULAR_COMPARATIVES, "comparative"],
  [IRREGULAR_SUPERLATIVES, "superlative"],
];

function irregularCandidates(q: string): Candidate[] {
  const out: Candidate[] = [];
  for (const [table, reason] of IRREGULAR_TABLES) {
    const lemma = table[q];
    if (lemma) out.push({ lemma, reason });
  }
  return out;
}

/** Every candidate from the specific rules — irregular tables first, then
 *  the suffix rules, then separable prefixes wrapped around both.
 *
 *  `depth` guards the separable-prefix recursion, which is the only rule
 *  that calls back into this function. One level is all Dutch needs
 *  ("opgenomen" → "op" + "genomen"); a second would only ever fire on a
 *  double prefix that doesn't occur. */
function primaryCandidates(q: string, depth: number): Candidate[] {
  const out: Candidate[] = [...irregularCandidates(q)];

  for (const rule of RULES) {
    for (const lemma of rule.candidates(q)) {
      out.push({ lemma, reason: rule.reason });
    }
  }

  // Separable verbs write the participle's "ge-" inside the compound
  // ("opgenomen", not "geopnemen"), and the same goes for a separable
  // weak participle ("uitgelegd") or an irregular one ("aangekomen"). Peel
  // the prefix, resolve what's left with every rule above, and put the
  // prefix back on whatever that produced.
  if (depth > 0) {
    for (const prefix of SEPARABLE_PREFIXES) {
      if (!q.startsWith(prefix)) continue;
      const rest = q.slice(prefix.length);
      // Only the "ge-" shape is peeled: without this guard the prefix list
      // would also strip the first syllable of ordinary words that merely
      // begin with those letters ("inkomen", "overleg").
      if (!rest.startsWith("ge") || rest.length < 4) continue;
      for (const inner of primaryCandidates(rest, depth - 1)) {
        out.push({ lemma: `${prefix}${inner.lemma}`, reason: inner.reason });
      }
    }
  }

  return out;
}

/** Keeps every candidate `lookup` confirms as a real word, deduplicated by
 *  lemma (a word can't be its own inflection). */
function confirm(q: string, candidates: Candidate[], lookup: (t: string) => boolean): Deinflection[] {
  const hits: Deinflection[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (!c.lemma || c.lemma === q || seen.has(c.lemma)) continue;
    if (!lookup(c.lemma)) continue;
    hits.push(c);
    seen.add(c.lemma);
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
 * Irregular forms are checked first, since no suffix rule derives "stijgen"
 * from "gestegen". The regular rules run next, together — if any of them
 * find a real word, that's the answer (ambiguous or not) and the generic
 * adjective-agreement fallback never runs, since a bare trailing "-e" is
 * the least specific pattern here and would just add noise to an
 * already-resolved case.
 */
export function deinflect(word: string, lookup: (term: string) => boolean): Deinflection[] {
  const raw = word.trim().toLowerCase();

  // "auto's", "foto's": the only plural written with punctuation, so it has
  // to be handled before the plain-letters guard rejects the apostrophe.
  if (raw.endsWith("'s")) {
    const base = raw.slice(0, -2);
    return isPlainWord(base, 3) ? confirm(raw, [{ lemma: base, reason: "plural" }], lookup) : [];
  }

  // Two letters, not three. The suffix rules below each carry their own
  // (longer) minimum, so this floor only governs the irregular tables — and
  // those are exact matches on some of the most frequent words in the
  // language: "ga" (gaan), "is" (zijn), "at" (eten). Excluding them meant an
  // example sentence like "Ik ga nu naar huis" did not count as demonstrating
  // "gaan".
  if (!isPlainWord(raw, 2)) return [];

  const hits = confirm(raw, primaryCandidates(raw, 1), lookup);
  if (hits.length > 0) return hits;

  return confirm(raw, AGREEMENT_RULE.candidates(raw).map((lemma) => ({ lemma, reason: AGREEMENT_RULE.reason })), lookup);
}
