import { describe, expect, it } from "vitest";
import { allowedTypos, checkAnswer, editDistance } from "./answerCheck";

const verdict = (typed: string, answer: string, extra = {}) => checkAnswer(typed, { answer, ...extra }).verdict;

describe("checkAnswer", () => {
  it("ignores case and surrounding whitespace", () => {
    expect(verdict("  Ontmoeten ", "ontmoeten")).toBe("correct");
  });

  it("ignores diacritics for correctness, but shows the right spelling", () => {
    const een = checkAnswer("een", { answer: "één" });
    expect(een).toMatchObject({ verdict: "correct", showSpelling: true });
    expect(checkAnswer("café", { answer: "café" }).showSpelling).toBe(false);
  });

  it("accepts the word with the right article, a wrong one, or none", () => {
    expect(checkAnswer("het huis", { answer: "huis", article: "het" })).toMatchObject({ verdict: "correct", rightArticle: null });
    expect(checkAnswer("de huis", { answer: "huis", article: "het" })).toMatchObject({ verdict: "correct", rightArticle: "het" });
    expect(checkAnswer("huis", { answer: "huis", article: "het" })).toMatchObject({ verdict: "correct", rightArticle: null });
  });

  it("allows one typo up to 6 letters", () => {
    expect(verdict("hius", "huis")).toBe("almost"); // swap
    expect(verdict("fiest", "fiets")).toBe("almost");
    expect(verdict("winkle", "winkel")).toBe("almost"); // 6 letters, swap
    expect(verdict("wnkle", "winkel")).toBe("wrong"); // 2 edits
  });

  it("allows two typos above 6 letters", () => {
    expect(verdict("afsprak", "afspraak")).toBe("almost");
    expect(verdict("afsprk", "afspraak")).toBe("almost");
    expect(verdict("afsp", "afspraak")).toBe("wrong");
    expect(allowedTypos("winkel")).toBe(1);
    expect(allowedTypos("afspraak")).toBe(2);
  });

  it("marks a typo as almost, with the spelling shown", () => {
    expect(checkAnswer("ontmoten", { answer: "ontmoeten" })).toMatchObject({ verdict: "almost", showSpelling: true });
  });

  it("never accepts another real word as a typo", () => {
    expect(verdict("dak", "dag", { isOtherWord: (w: string) => w === "dak" })).toBe("wrong");
    expect(verdict("dak", "dag")).toBe("almost");
  });

  it("accepts a synonym from the deck", () => {
    expect(verdict("treffen", "ontmoeten", { alternatives: ["treffen"] })).toBe("correct");
  });

  it("Sentence Completion: the dictionary form is almost, flagged as such", () => {
    expect(checkAnswer("doen", { answer: "doet", dictionaryForm: "doen" })).toMatchObject({ verdict: "almost", dictionaryForm: true });
    expect(checkAnswer("doet", { answer: "doet", dictionaryForm: "doen" })).toMatchObject({ verdict: "correct", dictionaryForm: false });
  });

  it("is wrong for an empty answer or a different word", () => {
    expect(verdict("   ", "huis")).toBe("wrong");
    expect(verdict("volgen", "ontmoeten")).toBe("wrong");
  });
});

describe("editDistance", () => {
  it("counts a swap of neighbours as one edit", () => {
    expect(editDistance("ab", "ba")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("", "abc")).toBe(3);
  });
});
