/* The quality pass: Tier 0 rules, reviewed corrections, and the review's
   selection and validation — everything that runs without a model. */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCorrections, mergeDuplicateSenses, tier0Drop } from "./corrections.mjs";
import { correctionsOf, costOf, hashOf, itemsOf, reportOf, select } from "./review.mjs";

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
    const c = loadCorrections(dir);
    expect(c.glosses.get("Amsterdammer\tadjective\tof")).toMatchObject({ gloss: "from Amsterdam" });
    expect(c.examples.get("bank\tnoun\tbench")).toMatchObject({ nl: "Ik zit op de bank.", en: "I sit on the bench." });
    expect(c.examples.size).toBe(1);
    expect(c.drops.get("ziek\tnoun\thamlet in X")).toMatchObject({ reason: "place name" });
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

  it("orders suspicious glosses first, then Tatoeba, and skips what was reviewed", () => {
    expect(select(items, new Set(), { limit: 10 }).map((i) => i.form)).toEqual(["Amsterdammer", "bank", "fiets", "bank"]);
    const done = new Set([items[2].hash]);
    expect(select(items, done, { limit: 2 }).map((i) => i.key)).toEqual([items[0].key, items[3].key]);
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

  it("rejects a gloss that breaks the gloss rule, or an example without the word", () => {
    expect(correctionsOf(bank, { action: "fix", gloss: "bench, seat, couch", nl: null, en: null, reason: "" }).action).toBe("rejected");
    expect(correctionsOf(bank, { action: "fix", gloss: null, nl: "Ik zit op een stoel.", en: "I sit on a chair.", reason: "" })).toMatchObject({ action: "rejected", why: expect.stringContaining("word not found") });
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
