// @vitest-environment jsdom
/* The deck's store of senses: a learner's edit survives a dictionary
   refresh, and a refresh brings in what changed otherwise. */
import { beforeEach, describe, expect, it } from "vitest";
import "../test/dom";
import { addCustomEntry, DETAILS_RETRY_MS, editEntry, fillMissingDetails, fillMissingPos, isLegacyId, refreshEntries, resolveEntry, setCustomEntries } from "./wordSources";
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

describe("example and article for cards saved before the server dictionary", () => {
  const card = (id: string, dutch: string, english: string, over: Partial<DictionaryEntry> = {}): DictionaryEntry => ({
    id,
    dutch,
    english,
    gender: over.gender ?? "unknown",
    example: "",
    exampleEn: "",
    senses: [{ english, gender: over.gender ?? "unknown", example: "", exampleEn: "", provisional: true }],
    ...over,
  });

  it("fills an empty example and an unknown article from the one sense the gloss names", async () => {
    setCustomEntries([card("fiets", "fiets", "bicycle")]);
    expect(await fillMissingDetails(["fiets"])).toBe(1);
    const after = resolveEntry("fiets")!;
    expect(after).toMatchObject({ gender: "de", example: "Gisteren heb ik een nieuwe fiets gekocht.", pos: "noun" });
    expect(after.exampleEn).not.toBe("");
    expect(after.senses[0]).toMatchObject({ gender: "de", example: after.example, provisional: undefined });
  });

  it("picks the meaning by gloss, not the word's first one", async () => {
    setCustomEntries([card("aanslag#1", "aanslag", "attack", { gender: "de" })]);
    await fillMissingDetails(["aanslag#1"]);
    expect(resolveEntry("aanslag#1")!.example).toBe("Tom overleefde de aanslag.");
  });

  it("leaves what is there, and what the learner edited, alone", async () => {
    setCustomEntries([
      card("huis", "huis", "house", { gender: "het", example: "Mijn huis is oud.", exampleEn: "My house is old." }),
      card("bal", "bal", "ball", { gender: "de", userEdited: ["example"] }),
    ]);
    expect(await fillMissingDetails(["huis", "bal"])).toBe(1); // huis isn't missing anything
    expect(resolveEntry("huis")!.example).toBe("Mijn huis is oud.");
    expect(resolveEntry("bal")!.example).toBe("");
  });

  it("never guesses: no example when the gloss matches no sense, or one with none", async () => {
    setCustomEntries([card("bal", "bal", "sphere"), card("termijn", "termijn", "deadline", { gender: "de" })]);
    await fillMissingDetails(["bal", "termijn"]);
    expect(resolveEntry("bal")).toMatchObject({ example: "", gender: "unknown" });
    expect(resolveEntry("termijn")!.example).toBe("");
  });

  it("tries a card it couldn't complete again only after a while", async () => {
    setCustomEntries([card("termijn", "termijn", "deadline", { gender: "de" })]);
    const now = Date.now();
    expect(await fillMissingDetails(["termijn"], undefined, now)).toBe(1);
    expect(await fillMissingDetails(["termijn"], undefined, now + 1000)).toBe(0);
    expect(await fillMissingDetails(["termijn"], undefined, now + DETAILS_RETRY_MS)).toBe(1);
  });

  it("skips personal words and dictionary senses (those refresh on their own)", async () => {
    const [entry] = entriesOfWord(fixtureWord("termijn"));
    setCustomEntries([card("p_fiets", "fiets", "bicycle", { personal: true }), { ...entry, example: "" }]);
    expect(await fillMissingDetails(["p_fiets", entry.id])).toBe(0);
  });
});

