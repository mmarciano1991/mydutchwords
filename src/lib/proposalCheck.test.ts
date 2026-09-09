import { describe, expect, it } from "vitest";
import { checkProposal, sentenceUsesWord } from "./proposalCheck";

const good = {
  dutch: "aanslag",
  confident: true,
  article: "de",
  example: "Ik kreeg een aanslag van de gemeente.",
  exampleEn: "I received a tax assessment from the municipality.",
};
const request = { dutch: "aanslag", gloss: "tax assessment / bill" };

describe("sentenceUsesWord", () => {
  it("accepts the word as written", () => {
    expect(sentenceUsesWord("Ik kreeg een aanslag.", "aanslag")).toBe(true);
  });

  it("accepts an inflected form — the reason this isn't a substring test", () => {
    // "gaan" really is demonstrated by "Ik ga naar huis", and a checker that
    // said otherwise would reject correct Dutch by the thousand.
    expect(sentenceUsesWord("Ik ga nu naar huis.", "gaan")).toBe(true);
    expect(sentenceUsesWord("De kinderen spelen buiten.", "kind")).toBe(true);
    expect(sentenceUsesWord("Hij liep snel naar de trein.", "lopen")).toBe(true);
  });

  it("rejects a sentence that never uses the word", () => {
    expect(sentenceUsesWord("De bakker zit aan de rechterkant.", "rechts")).toBe(false);
  });
});

describe("checkProposal", () => {
  it("passes a correct proposal", () => {
    expect(checkProposal(good, request)).toEqual([]);
  });

  it("rejects an example that doesn't contain the word", () => {
    // The single most important check: an example that doesn't demonstrate
    // its own word teaches nothing and looks entirely plausible.
    const problems = checkProposal(
      { ...good, example: "De gemeente stuurde een brief." },
      request
    );
    expect(problems).toContain("example does not contain the word");
  });

  it("rejects a proposal the model itself wasn't confident about", () => {
    expect(checkProposal({ ...good, confident: false }, request)).toContain(
      "model was not confident"
    );
  });

  it("rejects an article that contradicts the proposal's own example", () => {
    const problems = checkProposal(
      { ...good, article: "het", example: "De aanslag kwam gisteren binnen." },
      request
    );
    expect(problems.some((p) => p.includes("contradicts its own example"))).toBe(true);
  });

  it("rejects an article that isn't a real one", () => {
    expect(checkProposal({ ...good, article: "der" }, request).join()).toContain(
      'article "der" is not de, het or none'
    );
  });

  it("rejects an answer given for a different word", () => {
    // Batched requests can come back misaligned, which would file one word's
    // sentence under another word's entry.
    const problems = checkProposal({ ...good, dutch: "bezwaar" }, request);
    expect(problems.some((p) => p.includes('answered for "bezwaar"'))).toBe(true);
  });

  it("rejects a tab or newline, which would corrupt the shipped encoding", () => {
    expect(checkProposal({ ...good, example: "Ik kreeg\teen aanslag." }, request)).toContain(
      "contains a tab or newline"
    );
  });

  it("rejects empty fields", () => {
    expect(checkProposal({ ...good, example: "  " }, request)).toContain("no example sentence");
    expect(checkProposal({ ...good, exampleEn: "" }, request)).toContain(
      "no English translation"
    );
  });

  it("rejects a request whose meaning is still several meanings", () => {
    // One sentence cannot demonstrate two meanings, so asking for one against
    // a packed gloss produces an example that misrepresents at least one.
    const problems = checkProposal(good, { dutch: "aanslag", gloss: "attack; tax bill" });
    expect(problems.some((p) => p.includes("packs several meanings"))).toBe(true);
  });

  it("accepts 'none' for a word that takes no article", () => {
    expect(
      checkProposal(
        {
          dutch: "lopen",
          confident: true,
          article: "none",
          example: "Hij liep snel naar de trein.",
          exampleEn: "He walked quickly to the train.",
        },
        { dutch: "lopen", gloss: "to walk" }
      )
    ).toEqual([]);
  });
});
