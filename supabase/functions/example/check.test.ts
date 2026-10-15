/* The checks a sentence written on demand must pass before it is stored. */
import { describe, expect, it } from "vitest";
import { findSpan, issuesOf, prompt } from "./check";

describe("findSpan", () => {
  it("finds the word or an inflected form as a whole word", () => {
    expect(findSpan("Ik fiets elke dag.", ["fietsen", "fiets"])).toEqual([3, 8]);
    expect(findSpan("De Fietsen staan buiten.", ["fiets", "fietsen"])).toEqual([3, 10]);
  });

  it("doesn't match inside another word", () => {
    expect(findSpan("De fietsenmaker is dicht.", ["fiets", "fietsen"])).toBeNull();
  });

  it("prefers the longest form, for a verb with its preposition", () => {
    expect(findSpan("Ik wil afkomen van die bank.", ["afkomen", "afkomen van"])).toEqual([7, 18]);
  });
});

describe("issuesOf", () => {
  const forms = ["termijn", "termijnen"];

  it("passes a card-sized sentence with the word and a translation", () => {
    const r = issuesOf({ nl: "  De termijn is bijna  voorbij. ", en: "The term is almost over." }, forms);
    expect(r.issues).toEqual([]);
    expect(r.nl).toBe("De termijn is bijna voorbij.");
    expect(r.span).toEqual([3, 10]);
  });

  it("rejects a sentence without the word, too short or too long, quotes, or no translation", () => {
    expect(issuesOf({ nl: "Het is bijna voorbij.", en: "It is almost over." }, forms).issues).toContain("word not found in sentence");
    expect(issuesOf({ nl: "Termijn!", en: "Term!" }, forms).issues).toContain("too short");
    expect(issuesOf({ nl: `De termijn ${"is heel erg ".repeat(6)}lang.`, en: "Long." }, forms).issues).toContain("too long");
    expect(issuesOf({ nl: 'Hij zei "termijn" twee keer.', en: "He said it." }, forms).issues).toContain("markup or quotes in sentence");
    expect(issuesOf({ nl: "De termijn is voorbij.", en: "-" }, forms).issues).toContain("no translation");
    expect(issuesOf({ nl: 42, en: null }, forms).issues).toContain("word not found in sentence");
  });
});

describe("prompt", () => {
  it("names the word with its article, the meaning, and the meanings to avoid", () => {
    const p = prompt({ form: "bank", pos: "noun", gloss: "bench", article: "de", forms: ["bank"], otherGlosses: ["bank (money)"] });
    expect(p).toContain("Word: de bank");
    expect(p).toContain("Meaning: bench");
    expect(p).toContain("NOT to use: bank (money)");
  });
});
