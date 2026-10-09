/* answerCheck — grading a typed Dutch answer (Active Recall, Sentence
   Completion).

     - whitespace trimmed, case ignored
     - diacritics ignored for correctness ("een" for "één"), but the correct
       spelling is shown
     - an optional leading article is accepted; a wrong one still counts as
       the right word, with the right article shown
     - a typo — Damerau-Levenshtein distance ≤ 1 for answers of up to 6
       letters, ≤ 2 for longer — is "almost": correct, spelling shown. Not
       when the typed word is itself another real word ("dak" for "dag"):
       that's a different word, not a slip.
     - Sentence Completion: the dictionary form where the sentence needs an
       inflected one ("doen" for "doet") is "almost" too.

   Pure and synchronous. Thresholds live in learningConfig. */
import { TYPO_EDITS_LONG, TYPO_EDITS_SHORT, TYPO_SHORT_MAX_LETTERS } from "./learningConfig";

export type AnswerVerdict = "correct" | "almost" | "wrong";

export interface AnswerCheck {
  verdict: AnswerVerdict;
  /** The typed word's spelling differs from the right one (accents or a
   *  typo) — show the correct spelling. */
  showSpelling: boolean;
  /** The user typed an article, and it was the wrong one: the right one. */
  rightArticle: "de" | "het" | null;
  /** Sentence Completion: the dictionary form was typed instead of the form
   *  the sentence uses. */
  dictionaryForm: boolean;
}

export interface ExpectedAnswer {
  /** The exact form wanted ("doet" in a sentence, "doen" on its own). */
  answer: string;
  /** The word's article, when it is a noun. */
  article?: "de" | "het" | null;
  /** Other Dutch words that are just as right (same meaning in the deck). */
  alternatives?: string[];
  /** Sentence Completion: the word's dictionary form, accepted as "almost". */
  dictionaryForm?: string;
  /** True when a string is some other real Dutch word — blocks typo
   *  tolerance for it. */
  isOtherWord?: (word: string) => boolean;
}

/** Lower case, single spaces, trimmed. */
function clean(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Accents off: "één" → "een", "ideeën" → "ideeen". */
export function foldDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const ARTICLE = /^(de|het|'t|een)\s+(.+)$/;

function splitArticle(text: string): { article: string | null; word: string } {
  const m = clean(text).match(ARTICLE);
  return m ? { article: m[1], word: m[2] } : { article: null, word: clean(text) };
}

/** Optimal-string-alignment Damerau-Levenshtein distance: insertions,
 *  deletions, substitutions and swaps of two neighbours each cost one. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Typos allowed for an answer of this length. */
export function allowedTypos(answer: string): number {
  return [...answer].length <= TYPO_SHORT_MAX_LETTERS ? TYPO_EDITS_SHORT : TYPO_EDITS_LONG;
}

export function checkAnswer(typed: string, expected: ExpectedAnswer): AnswerCheck {
  const none: AnswerCheck = { verdict: "wrong", showSpelling: false, rightArticle: null, dictionaryForm: false };
  const given = splitArticle(typed);
  if (!given.word) return none;

  const answer = splitArticle(expected.answer).word;
  const folded = foldDiacritics(given.word);
  const accepted = [answer, ...(expected.alternatives ?? []).map((a) => splitArticle(a).word)];

  const article = expected.article ?? null;
  const rightArticle =
    article && (given.article === "de" || given.article === "het") && given.article !== article ? article : null;

  if (accepted.some((a) => foldDiacritics(a) === folded)) {
    const exact = accepted.includes(given.word);
    return { verdict: "correct", showSpelling: !exact, rightArticle, dictionaryForm: false };
  }

  const dict = expected.dictionaryForm ? splitArticle(expected.dictionaryForm).word : null;
  if (dict && dict !== answer && foldDiacritics(dict) === folded) {
    return { verdict: "almost", showSpelling: true, rightArticle, dictionaryForm: true };
  }

  const foldedAnswer = foldDiacritics(answer);
  const slip = editDistance(folded, foldedAnswer) <= allowedTypos(foldedAnswer);
  if (slip && !expected.isOtherWord?.(given.word)) {
    return { verdict: "almost", showSpelling: true, rightArticle, dictionaryForm: false };
  }
  return none;
}
