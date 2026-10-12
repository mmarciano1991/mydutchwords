/* tokenizeText — splits pasted text into sentences, then into tappable word
   tokens within each sentence, for Add from text. Each token knows its
   sentence and where it sits in it, so a tap can be looked up in context
   (lib/dictionary/units) and the sentence kept as the word's example.

   A word is letters and digits with inner apostrophes and hyphens
   ("zo'n", "'s-Gravenhage", "GGD-test", "auto's"), so a compound — hyphen
   or not — is one tap target, whichever part is tapped.

   Pure, synchronous — same shape as the other lib/ modules. */

export interface TextToken {
  text: string;
  isWord: boolean;
  sentenceIndex: number;
  /** Offset of the token in its sentence. */
  start: number;
}

const WORD_PATTERN = "'?[\\p{L}\\p{N}]+(?:['\\u2019-][\\p{L}\\p{N}]+)*";

export function tokenizeText(text: string): { tokens: TextToken[]; sentences: string[] } {
  // Sentence boundary: ".", "!" or "?" followed by whitespace. A trailing
  // fragment with no closing punctuation is still a sentence.
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const splitter = new RegExp(`(${WORD_PATTERN})`, "u");
  const tokens: TextToken[] = [];
  sentences.forEach((sentence, sentenceIndex) => {
    let offset = 0;
    // A capturing split alternates [between, word, between, word, ...].
    sentence.split(splitter).forEach((part, i) => {
      if (part) tokens.push({ text: part, isWord: i % 2 === 1, sentenceIndex, start: offset });
      offset += part.length;
    });
  });

  return { tokens, sentences };
}
