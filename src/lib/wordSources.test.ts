// @vitest-environment jsdom
/* The deck's store of senses: a learner's edit survives a dictionary
   refresh, and a refresh brings in what changed otherwise. */
import { beforeEach, describe, expect, it } from "vitest";
import "../test/dom";
import { addCustomEntry, editEntry, isLegacyId, refreshEntries, resolveEntry, setCustomEntries } from "./wordSources";
import { entriesOfWord } from "./dictionary/snapshot";
import { fixtureWord, useFixtureDictionary } from "./dictionary/testDictionary";

beforeEach(() => {
  useFixtureDictionary();
  setCustomEntries([]);
});

describe("deck store", () => {
  it("tells new sense ids from legacy ones", () => {
    expect(isLegacyId("s_abc")).toBe(false);
    expect(isLegacyId("c_huurtoeslagaanvraag")).toBe(false);
    expect(isLegacyId("aanslag#1")).toBe(true);
    expect(isLegacyId("aanslag")).toBe(true);
  });

  it("an edit keeps the same id, and a refresh never overwrites it", async () => {
    const [entry] = entriesOfWord(fixtureWord("termijn"));
    addCustomEntry({ ...entry, snapshot: { ...entry.snapshot!, gloss: "stale gloss" }, english: "stale gloss" });
    editEntry(entry.id, { english: "time limit", example: "Binnen de termijn betalen.", exampleEn: "Pay within the time limit." });
    await refreshEntries([entry.id]);
    const after = resolveEntry(entry.id)!;
    expect(after.id).toBe(entry.id);
    expect(after.english).toBe("time limit");
    expect(after.userEdited).toEqual(expect.arrayContaining(["english", "example", "exampleEn"]));
    expect(after.snapshot!.examples[0]).toMatchObject({ nl: "Binnen de termijn betalen.", source: "user" });
  });

  it("a refresh updates what the learner didn't edit", async () => {
    const [entry] = entriesOfWord(fixtureWord("termijn"));
    addCustomEntry({ ...entry, english: "old", snapshot: { ...entry.snapshot!, gloss: "old" } });
    expect(await refreshEntries([entry.id])).toBe(1);
    expect(resolveEntry(entry.id)!.english).toBe(entry.english);
  });
});
