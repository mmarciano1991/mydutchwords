/* The grammar explanation: an inflected form shows its headword — the
   infinitive for a verb — and says why, from the dictionary's own tags. */
import { beforeEach, describe, expect, it } from "vitest";
import { senseItems } from "../../components/SenseResults";
import { deckMembership } from "../deckMembership";
import { grammarNote } from "./grammar";
import { lookup } from "./service";
import { fixtureWord, useFixtureDictionary } from "./testDictionary";

beforeEach(() => {
  useFixtureDictionary();
});

async function itemsFor(form: string) {
  return senseItems(await lookup(form));
}

describe("verbs resolve to the infinitive, with the step explained", () => {
  it.each([
    ["liep", "lopen", "Past tense of lopen."],
    ["ging", "gaan", "Past tense of gaan."],
    ["geweest", "zijn", "Past participle of zijn."],
    ["gelopen", "lopen", "Past participle of lopen."],
  ])("%s → %s", async (typed, infinitive, note) => {
    const verbs = (await itemsFor(typed)).filter((i) => i.snapshot.pos === "verb");
    expect(verbs.length).toBeGreaterThan(0);
    expect(verbs.every((i) => i.snapshot.form === infinitive)).toBe(true);
    expect(verbs.every((i) => i.grammar === note)).toBe(true);
  });

  it("the infinitive itself gets no explanation", async () => {
    const items = await itemsFor("lopen");
    expect(items.filter((i) => i.snapshot.form === "lopen").every((i) => !i.grammar)).toBe(true);
  });

  it("“was” keeps every word it can be — each explained on its own terms", async () => {
    const items = await itemsFor("was");
    const zijn = items.filter((i) => i.snapshot.wordId === "zijn");
    expect(zijn.length).toBeGreaterThan(0);
    expect(zijn.every((i) => i.grammar === "Past tense of zijn.")).toBe(true);
    // de was is the word itself: nothing to explain.
    expect(items.filter((i) => i.snapshot.wordId === "was").every((i) => !i.grammar)).toBe(true);
  });
});

describe("other word types", () => {
  it("a noun plural says so, and stays a noun", async () => {
    const huis = (await itemsFor("huizen")).filter((i) => i.snapshot.wordId === "huis");
    expect(huis.length).toBeGreaterThan(0);
    expect(huis.every((i) => i.snapshot.pos === "noun" && i.grammar === "Plural of huis.")).toBe(true);
  });

  it("adjective degrees come from the tags", () => {
    const use = fixtureWord("vrij").uses.find((u) => u.pos === "adjective")!;
    expect(grammarNote("vrij", use, { via: "form", matched: "vrijer" })).toBe("Comparative of vrij.");
    expect(grammarNote("vrij", use, { via: "form", matched: "vrijst" })).toBe("Superlative of vrij.");
    expect(grammarNote("vrij", use, { via: "form", matched: "vrije" })).toBe("Inflected form of vrij.");
  });

  it("no explanation for pronoun tables, unknown forms or the headword", () => {
    const pronoun = fixtureWord("zijn").uses.find((u) => u.pos === "pronoun")!;
    expect(grammarNote("zijn", pronoun, { via: "form", matched: "hem" })).toBeNull();
    const verb = fixtureWord("lopen").uses.find((u) => u.pos === "verb")!;
    expect(grammarNote("lopen", verb, { via: "form", matched: "xyz" })).toBeNull();
    expect(grammarNote("lopen", verb, { via: "form", matched: "Lopen" })).toBeNull();
  });
});

describe("duplicate detection across forms", () => {
  it("a conjugated form finds the infinitive's sense already in the deck", async () => {
    const lopen = await itemsFor("lopen");
    const deck = deckMembership([lopen[0].entry]);
    const liep = await itemsFor("liep");
    const same = liep.find((i) => i.snapshot.senseId === lopen[0].snapshot.senseId);
    expect(same).toBeDefined();
    expect(deck.has(same!.snapshot)).toBe(true);
  });
});
