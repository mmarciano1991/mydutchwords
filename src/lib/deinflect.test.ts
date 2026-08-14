import { describe, expect, it } from "vitest";
import { deinflect } from "./deinflect";

// A fake dictionary — deinflect only ever needs a yes/no predicate, so the
// real bundled dictionary (or a network call) is never part of this test.
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
]);
const lookup = (term: string) => DICT.has(term);

describe("deinflect", () => {
  it("strips a plural -s", () => {
    expect(deinflect("huurders", lookup)).toEqual({ lemma: "huurder", reason: "plural" });
  });

  it("strips a plural -en with no spelling change", () => {
    expect(deinflect("maatregelen", lookup)).toEqual({ lemma: "maatregel", reason: "plural" });
  });

  it("strips a plural -en and doubles the vowel back (afspraak, not afsprak)", () => {
    expect(deinflect("afspraken", lookup)).toEqual({ lemma: "afspraak", reason: "plural" });
  });

  it("strips a comparative -der (after a stem already ending in r)", () => {
    expect(deinflect("duurder", lookup)).toEqual({ lemma: "duur", reason: "comparative" });
  });

  it("strips a comparative -er with no spelling change", () => {
    expect(deinflect("kleiner", lookup)).toEqual({ lemma: "klein", reason: "comparative" });
  });

  it("strips a comparative -er and doubles the vowel back (groot, not grot)", () => {
    expect(deinflect("groter", lookup)).toEqual({ lemma: "groot", reason: "comparative" });
  });

  it("strips a -je diminutive", () => {
    expect(deinflect("huisje", lookup)).toEqual({ lemma: "huis", reason: "diminutive" });
  });

  it("strips a -je diminutive off a word ending in p", () => {
    expect(deinflect("kopje", lookup)).toEqual({ lemma: "kop", reason: "diminutive" });
  });

  it("turns a regular past participle back into its infinitive", () => {
    expect(deinflect("gewerkt", lookup)).toEqual({ lemma: "werken", reason: "past participle" });
  });

  it("turns a past participle into its infinitive, doubling the consonant back (bellen, not belen)", () => {
    expect(deinflect("gebeld", lookup)).toEqual({ lemma: "bellen", reason: "past participle" });
  });

  it("looks up an irregular (ablaut) past participle from the hand-authored list", () => {
    expect(deinflect("gestegen", lookup)).toEqual({ lemma: "stijgen", reason: "past participle" });
    expect(deinflect("toegenomen", lookup)).toEqual({ lemma: "toenemen", reason: "past participle" });
    expect(deinflect("verboden", lookup)).toEqual({ lemma: "verbieden", reason: "past participle" });
  });

  it("is case-insensitive", () => {
    expect(deinflect("Huurders", lookup)).toEqual({ lemma: "huurder", reason: "plural" });
  });

  it("returns null when no candidate is a real word — never offers a guess", () => {
    // The exact failure this replaces: "gestegen" used to suggest "gisteren"
    // (an unrelated word, edit-distance close) instead of resolving to
    // "stijgen" or finding nothing. A rule firing on the wrong word must
    // fail silently, not produce a wrong answer.
    expect(deinflect("gisteren", lookup)).toBeNull();
    expect(deinflect("bus", lookup)).toBeNull(); // strips to "bu" — not a word
    expect(deinflect("kaas", lookup)).toBeNull(); // strips to "kaa" — not a word
  });

  it("returns null for words too short or not plain lowercase letters", () => {
    expect(deinflect("op", lookup)).toBeNull();
    expect(deinflect("wifi-wachtwoord", lookup)).toBeNull();
    expect(deinflect("3weken", lookup)).toBeNull();
  });

  it("never returns the input word as its own explanation", () => {
    // A word already in the dictionary is never passed here by the caller
    // (only misses are), but the guard is load-bearing on its own: without
    // it, a rule whose stripped candidate happens to equal the input could
    // report a word as an inflection of itself.
    const selfDict = new Set(["bus"]); // "bus" itself is "in the dictionary"
    expect(deinflect("bus", (t) => selfDict.has(t))).toBeNull();
  });
});
