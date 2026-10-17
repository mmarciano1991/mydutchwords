/* sentenceTarget — where a word sits in its context sentence, in the exact
   form the sentence uses ("doet", not "doen"), and in two places for a
   split separable verb ("Ik bel je morgen op": bel … op).

   Used to blank the word for Sentence Completion and to highlight it in the
   context sentence shown after every graded answer.

   A dictionary example carries its target spans (found and checked by the
   build). A captured sentence is searched with the sense's own inflected
   forms; an entry saved before the server dictionary falls back to
   deinflection. A sentence where the word can't be pinned down is not used
   for Sentence Completion.

   Pure and synchronous. */
import { findTargetSpans } from "./dictionary/checks";
import { deinflect } from "./deinflect";
import type { DictionaryEntry } from "./types";

/** Same word shape as tokenizeText: letters, inner apostrophes/hyphens. */
const WORD = /'?[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu;

export interface TargetPart {
  form: string;
  start: number;
  end: number;
}

export interface TargetForm extends TargetPart {
  /** Every part, in order — two for a split separable verb. The fields
   *  above are the first part, for readers that only need one. */
  parts: TargetPart[];
  /** What the learner types: the parts, space-separated ("bel op"). */
  answer: string;
}

function fromSpans(sentence: string, spans: [number, number][]): TargetForm | null {
  if (!spans.length) return null;
  const parts = spans.map(([start, end]) => ({ form: sentence.slice(start, end), start, end }));
  if (parts.some((p) => !p.form.trim())) return null;
  return { ...parts[0], parts, answer: parts.map((p) => p.form).join(" ") };
}

/** Legacy path: the single occurrence of `headword`, exact or inflected. */
export function findTargetForm(sentence: string, headword: string): TargetForm | null {
  const lemma = headword.trim().toLowerCase();
  if (!/^[\p{Ll}]+(?:['-][\p{Ll}]+)*$/u.test(lemma)) return null; // multi-word entries
  const tokens = [...sentence.matchAll(WORD)].map((m) => ({ form: m[0], start: m.index!, end: m.index! + m[0].length }));
  const exact = tokens.filter((t) => t.form.toLowerCase() === lemma);
  const one = (t: TargetPart) => ({ ...t, parts: [t], answer: t.form });
  if (exact.length > 0) return exact.length === 1 ? one(exact[0]) : null;
  const inflected = tokens.filter((t) => deinflect(t.form, (l) => l === lemma).some((d) => d.lemma === lemma));
  return inflected.length === 1 ? one(inflected[0]) : null;
}

/** Where the entry's word is in `sentence`, by its own forms. */
export function targetIn(sentence: string, entry: DictionaryEntry): TargetForm | null {
  const s = entry.snapshot;
  if (!s) return findTargetForm(sentence, entry.dutch);
  const spans = findTargetSpans(sentence, [s.form, ...s.forms.map((f) => f.form)]);
  return spans ? fromSpans(sentence, spans) : null;
}

export interface ContextSentence {
  sentence: string;
  /** English translation — null for a captured sentence, which is stored
   *  in Dutch only. */
  translation: string | null;
  /** Where the word is, when it can be pinned down. */
  target: TargetForm | null;
  source: "captured" | "example";
}

/** The dictionary example, with its stored spans. */
function exampleContext(entry: DictionaryEntry): ContextSentence | null {
  const ex = entry.snapshot?.examples[0];
  if (ex) {
    const target = ex.targetSpans.length ? fromSpans(ex.nl, ex.targetSpans) : targetIn(ex.nl, entry);
    return { sentence: ex.nl, translation: ex.en || null, target, source: "example" };
  }
  if (!entry.snapshot && entry.example?.trim()) {
    return { sentence: entry.example, translation: entry.exampleEn || null, target: findTargetForm(entry.example, entry.dutch), source: "example" };
  }
  return null;
}

/** The sentence to show with a word: the one the learner captured it from,
 *  else the dictionary example. Never another sense's example. */
export function contextSentence(entry: DictionaryEntry): ContextSentence | null {
  if (entry.metIn?.trim()) {
    return { sentence: entry.metIn, translation: null, target: targetIn(entry.metIn, entry), source: "captured" };
  }
  return exampleContext(entry);
}

/** The sentence for Sentence Completion: the captured one when the word can
 *  be pinned in it, else the dictionary example; null when neither works. */
export function completionSentence(entry: DictionaryEntry): (ContextSentence & { target: TargetForm }) | null {
  const candidates: ContextSentence[] = [];
  if (entry.metIn?.trim()) candidates.push({ sentence: entry.metIn, translation: null, target: targetIn(entry.metIn, entry), source: "captured" });
  const example = exampleContext(entry);
  if (example) candidates.push(example);
  for (const c of candidates) if (c.target) return c as ContextSentence & { target: TargetForm };
  return null;
}
