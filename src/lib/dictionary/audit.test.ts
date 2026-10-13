/* The completeness audit, on the real-build fixture and on made-up words
   with each kind of gap. */
import { describe, expect, it } from "vitest";
import { auditDictionary, auditMarkdown } from "./audit";
import type { WordEntry } from "./model";
import { FIXTURE_WORDS } from "./testDictionary";

const sense = (gloss: string, examples: WordEntry["uses"][number]["senses"][number]["examples"] = []) =>
  ({ id: `s_${gloss}`, gloss, variety: "NL", rank: 0, synonyms: [], antonyms: [], examples, meta: { sources: [], confidence: "verified" } }) as WordEntry["uses"][number]["senses"][number];
const word = (form: string, frequency: number, use: Partial<WordEntry["uses"][number]>): WordEntry =>
  ({ id: form, form, kind: "word", variants: [], frequency, searchKey: form, meta: { sources: [], confidence: "verified" }, uses: [{ id: "u", pos: "noun", forms: [], fieldMeta: {}, senses: [], ...use }] }) as unknown as WordEntry;

describe("dictionary audit", () => {
  it("counts every kind of gap, and ranks the most frequent incomplete word first", () => {
    const complete = word("huis", 50, {
      article: "het",
      fieldMeta: { article: { sources: [], confidence: "verified" } },
      senses: [sense("house", [{ nl: "Het huis is groot.", en: "The house is big.", targetSpans: [[4, 8]], source: "corpus", origin: "tatoeba" }])],
    });
    const noArticle = word("dutje", 900, { senses: [sense("nap")] });
    const halfExample = word("fiets", 10, {
      article: "de",
      fieldMeta: { article: { sources: [], confidence: "checked" } },
      senses: [sense("bike", [{ nl: "De fiets is rood.", en: "", targetSpans: [[3, 8]], source: "generated" }]), sense("")],
    });
    const r = auditDictionary([complete, noArticle, halfExample]);
    expect(r).toMatchObject({ words: 3, senses: 4, nouns: 3 });
    expect(r.gaps).toEqual({ example: 2, exampleEn: 1, gloss: 1, article: 1, articleChecked: 1, pos: 0 });
    expect(r.exampleSources).toEqual({ tatoeba: 1, generated: 1 });
    expect(r.priority.map((p) => p.form)).toEqual(["fiets", "dutje"]);
    expect(auditMarkdown(r)).toContain("| Example sentence (sense) | 2 | 50.0% |");
  });

  it("finds the fixture's gaps: a build without the model step ships many senses with no example", () => {
    const r = auditDictionary(FIXTURE_WORDS);
    expect(r.senses).toBeGreaterThan(0);
    expect(r.gaps.gloss).toBe(0);
    expect(r.gaps.exampleEn).toBe(0);
    expect(r.gaps.example).toBeGreaterThan(0);
  });
});
