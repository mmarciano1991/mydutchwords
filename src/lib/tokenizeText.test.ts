import { describe, expect, it } from "vitest";
import { tokenizeText } from "./tokenizeText";

describe("tokenizeText", () => {
  it("splits a single sentence into word and non-word tokens", () => {
    const { tokens, sentences } = tokenizeText("Sloten, beken en kanalen worden schaarser.");
    expect(sentences).toEqual(["Sloten, beken en kanalen worden schaarser."]);
    const words = tokens.filter((t) => t.isWord).map((t) => t.text);
    expect(words).toEqual(["Sloten", "beken", "en", "kanalen", "worden", "schaarser"]);
    // Rejoining every token reproduces the original sentence exactly.
    expect(tokens.map((t) => t.text).join("")).toBe("Sloten, beken en kanalen worden schaarser.");
  });

  it("assigns each word to its own sentence", () => {
    const { tokens } = tokenizeText("Het is droog. De rivier staat laag. Toch is er geen tekort.");
    const bySentence = new Map<number, string[]>();
    for (const t of tokens.filter((t) => t.isWord)) {
      bySentence.set(t.sentenceIndex, [...(bySentence.get(t.sentenceIndex) ?? []), t.text]);
    }
    expect(bySentence.get(0)).toEqual(["Het", "is", "droog"]);
    expect(bySentence.get(1)).toEqual(["De", "rivier", "staat", "laag"]);
    expect(bySentence.get(2)).toEqual(["Toch", "is", "er", "geen", "tekort"]);
  });

  it("keeps an apostrophe or hyphen inside a word rather than splitting on it", () => {
    const { tokens } = tokenizeText("Zo'n aanpak in 's-Gravenhage werkt niet.");
    const words = tokens.filter((t) => t.isWord).map((t) => t.text);
    expect(words).toContain("Zo'n");
    expect(words).toContain("'s-Gravenhage");
  });

  it("treats a trailing sentence fragment with no closing punctuation as its own sentence", () => {
    const { sentences } = tokenizeText("Eerste zin. En dan een fragment zonder punt");
    expect(sentences).toEqual(["Eerste zin.", "En dan een fragment zonder punt"]);
  });

  it("returns nothing for blank input", () => {
    expect(tokenizeText("").tokens).toEqual([]);
    expect(tokenizeText("   ").tokens).toEqual([]);
  });

  it("handles a question and exclamation as sentence boundaries too", () => {
    const { sentences } = tokenizeText("Is het droog? Ja, heel droog! Dat is duidelijk.");
    expect(sentences).toEqual(["Is het droog?", "Ja, heel droog!", "Dat is duidelijk."]);
  });
});
