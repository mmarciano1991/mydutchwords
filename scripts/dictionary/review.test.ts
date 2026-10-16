/* The quality pass: Tier 0 rules, reviewed corrections, and the review's
   selection and validation — everything that runs without a model. */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { grammarKey, loadCorrections, mergeDuplicateSenses, tier0Drop } from "./corrections.mjs";
import { assembleWord } from "./assemble.mjs";
import { BatchState, correctionsOf, costOf, glossCore, keepWholeWords, hashOf, itemsOf, reportOf, select } from "./review.mjs";

const sense = (gloss: string, over: Record<string, unknown> = {}) => ({ id: `s_${gloss.replace(/\W/g, "")}`, gloss, examples: [] as unknown[], ...over });

describe("Tier 0", () => {
  it("drops a place-name sense on a common word, not on a proper noun", () => {
    expect(tier0Drop({ form: "appel" }, { gloss: "hamlet in Nijkerk" })).toBe("place name on a common word");
    expect(tier0Drop({ form: "akkers" }, { gloss: "neighbourhood of Helmond" })).toBe("place name on a common word");
    expect(tier0Drop({ form: "Bade" }, { gloss: "village in Germany" })).toBeNull();
    expect(tier0Drop({ form: "a" }, { gloss: "stream of water" })).toBeNull();
    expect(tier0Drop({ form: "appel" }, { gloss: "apple" })).toBeNull();
  });

  it("merges identical glosses into the first, keeping an example", () => {
    const use = { senses: [sense("agar"), sense("Agar", { examples: [{ nl: "x" }] }), sense("gel")] };
    expect(mergeDuplicateSenses(use)).toBe(1);
    expect(use.senses.map((s) => s.gloss)).toEqual(["agar", "gel"]);
    expect(use.senses[0].examples).toEqual([{ nl: "x" }]);
  });
});

describe("reviewed corrections", () => {
  it("reads every kind, keyed by the sense as the learner sees it", () => {
    const dir = mkdtempSync(join(tmpdir(), "corr-"));
    writeFileSync(join(dir, "glosses-review.tsv"), "# header\nAmsterdammer\tadjective\tof\tfrom Amsterdam\n");
    writeFileSync(join(dir, "examples-review.tsv"), "bank\tnoun\tbench\tIk zit op de bank.\tI sit on the bench.\nbroken\tline\n");
    writeFileSync(join(dir, "drop-review.tsv"), "ziek\tnoun\thamlet in X\tplace name\n");
    writeFileSync(join(dir, "articles-review.tsv"), "partij\tnoun\tparty\tde\nboek\tnoun\tbook\tder\n");
    writeFileSync(join(dir, "noexample-review.tsv"), "erg\tadjective\tbad\n");
    const c = loadCorrections(dir);
    expect(c.glosses.get("Amsterdammer\tadjective\tof")).toMatchObject({ gloss: "from Amsterdam" });
    expect(c.examples.get("bank\tnoun\tbench")).toMatchObject({ nl: "Ik zit op de bank.", en: "I sit on the bench." });
    expect(c.examples.size).toBe(1);
    expect(c.drops.get("ziek\tnoun\thamlet in X")).toMatchObject({ reason: "place name" });
    expect([...c.articles]).toEqual([["partij\tnoun\tparty", { article: "de", file: "articles-review.tsv" }]]);
    expect(c.noExamples.has("erg\tadjective\tbad")).toBe(true);
  });
});

const words = [
  {
    form: "bank",
    kind: "word",
    frequency: 500,
    uses: [
      {
        pos: "noun",
        article: "de",
        fieldMeta: { article: { sources: ["en-wiktionary"], confidence: "checked" } },
        forms: [{ form: "banken" }],
        senses: [
          sense("bench", { examples: [{ nl: "Ik zit op de bank.", en: "I sit on the bench.", source: "corpus", origin: "tatoeba" }] }),
          sense("bank (money)", { examples: [{ nl: "De bank is dicht.", en: "The bank is closed.", source: "corpus", origin: "wiktionary" }] }),
        ],
      },
    ],
  },
  { form: "Amsterdammer", kind: "word", frequency: 9000, uses: [{ pos: "adjective", forms: [], senses: [sense("of")] }] },
  { form: "Utrecht", kind: "properNoun", frequency: 100, uses: [{ pos: "noun", forms: [], senses: [sense("Utrecht")] }] },
  { form: "fiets", kind: "word", frequency: 300, uses: [{ pos: "noun", forms: [], senses: [sense("bicycle", { examples: [{ nl: "Mijn fiets is rood.", en: "My bike is red.", source: "generated" }] })] }] },
];

