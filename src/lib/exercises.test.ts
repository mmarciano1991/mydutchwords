import { describe, expect, it } from "vitest";
import { buildEnglishChoices, buildListeningChoices, matchingLabels, posHint, synonymsOf } from "./exercises";
import type { DictionaryEntry, Gender } from "./types";

function entry(dutch: string, english: string, gender: Gender = "none"): DictionaryEntry {
  const sense = { english, example: "", exampleEn: "", gender };
  return { id: dutch, dutch, english, gender, example: "", exampleEn: "", senses: [sense] };
}

/** Deterministic stand-in for Math.random. */
function seeded(seed = 1): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

describe("buildEnglishChoices (Multiple Choice)", () => {
  const meet = entry("ontmoeten", "to meet");
  const pool = [
    meet,
    entry("volgen", "to follow"),
    entry("vertrekken", "to leave"),
    entry("corrigeren", "to correct"),
    entry("betalen", "to pay"),
    entry("tegenwoordig", "nowadays"),
    entry("huis", "house", "het"),
  ];

  it("offers the English answer and three distractors, once each", () => {
    const options = buildEnglishChoices(meet, pool, seeded())!;
    expect(options).toHaveLength(4);
    expect(options).toContain("to meet");
    expect(new Set(options).size).toBe(4);
  });

  it("prefers distractors of the same part of speech", () => {
    for (let s = 1; s < 20; s++) {
      const options = buildEnglishChoices(meet, pool, seeded(s))!;
      expect(options.every((o) => o.startsWith("to "))).toBe(true);
    }
  });

  it("never offers a synonym of the answer", () => {
    const withSynonym = [...pool, entry("treffen", "to meet")];
    for (let s = 1; s < 20; s++) {
      expect(buildEnglishChoices(meet, withSynonym, seeded(s))!.filter((o) => o === "to meet")).toHaveLength(1);
    }
  });

  it("never offers a word sharing any meaning with the answer", () => {
    const park: DictionaryEntry = {
      ...entry("parkeren", "to park"),
      senses: [
        { english: "to park", example: "", exampleEn: "", gender: "none" },
        { english: "to put away", example: "", exampleEn: "", gender: "none" },
      ],
    };
    const options = buildEnglishChoices(park, [...pool, entry("opbergen", "to put away")], seeded())!;
    expect(options).not.toContain("to put away");
  });

  it("returns null with fewer than three other words", () => {
    expect(buildEnglishChoices(meet, pool.slice(0, 3))).toBeNull();
  });

  it("tops a small deck up from the dictionary — the deck's own words first", () => {
    const deck = [meet, entry("volgen", "to follow")];
    const dictionary = [
      entry("lopen", "to walk"),
      entry("treffen", "to meet"), // a synonym: never offered
      entry("volgen", "to follow"), // already in the deck
      entry("zitten", "to sit"),
      entry("eten", "to eat"),
      entry("tafel", "table", "de"),
    ];
    for (let s = 1; s < 10; s++) {
      const options = buildEnglishChoices(meet, deck, seeded(s), dictionary)!;
      expect(options).toHaveLength(4);
      expect(options).toContain("to meet");
      expect(options).toContain("to follow");
      expect(options.filter((o) => o === "to meet")).toHaveLength(1);
      expect(new Set(options).size).toBe(4);
      // Same part of speech first: the noun is only a last resort.
      expect(options).not.toContain("table");
    }
  });

  it("doesn't touch the dictionary when the deck is big enough", () => {
    const options = buildEnglishChoices(meet, pool, seeded(), [entry("lopen", "to walk")])!;
    expect(options).not.toContain("to walk");
  });
});

describe("matchingLabels (Matching)", () => {
  it("shows one gloss per word", () => {
    expect(matchingLabels([entry("optie", "option / choice"), entry("zwaar", "heavy")])).toEqual(["option", "heavy"]);
  });

  it("skips a gloss another word on the grid also has", () => {
    const grid = [entry("ander", "other / another / different"), entry("verschillend", "different / various / diverse")];
    expect(matchingLabels(grid)).toEqual(["other", "various"]);
  });

  it("falls back to the first gloss when every one is shared", () => {
    expect(matchingLabels([entry("ziek", "sick / ill"), entry("misselijk", "ill / sick")])).toEqual(["sick", "ill"]);
  });
});

describe("buildListeningChoices", () => {
  const huis = entry("huis", "house", "het");
  const pool = [huis, entry("huid", "skin"), entry("thuis", "home"), entry("muis", "mouse"), entry("tegenwoordig", "nowadays"), entry("vertrekken", "to leave")];

  it("offers the word and the three most similar-looking deck words", () => {
    const options = buildListeningChoices(huis, pool, seeded())!;
    expect(options.sort()).toEqual(["huid", "huis", "muis", "thuis"]);
  });

  it("returns null when the deck can't supply three others", () => {
    expect(buildListeningChoices(huis, pool.slice(0, 3))).toBeNull();
  });

  it("tops up look-alikes from the dictionary when the deck is small", () => {
    const fiets = entry("fiets", "bicycle", "de");
    const filler = [entry("vies", "dirty"), entry("vis", "fish", "de"), entry("feest", "party", "het"), entry("tegenwoordig", "nowadays")];
    const options = buildListeningChoices(fiets, [fiets], seeded(), filler)!;
    expect(options.sort()).toEqual(["feest", "fiets", "vies", "vis"]);
  });
});

describe("posHint (Active Recall)", () => {
  it("names a noun with its article, and a verb", () => {
    expect(posHint(entry("huis", "house", "het"))).toBe("noun · het");
    expect(posHint(entry("ontmoeten", "to meet"))).toBe("verb");
  });

  it("uses a known part of speech from the dictionary label, and nothing otherwise", () => {
    const snel = { ...entry("snel", "fast"), senses: [{ english: "fast", example: "", exampleEn: "", gender: "none" as const, label: "Adjective" }] };
    expect(posHint(snel)).toBe("adjective");
    expect(posHint(entry("tegenwoordig", "nowadays"))).toBeNull();
  });
});

describe("synonymsOf", () => {
  it("finds deck words with the same meaning", () => {
    const meet = entry("ontmoeten", "to meet");
    expect(synonymsOf(meet, [meet, entry("treffen", "to meet"), entry("volgen", "to follow")])).toEqual(["treffen"]);
  });
});
