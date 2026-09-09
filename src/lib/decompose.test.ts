import { describe, expect, it } from "vitest";
import { decompose } from "./decompose";

// A fake dictionary, same approach as deinflect's tests: decompose only ever
// needs a yes/no predicate, so the real 14k-word bundle never loads here.
const DICT = new Set([
  "belasting",
  "aanslag",
  "huur",
  "toeslag",
  "bezwaar",
  "schrift",
  "betaling",
  "regeling",
  "inburgering",
  "cursus",
  "zorg",
  "verzekering",
  "gemeente",
  "huis",
  "boek",
  "kast",
  "ziekte",
  "kosten",
  // Short words that exist but must never be used to split a longer word —
  // the false-positive case the MIN_PART guard is for.
  "kan",
  "aal",
  "kanaal",
  "oor",
  "deel",
  "oordeel",
]);
const lookup = (t: string) => DICT.has(t);

describe("decompose", () => {
  it("splits a plain two-part compound", () => {
    expect(decompose("belastingaanslag", lookup)).toEqual([
      { parts: ["belasting", "aanslag"], head: "aanslag" },
    ]);
  });

  it("splits when the first part is short but still a real word", () => {
    expect(decompose("huurtoeslag", lookup)).toEqual([
      { parts: ["huur", "toeslag"], head: "toeslag" },
    ]);
  });

  it("splits across a linking -s- that belongs to neither part", () => {
    expect(decompose("betalingsregeling", lookup)).toEqual([
      { parts: ["betaling", "regeling"], head: "regeling" },
    ]);
    expect(decompose("inburgeringscursus", lookup)).toEqual([
      { parts: ["inburgering", "cursus"], head: "cursus" },
    ]);
  });

  it("splits across a linking -en-", () => {
    expect(decompose("boekenkast", lookup)).toEqual([{ parts: ["boek", "kast"], head: "kast" }]);
  });

  it("splits a three-part compound", () => {
    const [first] = decompose("ziektekostenverzekering", lookup);
    expect(first).toEqual({
      parts: ["ziekte", "kosten", "verzekering"],
      head: "verzekering",
    });
  });

  it("reports the LAST part as the head — Dutch compounds are head-final", () => {
    // "gemeentehuis" is a kind of house, not a kind of municipality, so
    // "huis" is what carries the meaning and the article.
    expect(decompose("gemeentehuis", lookup)[0].head).toBe("huis");
  });

  it("resolves an inflected head back to its base form", () => {
    // A plural compound has to reach the singular head, or its gloss is
    // unfindable: "belastingaanslagen" → belasting + aanslag.
    expect(decompose("belastingaanslagen", lookup)).toEqual([
      { parts: ["belasting", "aanslag"], head: "aanslag" },
    ]);
  });

  it("never splits a word that is itself in the dictionary", () => {
    // "kanaal" is a word. That it also happens to be "kan" + "aal" is a
    // coincidence, and re-explaining a real headword as a compound of two
    // others is strictly worse than saying nothing.
    expect(decompose("kanaal", lookup)).toEqual([]);
    expect(decompose("oordeel", lookup)).toEqual([]);
  });

  it("never builds a split out of parts below the minimum length", () => {
    // Even with "kanaal" removed from the dictionary, "kan" + "aal" must not
    // be offered: three-letter parts turn long words into confident nonsense.
    const noKanaal = new Set(DICT);
    noKanaal.delete("kanaal");
    expect(decompose("kanaal", (t) => noKanaal.has(t))).toEqual([]);
  });

  it("splits at the shortest length it will consider — two four-letter parts", () => {
    // 8 characters is the floor, and it's the floor precisely because two
    // MIN_PART-length words is the shortest real compound there can be.
    expect(decompose("huurhuis", lookup)).toEqual([{ parts: ["huur", "huis"], head: "huis" }]);
  });

  it("ignores words too short to be worth splitting", () => {
    expect(decompose("zorg", lookup)).toEqual([]);
    expect(decompose("boekjes", lookup)).toEqual([]); // 7 chars — below the floor
  });

  it("ignores anything that isn't plain letters", () => {
    expect(decompose("wifi-wachtwoord", lookup)).toEqual([]);
    expect(decompose("belasting aanslag", lookup)).toEqual([]);
  });

  it("returns [] when the parts simply aren't words", () => {
    expect(decompose("xyzzyplughblah", lookup)).toEqual([]);
  });
});
