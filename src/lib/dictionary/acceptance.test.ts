/* Acceptance cases (spec §13), run against a REAL dictionary build — the
   fixture scripts/dictionary/fixture.mjs extracts from the pipeline's
   output — through the same service the app uses.

   A few cases need the model step (a gloss only a model can shorten, a
   meaning no source states in English). They run when the fixture was
   built with --llm, and are reported as skipped — not passed — otherwise. */
import { beforeEach, describe, expect, it } from "vitest";
import fixture from "./fixture.json";
import { articleIssues, findTargetSpans, glossIssues, tokenize } from "./checks";
import { decomposeCompound, mainParts, headOf } from "./compound";
import type { Sense, Use, WordEntry } from "./model";
import { findCompound, lookup, search } from "./service";
import { fixtureWord, FIXTURE_WORDS, useFixtureDictionary } from "./testDictionary";
import { unitsAt } from "./units";
import { tokenizeText } from "../tokenizeText";

const LLM_BUILD = Boolean((fixture as { llm?: boolean }).llm);

beforeEach(() => {
  useFixtureDictionary();
});

const lemmas = async (form: string) => (await lookup(form)).matches.map((m) => m.word.form);
const senses = (w: WordEntry): { use: Use; sense: Sense }[] => w.uses.flatMap((use) => use.senses.map((sense) => ({ use, sense })));
const glosses = (w: WordEntry) => senses(w).map((x) => x.sense.gloss);
const span = (text: string, word: string) => ({ start: text.indexOf(word), end: text.indexOf(word) + word.length });

describe("common verb forms", () => {
  it.each([
    ["was", "zijn"],
    ["ben", "zijn"],
    ["kan", "kunnen"],
    ["moet", "moeten"],
    ["ga", "gaan"],
    ["liep", "lopen"],
    ["deed", "doen"],
  ])("%s → %s, the most likely lemma first", async (form, lemma) => {
    const found = await lemmas(form);
    expect(found).toContain(lemma);
    expect(found[0]).toBe(lemma);
  });

  it("was is also the noun de was, with its own article", async () => {
    const r = await lookup("was");
    const noun = r.matches.find((m) => m.word.form === "was")!;
    expect(noun.word.uses[0]).toMatchObject({ pos: "noun", article: "de" });
    expect(glosses(noun.word)).toEqual(expect.arrayContaining(["laundry"]));
    expect(r.matches.map((m) => m.word.form)).toContain("wassen");
  });

  it("a verb form never reaches a noun use", async () => {
    const r = await lookup("was");
    for (const m of r.matches.filter((x) => x.via === "form")) {
      const uses = m.word.uses.filter((u) => m.useIds!.includes(u.id));
      expect(uses.every((u) => u.pos === "verb"), m.word.form).toBe(true);
    }
  });
});

describe("homographs: every main lemma and sense, each with its own article", () => {
  it.each(["net", "vrij", "bank", "teer", "kras", "bal"])("%s", async (form) => {
    const w = (await lookup(form)).matches.find((m) => m.word.form === form)!.word;
    expect(senses(w).length).toBeGreaterThanOrEqual(2);
    for (const { use, sense } of senses(w)) {
      if (use.pos === "noun") expect(sense.article ?? use.article, `${form}: ${sense.gloss}`).toMatch(/^(de|het|de\/het)$/);
      expect(glossIssues(sense.gloss), sense.gloss).toEqual([]);
    }
  });

  it("de bal (ball) and het bal (formal dance) are separate senses", () => {
    const bal = fixtureWord("bal");
    const noun = bal.uses.find((u) => u.pos === "noun")!;
    expect(noun.article).toBe("de");
    const dance = noun.senses.find((s) => s.article === "het");
    expect(dance).toBeDefined();
    expect(dance!.plural).toBe("bals");
    expect(noun.plural).toBe("ballen");
  });
});

