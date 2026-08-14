import { describe, expect, it } from "vitest";
import { deinflect } from "./deinflect";

// A fake dictionary — deinflect only ever needs a yes/no predicate, so the
// real bundled dictionary (or a network call) is never part of this test.
// Includes both members of each real-world ambiguous pair (slot/sloot,
// bek/beek) so the array-of-candidates behaviour has something to exercise.
const DICT = new Set([
  "huurder",
  "maatregel",
  "afspraak",
  "duur",
  "klein",
  "groot",
  "huis",
  "kop",
  "werken",
  "bellen",
  "stijgen",
  "toenemen",
  "verbieden",
  "slot",
  "sloot",
  "bek",
  "beek",
  "aanhoudend",
]);
const lookup = (term: string) => DICT.has(term);

describe("deinflect", () => {
  it("strips a plural -s", () => {
    expect(deinflect("huurders", lookup)).toEqual([{ lemma: "huurder", reason: "plural" }]);
  });

  it("strips a plural -en with no spelling change", () => {
    expect(deinflect("maatregelen", lookup)).toEqual([{ lemma: "maatregel", reason: "plural" }]);
  });

  it("strips a plural -en and doubles the vowel back (afspraak, not afsprak)", () => {
    expect(deinflect("afspraken", lookup)).toEqual([{ lemma: "afspraak", reason: "plural" }]);
  });

  it("strips a comparative -der (after a stem already ending in r)", () => {
    expect(deinflect("duurder", lookup)).toEqual([{ lemma: "duur", reason: "comparative" }]);
  });

  it("strips a comparative -er with no spelling change", () => {
    expect(deinflect("kleiner", lookup)).toEqual([{ lemma: "klein", reason: "comparative" }]);
  });

  it("strips a comparative -er and doubles the vowel back (groot, not grot)", () => {
    expect(deinflect("groter", lookup)).toEqual([{ lemma: "groot", reason: "comparative" }]);
  });

  it("strips a -je diminutive", () => {
    expect(deinflect("huisje", lookup)).toEqual([{ lemma: "huis", reason: "diminutive" }]);
  });

  it("strips a -je diminutive off a word ending in p", () => {
    expect(deinflect("kopje", lookup)).toEqual([{ lemma: "kop", reason: "diminutive" }]);
  });

  it("turns a regular past participle back into its infinitive", () => {
    expect(deinflect("gewerkt", lookup)).toEqual([{ lemma: "werken", reason: "past participle" }]);
  });

  it("turns a past participle into its infinitive, doubling the consonant back (bellen, not belen)", () => {
    expect(deinflect("gebeld", lookup)).toEqual([{ lemma: "bellen", reason: "past participle" }]);
  });

  it("looks up an irregular (ablaut) past participle from the hand-authored list", () => {
    expect(deinflect("gestegen", lookup)).toEqual([{ lemma: "stijgen", reason: "past participle" }]);
    expect(deinflect("toegenomen", lookup)).toEqual([{ lemma: "toenemen", reason: "past participle" }]);
    expect(deinflect("verboden", lookup)).toEqual([{ lemma: "verbieden", reason: "past participle" }]);
  });

  it("is case-insensitive", () => {
    expect(deinflect("Huurders", lookup)).toEqual([{ lemma: "huurder", reason: "plural" }]);
  });

  it("returns [] when no candidate is a real word — never offers a guess", () => {
    // The exact failure this replaces: "gestegen" used to suggest "gisteren"
    // (an unrelated word, edit-distance close) instead of resolving to
    // "stijgen" or finding nothing. A rule firing on the wrong word must
    // fail silently, not produce a wrong answer.
    expect(deinflect("gisteren", lookup)).toEqual([]);
    expect(deinflect("kaas", lookup)).toEqual([]); // strips to "kaa" — not a word
  });

  it("returns [] for words too short or not plain lowercase letters", () => {
    expect(deinflect("op", lookup)).toEqual([]);
    expect(deinflect("wifi-wachtwoord", lookup)).toEqual([]);
    expect(deinflect("3weken", lookup)).toEqual([]);
  });

  it("never returns the input word as its own explanation", () => {
    // A word already in the dictionary is never passed here by the caller
    // (only misses are), but the guard is load-bearing on its own: without
    // it, a rule whose stripped candidate happens to equal the input could
    // report a word as an inflection of itself.
    const selfDict = new Set(["bus"]); // "bus" itself is "in the dictionary"
    expect(deinflect("bus", (t) => selfDict.has(t))).toEqual([]);
  });

  describe("ambiguous inflections — the run-05 finding", () => {
    it("returns BOTH real candidates for sloten (locks, plural of slot; ditches, plural of sloot)", () => {
      // Run 05: this used to return only "slot" (lock) — silently wrong for
      // an article that meant "sloot" (ditch) — because the old contract
      // stopped at the first dictionary hit. Both are real words, so both
      // come back; the caller decides, it isn't guessed here.
      const hits = deinflect("sloten", lookup);
      expect(hits).toHaveLength(2);
      expect(hits).toEqual(
        expect.arrayContaining([
          { lemma: "slot", reason: "plural" },
          { lemma: "sloot", reason: "plural" },
        ])
      );
    });

    it("returns both candidates for beken (mouths, plural of bek; streams, plural of beek)", () => {
      const hits = deinflect("beken", lookup);
      expect(hits).toHaveLength(2);
      expect(hits).toEqual(
        expect.arrayContaining([
          { lemma: "bek", reason: "plural" },
          { lemma: "beek", reason: "plural" },
        ])
      );
    });

    it("still returns a single candidate when only one is real", () => {
      // "huurders" only ever resolves one way — no dictionary has both
      // "huurder" and a same-shaped rival, so this must not regress into
      // manufacturing false ambiguity.
      expect(deinflect("huurders", lookup)).toEqual([{ lemma: "huurder", reason: "plural" }]);
    });
  });

  describe("adjective agreement — the -e ending", () => {
    it("strips a bare trailing -e with no spelling change", () => {
      expect(deinflect("aanhoudende", lookup)).toEqual([
        { lemma: "aanhoudend", reason: "adjective agreement" },
      ]);
    });

    it("strips -e and doubles the vowel back (groot, not grot)", () => {
      const dict = new Set(["groot"]);
      expect(deinflect("grote", (t) => dict.has(t))).toEqual([
        { lemma: "groot", reason: "adjective agreement" },
      ]);
    });

    it("only runs once every more specific rule has failed", () => {
      // "kleine" matches the -e agreement rule (→ "klein") but ALSO happens
      // to be four letters away from matching nothing more specific — this
      // confirms the fallback still fires when nothing else does, without
      // ever running alongside a specific rule that already found an answer.
      const dict = new Set(["klein"]);
      expect(deinflect("kleine", (t) => dict.has(t))).toEqual([
        { lemma: "klein", reason: "adjective agreement" },
      ]);
    });

    it("never runs once a more specific rule already matched", () => {
      // "kopje" ends in "e", so the agreement rule's own pattern would also
      // fire on it (stem "kopj") — it just isn't tried, because the
      // diminutive rule already found "kop". Put "kopj" in the dictionary
      // too, reachable ONLY through the agreement rule: if it ever appeared
      // in the result, that would prove the fallback ran when it shouldn't
      // have, alongside a rule that had already succeeded.
      const dict = new Set(["kop", "kopj"]);
      expect(deinflect("kopje", (t) => dict.has(t))).toEqual([
        { lemma: "kop", reason: "diminutive" },
      ]);
    });
  });
});
