import { describe, expect, it } from "vitest";
import { completionSentence, contextSentence, findTargetForm } from "./sentenceTarget";
import type { DictionaryEntry } from "./types";

function entry(dutch: string, over: Partial<DictionaryEntry> = {}): DictionaryEntry {
  return { id: dutch, dutch, english: "x", gender: "none", example: "", exampleEn: "", senses: [], ...over };
}

describe("findTargetForm", () => {
  it("finds the headword as a whole word", () => {
    expect(findTargetForm("Ik eet elke ochtend een appel.", "appel")).toEqual({ form: "appel", start: 24, end: 29 });
  });

  it("finds the inflected form the sentence uses", () => {
    expect(findTargetForm("Hij doet de deur dicht.", "doen")?.form).toBe("doet");
    expect(findTargetForm("Ik ga nu naar huis.", "gaan")?.form).toBe("ga");
    expect(findTargetForm("Ik koop een bos bloemen voor haar.", "bloem")?.form).toBe("bloemen");
  });

  it("matches regardless of case, keeping the sentence's own spelling", () => {
    expect(findTargetForm("Kom je vanavond ook?", "komen")?.form).toBe("Kom");
  });

  it("is not eligible when the word appears twice, or not at all", () => {
    expect(findTargetForm("De appel en nog een appel.", "appel")).toBeNull();
    expect(findTargetForm("Ik eet een peer.", "appel")).toBeNull();
  });

  it("is not eligible for a separable verb split in the sentence", () => {
    expect(findTargetForm("Ik bel je morgen op.", "opbellen")).toBeNull();
    expect(findTargetForm("Ik moet hem morgen opbellen.", "opbellen")?.form).toBe("opbellen");
  });

  it("is not a whole-word match inside a longer word", () => {
    expect(findTargetForm("De appelboom bloeit.", "appel")).toBeNull();
  });
});

describe("sentences for a word", () => {
  const appel = entry("appel", {
    example: "Ik eet elke ochtend een appel.",
    exampleEn: "Every morning I eat an apple.",
  });

  it("prefers the captured sentence, which has no translation", () => {
    const captured = { ...appel, metIn: "Deze appel is zuur." };
    expect(completionSentence(captured)).toMatchObject({ source: "captured", translation: null, target: { form: "appel" } });
  });

  it("falls back to the example when the captured sentence isn't usable", () => {
    const captured = { ...appel, metIn: "Ik bel je op." };
    expect(completionSentence(captured)).toMatchObject({ source: "example", translation: "Every morning I eat an apple." });
  });

  it("has no completion sentence without a usable sentence", () => {
    expect(completionSentence(entry("appel"))).toBeNull();
  });

  it("shows a context sentence even when the word can't be highlighted", () => {
    const ctx = contextSentence(entry("opbellen", { example: "Ik bel je op.", exampleEn: "I'll call you." }));
    expect(ctx).toMatchObject({ sentence: "Ik bel je op.", target: null });
  });
});
