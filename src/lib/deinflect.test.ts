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
  // — added with the wider rule set (Phase A) —
  "lopen",
  "betalen",
  "verhuizen",
  "leven",
  "huren",
  "opnemen",
  "aankomen",
  "uitleggen",
  "zoeken",
  "opzoeken",
  "kind",
  "ei",
  "stad",
  "museum",
  "auto",
  "hoog",
  "goed",
  "sluiten",
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
    it("returns EVERY real candidate for sloten (slot, sloot, and sluiten)", () => {
      // Run 05: this used to return only "slot" (lock) — silently wrong for
      // an article that meant "sloot" (ditch) — because the old contract
      // stopped at the first dictionary hit. All are real words, so all come
      // back; the caller decides, it isn't guessed here.
      //
      // Phase A added a third genuine reading: "sloten" is also the past
      // tense of "sluiten" (to close). That it appears here is the rule set
      // getting MORE right, not less — the whole point of this contract is
      // that a real reading is never dropped to make the answer look tidy.
      const hits = deinflect("sloten", lookup);
      expect(hits.map((h) => h.lemma).sort()).toEqual(["sloot", "slot", "sluiten"]);
      expect(hits).toEqual(
        expect.arrayContaining([
          { lemma: "slot", reason: "plural" },
          { lemma: "sloot", reason: "plural" },
          { lemma: "sluiten", reason: "past tense" },
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
  describe("verb forms — the bulk of what real Dutch writes", () => {
    it("resolves the bare present stem, respelling the syllable (loop → lopen)", () => {
      expect(deinflect("loop", lookup)).toEqual([{ lemma: "lopen", reason: "present tense" }]);
    });

    it("resolves a -t present form (loopt → lopen, werkt → werken)", () => {
      expect(deinflect("loopt", lookup)).toEqual([{ lemma: "lopen", reason: "present tense" }]);
      expect(deinflect("werkt", lookup)).toEqual([{ lemma: "werken", reason: "present tense" }]);
    });

    it("doubles the consonant back on a short stem (belt → bellen)", () => {
      expect(deinflect("belt", lookup)).toEqual([{ lemma: "bellen", reason: "present tense" }]);
    });

    it("resolves weak past tense, singular and plural", () => {
      expect(deinflect("werkte", lookup)).toEqual([{ lemma: "werken", reason: "past tense" }]);
      expect(deinflect("werkten", lookup)).toEqual([{ lemma: "werken", reason: "past tense" }]);
      expect(deinflect("betaalde", lookup)).toEqual([{ lemma: "betalen", reason: "past tense" }]);
      expect(deinflect("huurden", lookup)).toEqual([{ lemma: "huren", reason: "past tense" }]);
    });

    it("resolves strong past tense from the table (liep → lopen)", () => {
      expect(deinflect("liep", lookup)).toEqual([{ lemma: "lopen", reason: "past tense" }]);
    });

    it("resolves a strong participle from the table (gelopen → lopen)", () => {
      expect(deinflect("gelopen", lookup)).toEqual([{ lemma: "lopen", reason: "past participle" }]);
    });

    it("resolves a participle whose prefix blocks ge- (betaald, verhuisd)", () => {
      // "be-"/"ver-" already occupy the slot "ge-" would take, so these look
      // exactly like a present-tense -t/-d form and used to resolve to nothing.
      expect(deinflect("betaald", lookup)).toEqual([
        { lemma: "betalen", reason: "past participle" },
      ]);
      expect(deinflect("verhuisd", lookup)).toEqual([
        { lemma: "verhuizen", reason: "past participle" },
      ]);
    });

    it("un-devoices a final s/f back to z/v (verhuis → verhuizen, leef → leven)", () => {
      expect(deinflect("verhuis", lookup)).toEqual([
        { lemma: "verhuizen", reason: "present tense" },
      ]);
      expect(deinflect("leef", lookup)).toEqual([{ lemma: "leven", reason: "present tense" }]);
    });

    it("peels a separable prefix and puts it back (opgenomen → opnemen)", () => {
      // The "ge-" sits INSIDE the compound, so no rule that expects a
      // word-initial "ge-" can see it.
      expect(deinflect("opgenomen", lookup)).toEqual([
        { lemma: "opnemen", reason: "past participle" },
      ]);
      expect(deinflect("aangekomen", lookup)).toEqual([
        { lemma: "aankomen", reason: "past participle" },
      ]);
      expect(deinflect("uitgelegd", lookup)).toEqual([
        { lemma: "uitleggen", reason: "past participle" },
      ]);
      expect(deinflect("opgezocht", lookup)).toEqual([
        { lemma: "opzoeken", reason: "past participle" },
      ]);
    });

    it("does not peel a prefix off an ordinary word that merely starts with one", () => {
      // "inkomen" and "overleg" begin with separable prefixes but are plain
      // words; only the "ge-" shape is ever peeled.
      const dict = new Set(["komen", "leg"]);
      expect(deinflect("inkomen", (t) => dict.has(t))).toEqual([]);
      expect(deinflect("overleg", (t) => dict.has(t))).toEqual([]);
    });
  });

  describe("noun plurals beyond -s and -en", () => {
    it("resolves an -eren plural (kinderen → kind, eieren → ei)", () => {
      expect(deinflect("kinderen", lookup)).toEqual([{ lemma: "kind", reason: "plural" }]);
      expect(deinflect("eieren", lookup)).toEqual([{ lemma: "ei", reason: "plural" }]);
    });

    it("resolves a stem-changing plural from the table (steden → stad)", () => {
      expect(deinflect("steden", lookup)).toEqual([{ lemma: "stad", reason: "plural" }]);
    });

    it("resolves a Latin plural (musea → museum)", () => {
      expect(deinflect("musea", lookup)).toEqual([{ lemma: "museum", reason: "plural" }]);
    });

    it("resolves an apostrophe plural, which isn't plain letters (auto's → auto)", () => {
      expect(deinflect("auto's", lookup)).toEqual([{ lemma: "auto", reason: "plural" }]);
    });
  });

  describe("superlatives", () => {
    it("strips a bare -st and an inflected -ste", () => {
      expect(deinflect("hoogst", lookup)).toEqual([{ lemma: "hoog", reason: "superlative" }]);
      expect(deinflect("kleinste", lookup)).toEqual([{ lemma: "klein", reason: "superlative" }]);
    });

    it("doubles the vowel back (grootst → groot)", () => {
      expect(deinflect("grootst", lookup)).toEqual([{ lemma: "groot", reason: "superlative" }]);
    });

    it("resolves a suppletive superlative (beste → goed)", () => {
      expect(deinflect("beste", lookup)).toEqual([{ lemma: "goed", reason: "superlative" }]);
    });
  });

});