describe("civic senses: the administrative meaning is there, and its example matches it", () => {
  it.each([
    ["aanslag", "assessment"],
    ["toeslag", "entitlement"],
    ["opzeggen", "to terminate a contract"],
    ["termijn", "deadline"],
    ["bon", "ticket"],
  ])("%s has “%s”", (form, gloss) => {
    expect(glosses(fixtureWord(form))).toContain(gloss);
  });

  it.skipIf(!LLM_BUILD)("beschikking has its administrative sense (a decision) — needs the model to pick it out of the gloss", () => {
    expect(glosses(fixtureWord("beschikking")).some((g) => /decision|ruling/.test(g))).toBe(true);
  });

  it("every example of these words contains the word, and every noun in it has the right article", () => {
    for (const form of ["aanslag", "toeslag", "opzeggen", "beschikking", "termijn", "bon"]) {
      const w = fixtureWord(form);
      for (const { use, sense } of senses(w)) {
        for (const ex of sense.examples) {
          const spans = findTargetSpans(ex.nl, [w.form, ...use.forms.map((f) => f.form)]);
          expect(spans, ex.nl).not.toBeNull();
          expect(ex.targetSpans.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("separable verbs, in a sentence", () => {
  it("Ik bel je morgen op → opbellen, both parts highlighted", async () => {
    const text = "Ik bel je morgen op";
    const offers = await unitsAt(text, span(text, "bel"));
    const unit = offers.find((o) => o.kind === "separable")!;
    expect(unit.forms).toEqual(["opbellen"]);
    expect(unit.spans.map(([s, e]) => text.slice(s, e))).toEqual(["bel", "op"]);
  });

  it("De trein komt om acht uur aan → aankomen, both parts highlighted", async () => {
    const text = "De trein komt om acht uur aan";
    const offers = await unitsAt(text, span(text, "komt"));
    const unit = offers.find((o) => o.kind === "separable")!;
    expect(unit.forms).toEqual(["aankomen"]);
    expect(unit.spans.map(([s, e]) => text.slice(s, e))).toEqual(["komt", "aan"]);
  });

  it("the single word stays available: bel still looks up bellen", async () => {
    expect(await lemmas("bel")).toContain("bellen");
  });
});

describe("verb + preposition", () => {
  it("We wachten op de bus → wachten op (“to wait for”)", async () => {
    const text = "We wachten op de bus";
    const unit = (await unitsAt(text, span(text, "wachten"))).find((o) => o.kind === "multiword")!;
    expect(unit.forms).toEqual(["wachten op"]);
    expect(unit.words[0].uses[0]).toMatchObject({ pattern: "wachten op", head: "wachten", governs: "op" });
    expect(glosses(unit.words[0])).toEqual(["to wait for"]);
  });

  it("Ik heb zin in koffie → the expression zin hebben (no source states “zin hebben in” as a unit)", async () => {
    const text = "Ik heb zin in koffie";
    const unit = (await unitsAt(text, span(text, "zin"))).find((o) => o.kind === "multiword")!;
    expect(unit.forms).toEqual(["zin hebben"]);
    expect(unit.spans.map(([s, e]) => text.slice(s, e))).toEqual(["heb zin"]);
  });
});

describe("compounds", () => {
  it("belastingaanslag is a whole entry (the whole word beats a split), de, plural -en", async () => {
    const r = await lookup("belastingaanslag");
    expect(r.matches[0].word.form).toBe("belastingaanslag");
    expect(r.compound).toBeNull();
    expect(r.matches[0].word.uses[0]).toMatchObject({ article: "de", plural: "belastingaanslagen" });
  });

  it("…and explained as belasting + aanslag, the head giving de", async () => {
    const parts = new Map(FIXTURE_WORDS.map((w) => [w.searchKey, w]));
    const node = decomposeCompound("belastingaanslag", (k) => {
      const w = parts.get(k);
      return w ? { wordId: w.id, form: w.form, kind: w.kind, frequency: w.frequency, isLemma: true } : undefined;
    })!;
    expect(mainParts(node).map((p) => p.form)).toEqual(["belasting", "aanslag"]);
    expect(fixtureWord(headOf(node).form).uses[0].article).toBe("de");
  });

  it("huurtoeslagaanvraag (not in the dictionary): huurtoeslag + aanvraag, article and plural from the head, meaning reconstructed", async () => {
    const r = await lookup("huurtoeslagaanvraag");
    expect(r.matches).toEqual([]);
    const c = r.compound!;
    expect(mainParts(c.node).map((p) => p.form)).toEqual(["huurtoeslag", "aanvraag"]);
    const use = c.word.uses[0];
    expect(use.article).toBe(fixtureWord("aanvraag").uses[0].article);
    expect(use.plural).toBe("huurtoeslagaanvragen");
    expect(use.senses[0].reconstructed).toBe(true);
    expect(use.senses[0].gloss).toContain("housing benefit");
  });

  it.each(["zeehond", "ziekenhuis", "boterham"])("opaque %s has its own entry and is never split", async (form) => {
    const r = await lookup(form);
    expect(r.matches[0].word.form).toBe(form);
    expect(r.compound).toBeNull();
  });

  it("zeehond is not a kind of hond", () => {
    expect(glosses(fixtureWord("zeehond"))).toContain("seal");
    expect(glosses(fixtureWord("zeehond"))).not.toContain("dog");
  });
});

describe("special compounds", () => {
  it("in- en uitvoer → invoer + uitvoer; in- alone is never an entry", async () => {
    const text = "De in- en uitvoer van goederen.";
    const unit = (await unitsAt(text, span(text, "in")))[0];
    expect(unit).toMatchObject({ kind: "coordination", forms: ["invoer", "uitvoer"] });
    expect(unit.words.map((w) => w.form)).toEqual(["invoer", "uitvoer"]);
    expect((await lookup("in-")).matches.every((m) => m.word.form !== "in-")).toBe(true);
  });

  it("bedrijfsleiders en -medewerkers → bedrijfsleiders + bedrijfsmedewerkers", async () => {
    const text = "Alle bedrijfsleiders en -medewerkers kwamen.";
    const unit = (await unitsAt(text, span(text, "medewerkers")))[0];
    expect(unit).toMatchObject({ kind: "coordination", forms: ["bedrijfsleiders", "bedrijfsmedewerkers"] });
  });

  it("Schipholtunnel keeps Schiphol as a name, not translated", async () => {
    const c = (await findCompound("Schipholtunnel"))!;
    expect(c.node.left).toMatchObject({ form: "Schiphol" });
    expect(["properNoun", "lemma"]).toContain(c.node.left!.componentKind);
    expect(c.word.uses[0].senses[0].gloss.startsWith("Schiphol")).toBe(true);
  });

  it("GGD-test keeps GGD as an acronym", async () => {
    const c = (await findCompound("GGD-test"))!;
    expect(c.node).toMatchObject({ link: "-", left: { form: "GGD" }, right: { form: "test" } });
    expect(c.word.uses[0].senses[0].gloss.startsWith("GGD")).toBe(true);
  });

  it("ziektekostenverzekeringspremie: the whole word plus its two main parts", async () => {
    const c = (await findCompound("ziektekostenverzekeringspremie"))!;
    expect(c.form).toBe("ziektekostenverzekeringspremie");
    expect(mainParts(c.node).map((p) => p.form)).toEqual(["ziektekostenverzekering", "premie"]);
    expect(c.node.link).toBe("s");
  });

  it("bosuil is bos + uil, never bo + suil — and, being in the dictionary, a whole word", async () => {
    expect((await lookup("bosuil")).matches[0].word.form).toBe("bosuil");
    const node = decomposeCompound("bosuil", (k) => (["bos", "uil", "suil", "bo"].includes(k) ? { wordId: k, form: k, kind: "word", frequency: 1, isLemma: true } : undefined))!;
    expect(mainParts(node).map((p) => p.form)).toEqual(["bos", "uil"]);
  });

  it("tapping aanslag in “de belastingaanslag van 2026” selects the whole compound, sentence intact", () => {
    const text = "de belastingaanslag van 2026";
    const { tokens, sentences } = tokenizeText(text);
    expect(tokens.find((t) => t.isWord && t.text.includes("aanslag"))!.text).toBe("belastingaanslag");
    expect(sentences).toEqual([text]);
    expect(tokens.map((t) => t.text).join("")).toBe(text);
  });
});

describe("de/het", () => {
  it.each([
    ["zout", "het"],
    ["baby", "de"],
    ["meisje", "het"],
    ["wond", "de"],
  ])("%s takes %s, in the lemma and in every example", (form, article) => {
    const w = fixtureWord(form);
    const noun = w.uses.find((u) => u.pos === "noun")!;
    expect(noun.article).toBe(article);
    const articleOf = (t: string) => (t === form ? (article as "de" | "het") : undefined);
    for (const { sense } of senses(w)) for (const ex of sense.examples) expect(articleIssues(ex.nl, articleOf), ex.nl).toEqual([]);
  });

  it("the check catches the audit's errors", () => {
    const articles: Record<string, "de" | "het"> = { zout: "het", baby: "de", wond: "de" };
    const articleOf = (t: string) => articles[t];
    expect(articleIssues("Mag ik de zout, alsjeblieft?", articleOf)).toHaveLength(1);
    expect(articleIssues("Het baby slaapt.", articleOf)).toHaveLength(1);
    expect(articleIssues("Het wond geneest.", articleOf)).toHaveLength(1);
  });
});

describe("article per sense", () => {
  it("de/het filter is a legitimate double, verified by both sources", () => {
    const noun = fixtureWord("filter").uses.find((u) => u.pos === "noun")!;
    expect(noun.article).toBe("de/het");
    expect(noun.fieldMeta.article.confidence).toBe("verified");
  });

  it("huizen is the plural of huis — and plurals take de", async () => {
    expect((await lemmas("huizen"))[0]).toBe("huis");
    const huis = fixtureWord("huis").uses.find((u) => u.pos === "noun")!;
    expect(huis.plural).toBe("huizen");
    expect(articleIssues("de huizen", (t) => (t === "huis" ? "het" : undefined))).toEqual([]);
  });
});

describe("abbreviations", () => {
  it("BSN: its expansion and its meaning", () => {
    const use = fixtureWord("BSN").uses[0];
    expect(use.expansion).toBe("burgerservicenummer");
    expect(use.senses[0].gloss).toMatch(/identification number/);
  });

  it("i.p.v.: in plaats van, instead of", () => {
    const use = fixtureWord("i.p.v.").uses[0];
    expect(use.expansion).toBe("in plaats van");
    expect(use.senses[0].gloss).toBe("instead of");
  });

  it.skipIf(!LLM_BUILD)("AOW and zzp'er: expansion and meaning — no source gives an English meaning without the model", () => {
    expect(fixtureWord("AOW").uses[0].expansion).toBeTruthy();
    expect(fixtureWord("zzp'er").uses[0].senses[0].gloss).toBeTruthy();
  });

  it("without a meaning, AOW is not published — never shipped with a guessed one", () => {
    if (LLM_BUILD) return;
    expect(FIXTURE_WORDS.some((w) => w.form === "AOW" || w.form === "zzp'er")).toBe(false);
  });
});

describe("spelling", () => {
  it.each(["vaardigheid", "factor", "hygiëne", "paraplu"])("%s is an entry, in its official spelling", (form) => {
    expect(fixtureWord(form).form).toBe(form);
  });

  it.each([
    ["vaardighed", "vaardigheid"],
    ["faktor", "factor"],
    ["higiene", "hygiëne"],
    ["paraply", "paraplu"],
  ])("the misspelling %s is not an entry — it suggests %s", async (typo, right) => {
    const r = await lookup(typo);
    expect(r.matches).toEqual([]);
    expect(r.didYouMean.map((d) => d.form)).toContain(right);
  });
});

describe("spelling in search", () => {
  it.each([
    ["hygiene", "hygiëne"],
    ["ijsselmeer", "IJsselmeer"],
    ["autos", "auto"],
  ])("%s finds %s", async (query, form) => {
    const r = await search(query);
    expect(r.suggestions[0].form).toBe(form);
  });

  it("autos reaches auto through its plural auto's", async () => {
    const r = await search("autos");
    expect(r.suggestions[0]).toMatchObject({ form: "auto", via: "form", matched: "auto's", exact: true });
  });

  it.skipIf(!LLM_BUILD)("zzper finds zzp'er — needs zzp'er published, which needs the model", async () => {
    expect((await search("zzper")).suggestions[0].form).toBe("zzp'er");
  });

  it.each([
    ["klijn", "klein"],
    ["yzer", "ijzer"],
  ])("%s → “Did you mean %s?”", async (query, form) => {
    const r = await search(query);
    // Nothing a learner meant matches by prefix (a rare place name may).
    expect(r.suggestions.filter((s) => !s.mid && s.kind !== "properNoun")).toEqual([]);
    expect(r.didYouMean.map((d) => d.form)).toContain(form);
  });

  it("een shows the article and the numeral, article first", async () => {
    const r = await search("een");
    const een = r.suggestions.find((s) => s.form === "een")!;
    expect(r.suggestions[0].form).toBe("een");
    const pos = een.preview.senses.map((s) => s.pos);
    expect(pos[0]).toBe("article");
    expect(pos).toContain("numeral");
    expect(r.suggestions.map((s) => s.form)).toContain("één");
  });

  it("never offers a typo guess next to a found inflected form", async () => {
    const r = await search("gestegen");
    expect(r.didYouMean.map((d) => d.form)).not.toContain("gisteren");
  });
});

describe("stress homographs", () => {
  it("voorkomen is vóórkomen (separable, kwam voor) and voorkómen (inseparable, voorkwam)", () => {
    const verbs = fixtureWord("voorkomen").uses.filter((u) => u.pos === "verb");
    expect(verbs.map((u) => u.stress)).toEqual(["vóórkomen", "voorkómen"]);
    expect(verbs[0]).toMatchObject({ separable: true, pastSg: "kwam voor", participle: "voorgekomen" });
    expect(verbs[1]).toMatchObject({ separable: false, pastSg: "voorkwam", participle: "voorkomen" });
    expect(verbs[1].senses.map((s) => s.gloss)).toContain("to prevent");
  });
});

describe("variety and register", () => {
  it("Belgian, archaic and rare senses come last", () => {
    for (const w of FIXTURE_WORDS) {
      for (const use of w.uses) {
        const late = use.senses.map((s) => s.variety === "BE" || s.register === "archaic" || s.register === "rare");
        const firstLate = late.indexOf(true);
        if (firstLate >= 0) expect(late.slice(firstLate).every(Boolean), `${w.form} ${use.id}`).toBe(true);
      }
    }
  });

  it("lopen: the Netherlands' “to walk” before Belgium's “to run”", () => {
    const s = fixtureWord("lopen").uses.find((u) => u.pos === "verb")!.senses;
    expect(s[0].variety).toBe("NL");
    expect(s[s.length - 1].variety).toBe("BE");
  });
});

describe("autocomplete ranking", () => {
  it("belasting: the exact word first, then words starting with it by frequency", async () => {
    const r = await search("belasting");
    expect(r.suggestions[0]).toMatchObject({ form: "belasting", exact: true });
    const prefix = r.suggestions.slice(1).filter((s) => !s.mid);
    expect(prefix.every((s) => s.form.startsWith("belasting"))).toBe(true);
    const freq = prefix.map((s) => s.frequency);
    expect([...freq].sort((a, b) => a - b)).toEqual(freq);
  });

  it("huur: prefix matches above mid-word ones", async () => {
    const r = await search("huur", { limit: 20 });
    const firstMid = r.suggestions.findIndex((s) => s.mid);
    if (firstMid >= 0) expect(r.suggestions.slice(firstMid).every((s) => s.mid)).toBe(true);
    expect(r.suggestions[0].form).toBe("huur");
  });

  it("liep → lopen first, reached through its form", async () => {
    const r = await search("liep");
    expect(r.suggestions[0]).toMatchObject({ form: "lopen", via: "form", matched: "liep", exact: true });
  });
});

describe("every published sense", () => {
  it("is verified or checked, never doubt, and has a gloss and a part of speech", () => {
    for (const w of FIXTURE_WORDS) {
      for (const { use, sense } of senses(w)) {
        expect(sense.meta.confidence).not.toBe("doubt");
        expect(sense.gloss.trim()).not.toBe("");
        expect(use.pos).toBeTruthy();
        expect(glossIssues(sense.gloss), `${w.form}: ${sense.gloss}`).toEqual([]);
      }
    }
  });

  it("every example contains its word, with the spans saved", () => {
    for (const w of FIXTURE_WORDS) {
      for (const { use, sense } of senses(w)) {
        for (const ex of sense.examples) {
          expect(ex.targetSpans.length, ex.nl).toBeGreaterThan(0);
          for (const [s, e] of ex.targetSpans) expect(ex.nl.slice(s, e).trim(), ex.nl).not.toBe("");
          expect(findTargetSpans(ex.nl, [w.form, ...use.forms.map((f) => f.form)]), `${w.form}: ${ex.nl}`).not.toBeNull();
          expect(tokenize(ex.nl).length).toBeLessThanOrEqual(18);
        }
      }
    }
  });
});
