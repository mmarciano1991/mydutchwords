/* The pure dictionary rules: normalization, typo distance, the gloss rule,
   target spans, compound splitting. */
import { describe, expect, it } from "vitest";
import { condenseGloss, findTargetSpans, glossIssues, isCognate } from "./checks";
import { decomposeCompound, resolveAbbreviatedCoordination } from "./compound";
import { isTypoOf, rankTypos } from "./fuzzy";
import { confusionKey, prefixLength, searchKey, stripEdgePunctuation } from "./normalize";

describe("search keys", () => {
  it.each([
    ["hygiëne", "hygiene"],
    ["IJsselmeer", "ijsselmeer"],
    ["ĳzer", "ijzer"],
    ["auto’s", "autos"],
    ["zzp'er", "zzper"],
    ["e-mail", "email"],
    ["vice-voorzitter", "vicevoorzitter"],
    ["i.p.v.", "ipv"],
    ["één", "een"],
    ["'s ochtends", "sochtends"],
  ])("%s → %s", (form, key) => expect(searchKey(form)).toBe(key));

  it("strips punctuation from the edges of a pasted word, keeping 's and i.p.v.", () => {
    expect(stripEdgePunctuation("(termijn),")).toBe("termijn");
    expect(stripEdgePunctuation("“huur”")).toBe("huur");
    expect(stripEdgePunctuation("i.p.v.")).toBe("i.p.v.");
    expect(stripEdgePunctuation("'s")).toBe("'s");
  });

  it("highlights the typed prefix in the displayed form, through apostrophes", () => {
    expect(prefixLength("auto's", "autos")).toBe(6);
    expect(prefixLength("IJsselmeer", "ijs")).toBe(3);
    expect(prefixLength("huis", "bo")).toBe(0);
  });
});

describe("typos", () => {
  it("learner confusions cost half an edit", () => {
    expect(confusionKey("klijn")).toBe(confusionKey("klein"));
    expect(confusionKey("yzer")).toBe(confusionKey("ijzer"));
    expect(isTypoOf("klijn", "klein")).toBe(true);
    expect(isTypoOf("yzer", "ijzer")).toBe(true);
    expect(isTypoOf("goud", "gout")).toBe(true);
  });

  it("≤ 1 edit up to 6 letters, ≤ 2 for longer, same first letter", () => {
    expect(isTypoOf("huis", "muis")).toBe(false);
    expect(isTypoOf("huis", "huid")).toBe(true);
    expect(isTypoOf("termyjn", "termijn")).toBe(true);
    expect(isTypoOf("tafell", "tafels")).toBe(true);
  });

  it("at most 3 suggestions, closest first", () => {
    const c = ["klein", "kleine", "kluit", "klem", "kleur"].map((form, i) => ({ form, frequency: i }));
    const r = rankTypos("klijn", c);
    expect(r.length).toBeLessThanOrEqual(3);
    expect(r[0].form).toBe("klein");
  });
});

describe("the gloss rule", () => {
  it.each([
    ["a house, home; residence", "house"],
    ["to call (up) (to contact by telephone)", "to call (up)"],
    ["a ball or any object with such a shape", "ball"],
    ["scratch on a hard, smooth surface", "scratch on a hard, smooth surface"],
    ["a lake in the Netherlands, formerly part of the Zuiderzee", "lake in the Netherlands"],
  ])("%s → %s", (raw, short) => expect(condenseGloss(raw)).toBe(short));

  it("at most 3 content words plus a parenthetical, one meaning", () => {
    expect(glossIssues("to feel like (something)")).toEqual([]);
    expect(glossIssues("tax assessment")).toEqual([]);
    expect(glossIssues("power, control")).toContain("more than one meaning");
    expect(glossIssues("place where seashells are found").length).toBeGreaterThan(0);
  });

  it("knows a cognate", () => {
    expect(isCognate("sauna", "sauna")).toBe(true);
    expect(isCognate("podcast", "podcast")).toBe(true);
    expect(isCognate("huis", "house")).toBe(false);
  });
});

describe("target spans", () => {
  it("two spans for a split separable verb", () => {
    expect(findTargetSpans("Ik bel je morgen op.", ["opbellen", "bel op"])).toEqual([[3, 6], [17, 19]]);
  });

  it("one span for a unit written together", () => {
    expect(findTargetSpans("Ik heb zin in koffie.", ["heb zin in"])).toEqual([[3, 13]]);
  });

  it("null when the word isn't there", () => {
    expect(findTargetSpans("Het regent.", ["huis"])).toBeNull();
  });
});

describe("compounds", () => {
  const known = new Set(["belasting", "aanslag", "huur", "toeslag", "huurtoeslag", "aanvraag", "test", "tunnel", "boek", "kast", "kind", "opvang", "rijst", "brij", "zee", "egel"]);
  const lookup = (k: string) => (known.has(k) ? { wordId: k, form: k, kind: "word" as const, frequency: 10, isLemma: true } : undefined);
  const parts = (w: string) => {
    const flat = (n: ReturnType<typeof decomposeCompound>): string[] => (!n ? [] : n.left && n.right ? [...flat(n.left), ...(n.link ? [`-${n.link}-`] : []), ...flat(n.right)] : [n.form]);
    return flat(decomposeCompound(w, lookup));
  };

  it.each([
    ["boekenkast", ["boek", "-en-", "kast"]],
    ["kinderopvang", ["kind", "-er-", "opvang"]],
    ["rijstebrij", ["rijst", "-e-", "brij"]],
    ["zee-egel", ["zee", "---", "egel"]],
    ["huurtoeslagaanvraag", ["huurtoeslag", "aanvraag"]],
  ])("%s → %j", (w, expected) => expect(parts(w)).toEqual(expected));

  it("never invents a joint", () => {
    expect(decomposeCompound("boekxkast", lookup)).toBeNull();
  });

  it("splits only into verified parts", () => {
    expect(decomposeCompound("belastingfoobar", lookup)).toBeNull();
  });

  it("resolves an abbreviated pair from the written word's own head", () => {
    const r = resolveAbbreviatedCoordination("in- en uitvoer", {
      splitHead: (w) => (w === "uitvoer" ? { modifier: "uit", head: "voer" } : null),
      isKnownOrDecomposable: (w) => w === "invoer",
    });
    expect(r?.full).toEqual(["invoer", "uitvoer"]);
  });
});
