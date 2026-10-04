import { describe, expect, it } from "vitest";
import { entriesGlossed, lookupLocal, parseSenseKey, resolveEntry, senseKey } from "./wordSources";

describe("sense keys", () => {
  it("gives the primary meaning the bare word as its key", () => {
    // Load-bearing for compatibility, not just tidiness: every deck saved
    // before senses existed stores bare word ids, and they must keep
    // resolving to the primary meaning without a migration step.
    expect(senseKey("aanslag", 0)).toBe("aanslag");
  });

  it("suffixes every other meaning", () => {
    expect(senseKey("aanslag", 1)).toBe("aanslag#1");
    expect(senseKey("aanslag", 2)).toBe("aanslag#2");
  });

  it("round-trips", () => {
    expect(parseSenseKey("aanslag")).toEqual({ baseId: "aanslag", index: 0 });
    expect(parseSenseKey("aanslag#1")).toEqual({ baseId: "aanslag", index: 1 });
  });

  it("treats a malformed suffix as the primary meaning rather than throwing", () => {
    // A stray "#" in stored data must degrade to "the word's first meaning",
    // which is always a real answer, instead of resolving to nothing.
    expect(parseSenseKey("aanslag#")).toEqual({ baseId: "aanslag#", index: 0 });
    expect(parseSenseKey("aanslag#x")).toEqual({ baseId: "aanslag#x", index: 0 });
    expect(parseSenseKey("aanslag#-1")).toEqual({ baseId: "aanslag#-1", index: 0 });
  });
});

describe("resolving a word to its meanings", () => {
  it("returns every meaning of a word with a hand-authored second sense", () => {
    // "aanslag" is the run-04 word: a municipal letter means a tax
    // assessment, and the dictionary's own gloss is the attack sense.
    const entry = lookupLocal("aanslag");
    expect(entry).toBeDefined();
    expect(entry!.senses.length).toBeGreaterThan(1);
    const glosses = entry!.senses.map((s) => s.english.toLowerCase());
    expect(glosses.some((g) => g.includes("tax"))).toBe(true);
  });

  it("splits a packed gloss into separate meanings", () => {
    // "stallen" ships as the single string "to park; to put away". Those are
    // two meanings, and holding them in one slot is what made a wrong one
    // unreachable.
    const entry = lookupLocal("stallen");
    expect(entry).toBeDefined();
    expect(entry!.senses.length).toBeGreaterThan(1);
    expect(entry!.senses[1].provisional).toBe(true);
  });

  it("keeps the primary meaning as the entry's own top-level fields", () => {
    const entry = lookupLocal("stallen")!;
    expect(entry.english).toBe(entry.senses[0].english);
    expect(entry.gender).toBe(entry.senses[0].gender);
  });

  it("resolves a non-primary sense key to that meaning, keyed by it", () => {
    const word = lookupLocal("stallen")!;
    const second = resolveEntry("stallen#1");
    expect(second).toBeDefined();
    expect(second!.id).toBe("stallen#1");
    expect(second!.dutch).toBe("stallen");
    expect(second!.english).toBe(word.senses[1].english);
    // It still knows its siblings, so a screen showing this card can offer
    // the word's other meanings rather than presenting this as the whole word.
    expect(second!.senses.length).toBe(word.senses.length);
  });

  it("returns undefined for a meaning that doesn't exist", () => {
    expect(resolveEntry("stallen#99")).toBeUndefined();
  });

  it("distinguishes 'takes no article' from 'article not established'", () => {
    // The distinction the whole Gender change exists for. A verb is "none";
    // it must never read as a gap.
    expect(lookupLocal("lopen")!.gender).toBe("none");
    expect(lookupLocal("huis")!.gender).toBe("het");
  });
});

describe("every entry is complete", () => {
  it("never resolves a word to zero meanings", () => {
    // The invariant the type now enforces and this guards at runtime: a word
    // with no meaning at all was representable before, and unfindable when it
    // happened.
    for (const word of ["huis", "aanslag", "stallen", "de", "krijgen", "belasting"]) {
      const entry = lookupLocal(word);
      expect(entry, word).toBeDefined();
      expect(entry!.senses.length, word).toBeGreaterThan(0);
      expect(entry!.senses[0].english, word).not.toBe("");
    }
  });
});

describe("entriesGlossed", () => {
  // Typing "buur" for "neighbour" is right even when only "buurman" is in
  // the deck: the synonyms come from the whole dictionary.
  it("finds every bundled word with the same gloss", () => {
    const words = entriesGlossed("Neighbour").map((e) => e.dutch);
    expect(words).toEqual(expect.arrayContaining(["buurman", "buur"]));
  });

  it("finds nothing for a gloss no word has", () => {
    expect(entriesGlossed("zzz not a gloss")).toEqual([]);
  });
});
