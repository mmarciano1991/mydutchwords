// @vitest-environment jsdom
/* The deck's store of senses: a learner's edit survives a dictionary
   refresh, and a refresh brings in what changed otherwise. */
import { beforeEach, describe, expect, it } from "vitest";
import "../test/dom";
import { addCustomEntry, editEntry, fillMissingPos, isLegacyId, refreshEntries, resolveEntry, setCustomEntries } from "./wordSources";
import type { DictionaryEntry } from "./types";
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

describe("part of speech for cards saved before the server dictionary", () => {
  const legacy = (id: string, dutch: string, english: string, gender: DictionaryEntry["gender"] = "none"): DictionaryEntry => ({
    id,
    dutch,
    english,
    gender,
    example: "",
    exampleEn: "",
    senses: [{ english, gender, example: "", exampleEn: "" }],
  });

  it("takes the only part of speech a word has", async () => {
    setCustomEntries([legacy("lopen", "lopen", "to walk")]);
    expect(await fillMissingPos(["lopen"])).toBe(1);
    expect(resolveEntry("lopen")!.pos).toBe("verb");
  });

  it("lets the saved gloss pick between several", async () => {
    setCustomEntries([legacy("wassen", "wassen", "made of wax"), legacy("vrij", "vrij", "free")]);
    await fillMissingPos(["wassen", "vrij"]);
    expect(resolveEntry("wassen")!.pos).toBe("adjective");
    expect(resolveEntry("vrij")!.pos).toBe("adjective");
  });

  it("leaves it blank when the dictionary can't tell, and doesn't ask again", async () => {
    setCustomEntries([legacy("ver", "ver", "far")]);
    expect(await fillMissingPos(["ver"])).toBe(1);
    expect(resolveEntry("ver")!.pos).toBeNull();
    expect(await fillMissingPos(["ver"])).toBe(0);
  });

  it("skips nouns with an article, personal words and dictionary senses", async () => {
    const [sense] = entriesOfWord(fixtureWord("termijn"));
    setCustomEntries([legacy("zout", "zout", "salt", "het"), { ...legacy("p_x", "lopen", "to walk"), personal: true }, sense]);
    expect(await fillMissingPos(["zout", "p_x", sense.id])).toBe(0);
  });
});
