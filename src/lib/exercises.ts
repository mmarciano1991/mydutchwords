/* exercises — what one step of a practice sitting asks, and the queue that
   decides which word comes next.

   A sitting is no longer a fixed list walked once. It is a queue: a word
   leaves it only when it is answered correctly. A miss (or a skip) puts the
   word back a few places later — far enough that other words come in
   between, so the retry is recall and not a reflex — and the sitting ends
   when the queue is empty.

   Three ways of asking about a word, picked by how well it is known:

     choice    — English prompt, four Dutch options. Recognition: the
                 gentlest step, for a word that is new or was just missed.
     typing    — English prompt, type the Dutch. Recall: for a word that has
                 been seen, and for the retry after a missed choice (the
                 answer has just been shown — now produce it).
     flashcard — the original self-graded card, for words already well up
                 the ladder, where a quick "yes, I know it" is enough.

   Pure and synchronous: no React, no storage, no clock. Randomness is
   injectable so the tests are deterministic. */
import type { DictionaryEntry } from "./types";
import type { Word } from "./learningEngine";

export type ExerciseKind = "flashcard" | "choice" | "typing";

/** How many other words come between a miss and its retry (when there are
 *  that many left). */
export const REQUEUE_GAP = 3;

/** Options in a multiple-choice exercise, the correct one included. */
export const CHOICE_COUNT = 4;

/** Ladder level from which a word is asked as a flashcard rather than typed. */
const FLASHCARD_FROM_LEVEL = 3;

export interface QueueItem {
  id: string;
  /** Times this word has been asked in this sitting before now. */
  attempts: number;
  /** How it was asked last time — the retry steps to a different kind. */
  lastKind?: ExerciseKind;
}

export function initialQueue(ids: string[]): QueueItem[] {
  return ids.map((id) => ({ id, attempts: 0 }));
}

/** The queue after answering its head. Correct: the word leaves. Otherwise
 *  it goes back in `gap` places later — or last, when fewer are left. */
export function advanceQueue(
  queue: QueueItem[],
  correct: boolean,
  kind: ExerciseKind,
  gap = REQUEUE_GAP
): QueueItem[] {
  const [head, ...rest] = queue;
  if (!head || correct) return rest;
  const retry: QueueItem = { id: head.id, attempts: head.attempts + 1, lastKind: kind };
  const at = Math.min(gap, rest.length);
  return [...rest.slice(0, at), retry, ...rest.slice(at)];
}

/** How to ask about `word` this time.
 *  - A retry steps sideways: after a missed choice, type it (the answer was
 *    just shown); after a missed typing or flashcard, offer the choice.
 *  - First time: new words as a choice, words on their way up typed, words
 *    well up the ladder as a quick flashcard.
 *  Where four options can't be built (`canChoose` false), choice falls back
 *  to typing for a retry and to the flashcard for a new word — a brand-new
 *  word with no options is better met than guessed at. */
export function pickExercise(word: Word, item: QueueItem, canChoose: boolean): ExerciseKind {
  if (item.attempts > 0) {
    if (item.lastKind === "choice" || !canChoose) return "typing";
    return "choice";
  }
  if (word.state === "new" || word.level === 0) return canChoose ? "choice" : "flashcard";
  if (word.level >= FLASHCARD_FROM_LEVEL) return "flashcard";
  return "typing";
}

// ── Multiple choice ──

type Shape = "verb" | "noun" | "other";

/** A rough part of speech, so distractors look like plausible answers:
 *  "to meet" should be offered verbs, not "tegenwoordig". */
function shapeOf(entry: DictionaryEntry): Shape {
  if (/^to\s/i.test(entry.english.trim())) return "verb";
  if (entry.gender === "de" || entry.gender === "het") return "noun";
  return "other";
}

/** Fisher–Yates, with an injectable random source. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Four Dutch options for `answer` — itself plus three distractors drawn
 *  from `pool`, same rough part of speech first — in random order. Null when
 *  the pool can't supply three.
 *
 *  A distractor must differ from the answer in BOTH languages: a second word
 *  with the same English gloss would be a correct answer marked wrong, and a
 *  same-spelled word would be two identical buttons. */
export function buildChoices(
  answer: DictionaryEntry,
  pool: DictionaryEntry[],
  random: () => number = Math.random
): string[] | null {
  const dutch = normalize(answer.dutch);
  const english = normalize(answer.english);
  const seen = new Set([dutch]);
  const candidates: DictionaryEntry[] = [];
  for (const e of pool) {
    const d = normalize(e.dutch);
    if (seen.has(d) || normalize(e.english) === english) continue;
    seen.add(d);
    candidates.push(e);
  }

  const shape = shapeOf(answer);
  const mixed = shuffle(candidates, random);
  const ranked = [...mixed.filter((e) => shapeOf(e) === shape), ...mixed.filter((e) => shapeOf(e) !== shape)];
  const distractors = ranked.slice(0, CHOICE_COUNT - 1);
  if (distractors.length < CHOICE_COUNT - 1) return null;

  return shuffle([answer.dutch, ...distractors.map((e) => e.dutch)], random);
}

// ── Typing ──

/** Lower case, accents off, punctuation off, single spaces. Accents are
 *  forgiven on purpose: "cafe" for "café" is knowing the word, and a phone
 *  keyboard set to English has no easy way to type the ë in "ideeën". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drops a leading article, so "het huis" and "huis" are the same answer —
 *  the prompt asks for the word, not its gender. */
function withoutArticle(text: string): string {
  return text.replace(/^(de|het|een|'t)\s+/, "");
}

/** Edit distance, capped: only "0, 1, or more" matters here. */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      // A swap of two neighbours ("ontmoeten" → "ontmeoten") is one slip.
      if (a[i + 1] === b[j] && a[j + 1] === b[i]) {
        i += 2;
        j += 2;
        continue;
      }
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** correct — right, give or take accents, case and the article.
 *  typo    — one slip away from right in a longer word: counted as known,
 *            with the spelling shown.
 *  wrong   — anything else, including an empty answer. */
export type TypedVerdict = "correct" | "typo" | "wrong";

/** Checks a typed answer against `answer`, and against any `alternatives` —
 *  other Dutch words with the same English gloss, which are just as right. */
export function checkTyped(typed: string, answer: string, alternatives: string[] = []): TypedVerdict {
  const given = withoutArticle(normalize(typed));
  if (!given) return "wrong";
  const accepted = [answer, ...alternatives].map((a) => withoutArticle(normalize(a)));
  if (accepted.includes(given)) return "correct";
  const main = accepted[0];
  if (main.length >= 5 && withinOneEdit(given, main)) return "typo";
  return "wrong";
}

/** Dutch words in `pool` that translate `entry` exactly as well — accepted
 *  as typed answers. */
export function synonymsOf(entry: DictionaryEntry, pool: DictionaryEntry[]): string[] {
  const english = normalize(entry.english);
  return pool.filter((e) => e.id !== entry.id && normalize(e.english) === english).map((e) => e.dutch);
}
