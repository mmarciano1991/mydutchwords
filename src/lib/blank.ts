/**
 * Build a fill-in-the-blank prompt from an example sentence by removing the
 * target Dutch word. Matching is case-insensitive and whole-word.
 *
 * Returns the sentence split into the text before and after the blank, plus
 * the exact surface form that was blanked out (used to render feedback).
 */
export interface BlankedSentence {
  before: string;
  after: string;
  /** The surface form removed from the sentence (e.g. "Fiets" with its casing). */
  answer: string;
  /** True when the target word was actually found in the sentence. */
  found: boolean;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function blankOut(sentence: string, target: string): BlankedSentence {
  const trimmed = target.trim();
  // \b doesn't play well with all Unicode letters, so guard with lookarounds.
  const re = new RegExp(
    `(^|[^\\p{L}])(${escapeRegExp(trimmed)})(?=$|[^\\p{L}])`,
    "iu"
  );
  const match = re.exec(sentence);
  if (!match || match.index === undefined) {
    return { before: sentence, after: "", answer: trimmed, found: false };
  }
  const lead = match[1];
  const surface = match[2];
  const start = match.index + lead.length;
  const end = start + surface.length;
  return {
    before: sentence.slice(0, start),
    after: sentence.slice(end),
    answer: surface,
    found: true,
  };
}

/** Compare a typed answer to the target (case-insensitive, trimmed). */
export function isCorrect(typed: string, target: string): boolean {
  return typed.trim().toLowerCase() === target.trim().toLowerCase();
}
