/* Entries built from what the learner or the online dictionary supplied:
   complete where the source says, honest about the rest. */
import { describe, expect, it } from "vitest";
import { onlineEntry, personalEntry, personalWordGaps } from "./snapshot";

describe("personal words", () => {
  it("need a translation, a word type and an example before they can be saved", () => {
    expect(personalWordGaps({})).toEqual(["translation", "pos", "example"]);
    expect(personalWordGaps({ translation: " ", pos: "noun", example: "" })).toEqual(["translation", "example"]);
    expect(personalWordGaps({ translation: "nap", pos: "noun", example: "Ik doe een dutje." })).toEqual([]);
  });

  it("carry the learner's word type, article and example", () => {
    const e = personalEntry(" dutje ", { translation: "nap", pos: "noun", article: "het", example: " Ik doe een dutje. ", exampleEn: "I'm taking a nap." });
    expect(e).toMatchObject({
      id: "p_dutje",
      dutch: "dutje",
      english: "nap",
      gender: "het",
      pos: "noun",
      example: "Ik doe een dutje.",
      exampleEn: "I'm taking a nap.",
      personal: true,
    });
    expect(e.senses).toEqual([{ english: "nap", example: "Ik doe een dutje.", exampleEn: "I'm taking a nap.", gender: "het", label: "noun" }]);
  });

  it("never guess an article: a noun without one is unknown, any other word takes none", () => {
    expect(personalEntry("dutje", { translation: "nap", pos: "noun", example: "Een dutje." }).gender).toBe("unknown");
    expect(personalEntry("snel", { translation: "fast", pos: "adjective", example: "Hij is snel.", article: "de" }).gender).toBe("none");
  });
});

describe("online dictionary senses", () => {
  it("keep the page's own example, with its translation and the word located", () => {
    const e = onlineEntry("knuffel", 0, { english: "hug", label: "Noun", gender: "de", example: "Geef me een knuffel.", exampleEn: "Give me a hug." });
    expect(e).toMatchObject({ example: "Geef me een knuffel.", exampleEn: "Give me a hug.", gender: "de" });
    expect(e.snapshot!.examples[0].targetSpans).toEqual([[12, 19]]);
    expect(e.snapshot!.articleUnverified).toBe(true);
  });

  it("drop half an example rather than show one without its translation", () => {
    expect(onlineEntry("knuffel", 0, { english: "hug", label: "noun", gender: "de", example: "Geef me een knuffel." }).snapshot!.examples).toEqual([]);
  });

  it("never turn an unfamiliar label into a noun", () => {
    const e = onlineEntry("tot ziens", 0, { english: "goodbye", label: "phrase", gender: "none" });
    expect(e.snapshot!.pos).toBe("phrase");
    expect(e.gender).toBe("none");
    expect(onlineEntry("knuffel", 0, { english: "hug", label: "noun", gender: "unknown" }).gender).toBe("unknown");
  });
});
