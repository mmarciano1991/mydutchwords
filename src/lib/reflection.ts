/* reflection — the monthly "then vs now" moment.

   Not a points total. It answers one question from the learner's own
   history: what can I do now that I couldn't do 30 days ago?

     - the words they didn't know then and know now (by name, not just a count)
     - how many older words are still holding
     - how much of a real letter they can read, then against now

   "Known at time T" has one definition throughout: the word's most recent
   graded answer before T was "I knew it". That is what lets "then" be
   reconstructed from the practice log rather than stored.

   Pure: the caller supplies the log, the clock and a way to name a word. */
import { FUNCTION_WORDS, REAL_TEXTS } from "../data/realTexts";
import { deinflect } from "./deinflect";
import { REFLECTION_INTERVAL_DAYS } from "./habit";
import { tokenizeText } from "./tokenizeText";
import type { PracticeResult } from "./types";

/** Fewer new words than this and there is not yet a month worth reflecting on. */
export const MIN_REFLECTION_WORDS = 3;

/** Tokens with the inter-sentence spaces put back. tokenizeText splits on
 *  sentence boundaries and drops the whitespace between them, which a
 *  passage rendered for reading needs. */
function readingTokens(text: string): { text: string; isWord: boolean }[] {
  const { tokens } = tokenizeText(text);
  const out: { text: string; isWord: boolean }[] = [];
  tokens.forEach((t, i) => {
    if (i > 0 && t.sentenceIndex !== tokens[i - 1].sentenceIndex) out.push({ text: " ", isWord: false });
    out.push({ text: t.text, isWord: t.isWord });
  });
  return out;
}

export interface ReflectionToken {
  text: string;
  isWord: boolean;
  /** Counted in the percentage (a content word). */
  counted: boolean;
  knownNow: boolean;
}

export interface ReflectionText {
  name: string;
  then: number;
  now: number;
  tokens: ReflectionToken[];
}

export interface Reflection {
  /** Words learned in the window, in the order first met. */
  learned: string[];
  /** Words known before the window that are still known. */
  retained: number;
  /** The real text with the biggest gain, when there is one worth showing. */
  text: ReflectionText | null;
}

/** Ids whose latest answer before `before` (ms) was "know". */
function knownIdsBefore(results: PracticeResult[], before: number): Set<string> {
  const last = new Map<string, PracticeResult>();
  for (const r of results) {
    if (r.timestamp >= before) continue;
    const prev = last.get(r.entryId);
    if (!prev || r.timestamp >= prev.timestamp) last.set(r.entryId, r);
  }
  return new Set([...last].filter(([, r]) => r.grade === "know").map(([id]) => id));
}

/** Deck ids → the bare Dutch headwords they name ("aanslag#1" → "aanslag").
 *  The same split as wordSources.parseSenseKey, inlined so this module stays
 *  free of the dictionary. */
function baseWords(ids: Set<string>): Set<string> {
  return new Set([...ids].map((id) => id.replace(/#\d+$/, "")));
}

function coverage(
  tokens: { text: string; isWord: boolean }[],
  known: Set<string>,
  practised: Set<string>
): { pct: number; marks: boolean[] } {
  let counted = 0;
  let hit = 0;
  const marks = tokens.map((t) => {
    if (!t.isWord) return false;
    const word = t.text.toLowerCase();
    if (FUNCTION_WORDS.has(word)) return false;
    counted++;
    const isKnown =
      known.has(word) ||
      deinflect(word, (lemma) => practised.has(lemma)).some((d) => known.has(d.lemma));
    if (isKnown) hit++;
    return isKnown;
  });
  return { pct: counted === 0 ? 0 : Math.round((hit / counted) * 100), marks };
}

export function buildReflection(
  results: PracticeResult[],
  now: Date,
  nameOf: (id: string) => string | undefined
): Reflection {
  const windowStart = now.getTime() - REFLECTION_INTERVAL_DAYS * 86_400_000;
  const knownThen = knownIdsBefore(results, windowStart);
  const knownNow = knownIdsBefore(results, Number.POSITIVE_INFINITY);

  // First time each id was ever answered — "met" in the window or before it.
  const firstSeen = new Map<string, number>();
  for (const r of results) {
    const t = firstSeen.get(r.entryId);
    if (t === undefined || r.timestamp < t) firstSeen.set(r.entryId, r.timestamp);
  }

  const learned = [...knownNow]
    .filter((id) => !knownThen.has(id))
    .sort((a, b) => (firstSeen.get(a) ?? 0) - (firstSeen.get(b) ?? 0))
    .map((id) => nameOf(id))
    .filter((w): w is string => Boolean(w));
  const uniqueLearned = [...new Set(learned)];

  const retained = [...knownThen].filter((id) => knownNow.has(id)).length;

  // Real texts: pick the one the learner has gained the most on.
  const thenWords = baseWords(knownThen);
  const nowWords = baseWords(knownNow);
  const practised = baseWords(new Set(firstSeen.keys()));
  let best: ReflectionText | null = null;
  for (const real of REAL_TEXTS) {
    const tokens = readingTokens(real.text);
    const then = coverage(tokens, thenWords, practised);
    const current = coverage(tokens, nowWords, practised);
    if (current.pct - then.pct < 5) continue;
    if (best && current.pct - then.pct <= best.now - best.then) continue;
    best = {
      name: real.name,
      then: then.pct,
      now: current.pct,
      tokens: tokens.map((t, i) => ({
        text: t.text,
        isWord: t.isWord,
        counted: t.isWord && !FUNCTION_WORDS.has(t.text.toLowerCase()),
        knownNow: current.marks[i],
      })),
    };
  }

  return { learned: uniqueLearned, retained, text: best };
}

/** Whether there is enough change to be worth a moment of the user's time. */
export function hasSomethingToShow(reflection: Reflection): boolean {
  return reflection.learned.length >= MIN_REFLECTION_WORDS || reflection.text !== null;
}
