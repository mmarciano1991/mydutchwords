/* tokenizeText — splits pasted text into sentences, then into tappable word
   tokens within each sentence, for the Add-from-text capture screen (2a).
   Two things a reading-capture screen needs that a plain word-split doesn't
   give you: which characters are actually a word (so only those become tap
   targets, punctuation and whitespace stay plain text) and which sentence
   each word came from (so tapping one can capture "where you met it" — see
   types.ts, DictionaryEntry.metIn — unambiguously, without asking the user
   to say which sentence they meant).

   Pure, synchronous — same shape as the other lib/ modules. */

export interface TextToken {
  text: string;
  isWord: boolean;
  sentenceIndex: number;
}

/** Dutch words can join with an apostrophe or hyphen ("zo'n", "'s-Gravenhage")
 *  and some start with one ("'s ochtends", "'t"), so a leading apostrophe and
 *  any internal apostrophe/hyphen both count as part of the word rather than
 *  a break. Includes the common Latin-1 accented letters Dutch borrows in
 *  loanwords (café, café's). */
const WORD_PATTERN = "'?[A-Za-zÀ-ÿ]+(?:['-][A-Za-zÀ-ÿ]+)*";

export function tokenizeText(text: string): { tokens: TextToken[]; sentences: string[] } {
  // Sentence boundary: a ".", "!" or "?" followed by whitespace. A trailing
  // fragment with no closing punctuation still becomes its own sentence —
  // pasted text is often not a complete final sentence.
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const splitter = new RegExp(`(${WORD_PATTERN})`);
  const tokens: TextToken[] = [];
  sentences.forEach((sentence, sentenceIndex) => {
    // A capturing split alternates [between, word, between, word, ...],
    // starting with the (possibly empty) text before the first word.
    sentence.split(splitter).forEach((part, i) => {
      if (!part) return;
      tokens.push({ text: part, isWord: i % 2 === 1, sentenceIndex });
    });
  });

  return { tokens, sentences };
}
