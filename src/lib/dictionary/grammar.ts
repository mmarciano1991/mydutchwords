/* ──────────────────────────────────────────────────────────────────────────
   grammar — why a lookup shows a different word than the one typed.

   A lookup reaches a word's headword from any of its inflected forms
   ("liep" → lopen, "huizen" → huis). The card shows the headword — the
   infinitive for a verb — and this explains the step in one line, in the
   result card's grammar explanation: "Past tense of lopen."

   The explanation comes from the dictionary's own tags on the matched form
   (Use.forms), never from the spelling, so irregular forms ("ging",
   "geweest", "beter") are explained exactly when the dictionary lists them.
   Only verbs, nouns and adjectives are explained; any other form, or a form
   the tags don't describe, gets no explanation rather than a guess.
   ────────────────────────────────────────────────────────────────────────── */
import type { Pos, Use } from "./model";
import { searchKey } from "./normalize";

/** How the typed form reached the word (lookup's WordMatch.via). */
export type MatchVia = "lemma" | "form" | "variant" | "expansion";

/** Tag sets of every entry of `form` in the use — a form can be several
 *  ("liep": past, 1st, 2nd and 3rd person singular). */
function tagSetsOf(use: Use, form: string): string[][] {
  const key = searchKey(form);
  return use.forms.filter((f) => searchKey(f.form) === key).map((f) => f.tags);
}

const has = (sets: string[][], ...tags: string[]) => sets.some((s) => tags.every((t) => s.includes(t)));

/** The relation, as "Past tense", or null when the tags don't say. Checked
 *  most specific first: a past participle is not just "past". */
function relation(pos: Pos, sets: string[][]): string | null {
  if (pos === "verb") {
    // An infinitive form is the headword itself (plural present "lopen" too).
    if (has(sets, "infinitive")) return null;
    if (has(sets, "participle", "past")) return "Past participle";
    if (has(sets, "participle", "present")) return "Present participle";
    if (has(sets, "past")) return "Past tense";
    if (has(sets, "present")) return "Present tense";
    if (has(sets, "imperative")) return "Imperative";
    return null;
  }
  if (pos === "noun") {
    if (has(sets, "diminutive", "plural")) return "Plural diminutive";
    if (has(sets, "diminutive")) return "Diminutive";
    if (has(sets, "plural")) return "Plural";
    return null;
  }
  if (pos === "adjective") {
    if (has(sets, "superlative")) return "Superlative";
    if (has(sets, "comparative")) return "Comparative";
    if (has(sets, "positive") || has(sets, "indefinite") || has(sets, "definite")) return "Inflected form";
    return null;
  }
  return null;
}

/** One line for the grammar explanation, or null when there is nothing to
 *  explain (the headword itself was typed, or the relation is unknown). */
export function grammarNote(
  headword: string,
  use: Use,
  match: { via: MatchVia; matched: string }
): string | null {
  if (searchKey(match.matched) === searchKey(headword)) return null;
  if (match.via === "variant") return `Other spelling of ${headword}.`;
  if (match.via !== "form") return null;
  const rel = relation(use.pos, tagSetsOf(use, match.matched));
  return rel ? `${rel} of ${headword}.` : null;
}