describe("review selection", () => {
  const items = itemsOf(words);

  it("makes one item per sense, skipping proper nouns, with a priority category", () => {
    expect(items.map((i) => `${i.form}:${i.category}`)).toEqual(["bank:tatoeba", "bank:wiktionary", "Amsterdammer:gloss", "fiets:stored"]);
    expect(items[0]).toMatchObject({ article: "de", others: ["bank (money)"], forms: ["bank", "banken"] });
  });

  it("orders garbled glosses first, then by frequency, skips what was reviewed and rare words", () => {
    expect(select(items, new Set(), { limit: 10 }).map((i) => i.form)).toEqual(["Amsterdammer", "fiets", "bank", "bank"]);
    const done = new Set([items[2].hash]);
    expect(select(items, done, { limit: 2 }).map((i) => i.form)).toEqual(["fiets", "bank"]);
    expect(select(items, new Set(), { limit: 10, maxRank: 400 }).map((i) => i.form)).toEqual(["fiets"]);
  });

  it("reviews a sense again only when what it shows changed", () => {
    expect(hashOf(items[0])).toBe(hashOf({ ...items[0], frequency: 1 }));
    expect(hashOf(items[0])).not.toBe(hashOf({ ...items[0], example: { nl: "Anders.", en: "Other." } }));
  });

  it("a pilot samples every category", () => {
    const pilot = select(items, new Set(), { limit: 4, pilot: true });
    expect(new Set(pilot.map((i) => i.category))).toEqual(new Set(["gloss", "tatoeba", "stored", "wiktionary"]));
  });
});

describe("fix validation", () => {
  const bank = itemsOf(words)[0];

  it("keeps, drops, or turns a fix into corrections", () => {
    expect(correctionsOf(bank, { action: "keep", gloss: null, nl: null, en: null, reason: "" })).toEqual({ action: "keep" });
    expect(correctionsOf(bank, { action: "drop", gloss: null, nl: null, en: null, reason: "duplicate" })).toEqual({ action: "drop", reason: "duplicate" });
    expect(correctionsOf(bank, { action: "fix", gloss: "bench", nl: "We zitten samen op de bank in het park.", en: "We sit together on the bench in the park.", reason: "r" })).toEqual({
      action: "fix",
      reason: "r",
      example: { nl: "We zitten samen op de bank in het park.", en: "We sit together on the bench in the park." },
    });
  });

  it("keeps a gloss fix when its example fails, and ignores an unchanged example", () => {
    expect(correctionsOf(bank, { action: "fix", gloss: "park bench", nl: "Ik zit op een stoel.", en: "I sit on a chair.", reason: "r" })).toMatchObject({
      action: "fix",
      gloss: "park bench",
      exampleRejected: expect.stringContaining("word not found"),
    });
    expect(correctionsOf(bank, { action: "fix", gloss: null, nl: "Ik zit op de bank.", en: "I sit on the bench.", reason: "r" })).toEqual({ action: "keep" });
  });

  it("changes an unverified article only when tier 1 flagged it", () => {
    const answer = { action: "fix", gloss: null, nl: null, en: null, keepExample: true, article: "het", reason: "r" };
    expect(correctionsOf(bank, answer, ["wrong-article"])).toMatchObject({ action: "fix", article: "het" });
    expect(correctionsOf(bank, answer, ["bad-gloss"])).toEqual({ action: "keep" });
    expect(correctionsOf({ ...bank, articleVerified: true }, answer, ["wrong-article"])).toEqual({ action: "keep" });
  });

  it("removes an example that no longer fits when no new one passes", () => {
    const answer = { action: "fix", gloss: "park bench", nl: null, en: null, keepExample: false, article: null, reason: "r" };
    expect(correctionsOf(bank, answer)).toMatchObject({ gloss: "park bench", removeExample: true });
  });

  it("never drops a word's only meaning, unless it is a place name or a slur", () => {
    const [, , amsterdammer] = itemsOf(words);
    const drop = { action: "drop", gloss: null, nl: null, en: null, reason: "obscure" };
    expect(amsterdammer).toMatchObject({ others: [], otherUses: 0 });
    expect(correctionsOf(amsterdammer, drop, ["bad-gloss"])).toEqual({ action: "rejected", why: "drop: the word's only meaning" });
    expect(correctionsOf(amsterdammer, drop, ["place-name"])).toMatchObject({ action: "drop" });
    expect(correctionsOf({ ...amsterdammer, otherUses: 2 }, drop, ["wrong-type"])).toMatchObject({ action: "drop" });
  });

  it("never drops every meaning of a word in one round", () => {
    const [bench, money] = itemsOf(words);
    const drop = (it: typeof bench, problems: string[]) => ({ it, problems, result: { action: "drop", reason: "r" } });
    const both = keepWholeWords([drop(bench, ["duplicate"]), drop(money, ["duplicate"])]);
    expect(both.map((p) => p.result.action)).toEqual(["rejected", "rejected"]);
    expect(keepWholeWords([drop(bench, ["duplicate"])])[0].result.action).toBe("drop");
  });

  it("rejects a gloss fix that repeats another meaning", () => {
    expect(glossCore("to take (for)")).toBe("take");
    expect(correctionsOf(bank, { action: "fix", gloss: "Bank", nl: null, en: null, reason: "" })).toEqual({ action: "rejected", why: "gloss: repeats another meaning" });
    expect(correctionsOf({ ...bank, others: ["to come"] }, { action: "fix", gloss: "come (arrive)", nl: null, en: null, reason: "" }).action).toBe("rejected");
  });

  it("rejects a gloss that breaks the gloss rule, or an example without the word", () => {
    expect(correctionsOf(bank, { action: "fix", gloss: "bench, seat, couch", nl: null, en: null, reason: "" }).action).toBe("rejected");
    expect(correctionsOf(bank, { action: "fix", gloss: null, nl: "Ik zit op een stoel.", en: "I sit on a chair.", reason: "" })).toMatchObject({ action: "rejected", why: expect.stringContaining("word not found") });
  });
});

