// @vitest-environment jsdom
/* Examples written on demand for dictionary senses that shipped without
   one: asked for once, kept through a refresh, never over a learner's own. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../test/dom";
import { DETAILS_RETRY_MS, EXAMPLES_PER_RUN, editEntry, fillMissingExamples, refreshEntries, resolveEntry, setCustomEntries } from "./wordSources";
import { entriesOfWord, entryOf } from "./dictionary/snapshot";
import { fixtureWord, useFixtureDictionary } from "./dictionary/testDictionary";
import type { ExampleResult } from "./exampleService";
import type { DictionaryEntry } from "./types";

const requestExample = vi.fn<(senseId: string) => Promise<ExampleResult>>();
vi.mock("./exampleService", () => ({ requestExample: (id: string) => requestExample(id) }));

const written: ExampleResult = {
  kind: "example",
  example: { nl: "De termijn is bijna voorbij.", en: "The term is almost over.", targetSpans: [[3, 10]], source: "generated" },
};

/** A real fixture sense, as if the dictionary had no example for it. */
function bare(): DictionaryEntry {
  const [entry] = entriesOfWord(fixtureWord("termijn"));
  return entryOf({ ...entry.snapshot!, examples: [] });
}

beforeEach(() => {
  useFixtureDictionary();
  setCustomEntries([]);
  requestExample.mockReset();
});

describe("fillMissingExamples", () => {
  it("fills a sense that has no example, and the card shows it", async () => {
    const entry = bare();
    setCustomEntries([entry]);
    requestExample.mockResolvedValue(written);
    expect(await fillMissingExamples([entry.id])).toBe(1);
    const after = resolveEntry(entry.id)!;
    expect(requestExample).toHaveBeenCalledWith(entry.snapshot!.senseId);
    expect(after.example).toBe("De termijn is bijna voorbij.");
    expect(after.exampleEn).toBe("The term is almost over.");
    expect(after.senses[0].source).toBe("generated");
    expect(after.snapshot!.examples[0].source).toBe("generated");
  });

  it("doesn't ask for senses that have one, personal words, or a learner's own example", async () => {
    const [withExample] = entriesOfWord(fixtureWord("termijn"));
    const personal = { ...bare(), id: "p_x", personal: true };
    const edited = { ...bare(), id: "s_edited", userEdited: ["example" as const] };
    setCustomEntries([withExample, personal, edited]);
    expect(await fillMissingExamples([withExample.id, "p_x", "s_edited"])).toBe(0);
    expect(requestExample).not.toHaveBeenCalled();
  });

  it("asks again only after the retry window when the server has none", async () => {
    const entry = bare();
    setCustomEntries([entry]);
    requestExample.mockResolvedValue({ kind: "none" });
    const now = 10 * DETAILS_RETRY_MS;
    expect(await fillMissingExamples([entry.id], undefined, now)).toBe(1);
    expect(await fillMissingExamples([entry.id], undefined, now + 1000)).toBe(0);
    expect(requestExample).toHaveBeenCalledTimes(1);
    await fillMissingExamples([entry.id], undefined, now + DETAILS_RETRY_MS);
    expect(requestExample).toHaveBeenCalledTimes(2);
  });

  it("asks again next time when offline", async () => {
    const entry = bare();
    setCustomEntries([entry]);
    requestExample.mockResolvedValue({ kind: "offline" });
    expect(await fillMissingExamples([entry.id])).toBe(0);
    await fillMissingExamples([entry.id]);
    expect(requestExample).toHaveBeenCalledTimes(2);
  });

  it("asks for a bounded number per run", async () => {
    const entries = Array.from({ length: EXAMPLES_PER_RUN + 5 }, (_, i) => ({ ...bare(), id: `s_many${i}` }));
    setCustomEntries(entries);
    requestExample.mockResolvedValue({ kind: "none" });
    await fillMissingExamples(entries.map((e) => e.id));
    expect(requestExample).toHaveBeenCalledTimes(EXAMPLES_PER_RUN);
  });

  it("keeps a corrected translation", async () => {
    const entry = bare();
    setCustomEntries([entry]);
    editEntry(entry.id, { english: "deadline", example: "", exampleEn: "" });
    requestExample.mockResolvedValue(written);
    await fillMissingExamples([entry.id]);
    const after = resolveEntry(entry.id)!;
    expect(after.english).toBe("deadline");
    expect(after.example).toBe("De termijn is bijna voorbij.");
  });
});

describe("refresh", () => {
  it("keeps an on-demand example while the dictionary still has none", async () => {
    const entry = entriesOfWord(fixtureWord("in")).find((e) => !e.example)!;
    setCustomEntries([entry]);
    requestExample.mockResolvedValue({ kind: "example", example: { nl: "Ik woon in de stad.", en: "I live in the city.", targetSpans: [], source: "generated" } });
    await fillMissingExamples([entry.id]);
    await refreshEntries([entry.id]);
    expect(resolveEntry(entry.id)!.example).toBe("Ik woon in de stad.");
  });

  it("keeps an on-demand example until the dictionary has its own", async () => {
    const [real] = entriesOfWord(fixtureWord("termijn"));
    const entry = { ...bare(), english: "stale" };
    setCustomEntries([entry]);
    requestExample.mockResolvedValue(written);
    await fillMissingExamples([entry.id]);
    // The fixture dictionary has an example for this sense, so a refresh
    // brings the dictionary's own in.
    await refreshEntries([entry.id]);
    expect(resolveEntry(entry.id)!.example).toBe(real.example);
  });
});
