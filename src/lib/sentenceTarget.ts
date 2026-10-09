/* sentenceTarget — where a word sits in its context sentence, in the exact
   form the sentence uses ("doet", not "doen").

   Used to blank the word for Sentence Completion and to highlight it in the
   context sentence shown after every graded answer.

   The form is found, not stored: the headword itself if it appears once as
   a whole word, otherwise the one token that deinflects back to it ("ga" →
   gaan, "bloemen" → bloem). A sentence where the word can't be pinned to
   exactly one token is not eligible for Sentence Completion — that includes
   a separable verb whose parts are split ("Ik bel je op" for opbellen),
   since neither part on its own is the word.

   Pure and synchronous. */
import { deinflect } from "./deinflect";
import type { DictionaryEntry } from "./types";

/** Same word shape as tokenizeText: letters, inner apostrophes/hyphens. */
const WORD = /'?[A-Za-zÀ-ÿ]+(?:['-][A-Za-zÀ-ÿ]+)*/g;

export interface TargetForm {
  /** The word as written in the sentence. */
  form: string;
  start: number;
  end: number;
}

/** The single occurrence of `headword` in `sentence`, in whatever form the
 *  sentence uses — or null when there is none, or more than one. */
export function findTargetForm(sentence: string, headword: string): TargetForm | null {
  const lemma = headword.trim().toLowerCase();
  if (!/^[a-zà-ÿ]+(?:['-][a-zà-ÿ]+)*$/.test(lemma)) return null; // multi-word entries

  const tokens = [...sentence.matchAll(WORD)].map((m) => ({ form: m[0], start: m.index!, end: m.index! + m[0].length }));

  const exact = tokens.filter((t) => t.form.toLowerCase() === lemma);
  if (exact.length > 0) return exact.length === 1 ? exact[0] : null;

  const inflected = tokens.filter((t) => deinflect(t.form, (l) => l === lemma).some((d) => d.lemma === lemma));
  return inflected.length === 1 ? inflected[0] : null;
}

export interface ContextSentence {
  sentence: string;
  /** English translation of the sentence — null for a captured sentence,
   *  which is stored in Dutch only. */
  translation: string | null;
  /** Where the word is, when it can be pinned down. */
  target: TargetForm | null;
  source: "captured" | "example";
}

/** The sentence to show with a word: the one the user captured it from if
 *  it has one, else the dictionary example. */
export function contextSentence(entry: DictionaryEntry): ContextSentence | null {
  if (entry.metIn?.trim()) {
    return { sentence: entry.metIn, translation: null, target: findTargetForm(entry.metIn, entry.dutch), source: "captured" };
  }
  if (entry.example?.trim()) {
    return {
      sentence: entry.example,
      translation: entry.exampleEn || null,
      target: findTargetForm(entry.example, entry.dutch),
      source: "example",
    };
  }
  return null;
}

/** The sentence for Sentence Completion: the captured one when the word can
 *  be pinned in it, else the dictionary example; null when neither works. */
export function completionSentence(entry: DictionaryEntry): (ContextSentence & { target: TargetForm }) | null {
  const candidates: ContextSentence[] = [];
  if (entry.metIn?.trim()) candidates.push({ sentence: entry.metIn, translation: null, target: null, source: "captured" });
  if (entry.example?.trim()) {
    candidates.push({ sentence: entry.example, translation: entry.exampleEn || null, target: null, source: "example" });
  }
  for (const c of candidates) {
    const target = findTargetForm(c.sentence, entry.dutch);
    if (target) return { ...c, target };
  }
  return null;
}