describe("resuming", () => {
  it("keeps a run's batch ids until it is done, and forgets another run's", () => {
    const path = join(mkdtempSync(join(tmpdir(), "batches-")), "batches.json");
    const a = new BatchState(path, "run-a");
    a.set("triage", "msgbatch_1");
    expect(new BatchState(path, "run-a").get("triage")).toBe("msgbatch_1");
    expect(new BatchState(path, "run-b").get("triage")).toBeUndefined();
    a.done();
    expect(new BatchState(path, "run-a").get("triage")).toBeUndefined();
  });
});

describe("report", () => {
  it("prices tokens at batch rates", () => {
    expect(costOf({ "claude-haiku-5-5": { input: 1_000_000, output: 1_000_000, requests: 1 } })).toBeCloseTo(0.3);
    expect(costOf({ "claude-sonnet-5-5": { input: 1_000_000, output: 0, requests: 1 } })).toBeCloseTo(1);
  });

  it("lists counts, cost and proposed changes", () => {
    const [bank] = itemsOf(words);
    const md = reportOf({
      batch: [bank],
      flagged: [{ it: bank, problems: ["wrong-meaning"], confidence: "high" }],
      proposals: [{ it: bank, problems: ["wrong-meaning"], result: { action: "fix", reason: "r", example: { nl: "Op de bank in het park.", en: "On the bench." } } }],
      usage: { "claude-haiku-5-5": { input: 1000, output: 100, requests: 1 } },
      pilot: true,
      byCat: { tatoeba: 1 },
    });
    expect(md).toContain("pilot");
    expect(md).toContain("**1** fixes");
    expect(md).toContain("~~Ik zit op de bank.~~ → Op de bank in het park.");
  });
});

describe("reviewed grammar (grammar.tsv)", () => {
  const recSense = (g: string) => ({ glosses: [g], rawGloss: g, tags: [], altOf: [], synonyms: [], examples: [], links: [], categories: [] });
  const en = (over: any) => ({ pos: "noun", kind: "noun", forms: [{ form: "bomen", tags: ["plural"] }], genders: ["m"], senses: [recSense("tree")], translations: [], tableTags: "", ...over });
  const nl = (over: any) => ({ pos: "noun", forms: [{ form: "bomen", tags: ["plural"] }], genders: ["m"], senses: [recSense("boom")], translations: [], auxiliaries: [], ...over });
  const ctx = (g: [string, string, string, string, string][] = []) => ({ frequency: { of: () => 1 }, grammar: new Map(g.map((r) => [grammarKey(r[0], r[1], r[2], r[3]), r[4]])) });
  it("article disagreement: dropped without review, kept with it", () => {
    const a = assembleWord("boom", [en({})], [nl({ genders: ["n"] })], ctx());
    expect(a.word).toBeNull();
    const b = assembleWord("boom", [en({})], [nl({ genders: ["n"] })], ctx([["boom", "noun", "article", "de", "het"]]));
    expect(b.word.uses[0].article).toBe("het");
    const c = assembleWord("boom", [en({})], [nl({ genders: ["n"] })], ctx([["boom", "noun", "article", "de", "de/het"]]));
    expect(c.word.uses[0].article).toBe("de/het");
  });
  it("plural: only a value the sources give", () => {
    const nlr = nl({ forms: [{ form: "boms", tags: ["plural"] }] });
    expect(assembleWord("boom", [en({})], [nlr], ctx()).word).toBeNull();
    expect(assembleWord("boom", [en({})], [nlr], ctx([["boom", "noun", "plural", "bomen", "bomer"]])).word).toBeNull();
    const w = assembleWord("boom", [en({})], [nlr], ctx([["boom", "noun", "plural", "bomen", "boms"]])).word;
    expect(w.uses[0].plural).toBe("boms");
  });
});
