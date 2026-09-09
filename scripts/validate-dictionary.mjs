/* Validates the dictionary, and fails the build when it isn't complete.
 *
 *   npm run validate
 *
 * This is the answer to "how does the system stop this happening again".
 * Every gap the audit found got there because nothing checked for it: the
 * 118 FreeDict words have no article because the generator hardcoded an
 * empty one, and nobody could tell, because a missing article renders as
 * nothing. A warning would have produced exactly the same outcome, so this
 * exits non-zero instead.
 *
 * Two kinds of check, and the difference matters:
 *
 *  - SHAPE checks (below) look at what's in the file. They're exact: a word
 *    with no example either has one or it doesn't, so their budget is zero
 *    and any new violation fails the build.
 *
 *  - The COVERAGE check runs real Dutch text (data/coverage-corpus.txt)
 *    through the real lookup pipeline and scores how much of it resolves.
 *    This is the only check that can catch "some words are missing", since
 *    you cannot enumerate the words that aren't there. It has a floor rather
 *    than a target: it must never go DOWN.
 *
 * Thresholds are recorded, not aspirational — each is set just below where
 * the data actually stands, so the gate catches regressions rather than
 * failing on day one. Tighten them as the numbers improve.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const QUEUE_PATH = "data/generated/pending.json";

/* ── thresholds ─────────────────────────────────────────────────────────
   Raise these as the data improves; never lower one to make a build pass. */

/** Share of corpus tokens that must resolve through the real pipeline. */
const COVERAGE_FLOOR = 0.97;

/** Words shipped with an article nobody has established ("unknown").
 *
 *  This number could not previously be computed at all: an unknown article
 *  and "this word takes no article" were the same value, so the gap was
 *  invisible. Now it's 80 imported words with no gender in their source, and
 *  it is a ceiling — new words arrive with an article or they don't arrive. */
const UNKNOWN_ARTICLE_CEILING = 80;

/** Curated entries whose example sentence doesn't visibly use the word.
 *  Not zero yet: ~870 of these are genuinely loose examples that need
 *  authoring attention, and failing the build on all of them today would
 *  just mean the gate gets switched off. It's a ceiling that ratchets down
 *  as they're rewritten — lower it whenever the number drops. */
const LOOSE_EXAMPLE_CEILING = 900;

/* ── loading ────────────────────────────────────────────────────────────── */

/** Loads a TypeScript module by transpiling it with the local esbuild —
 *  same approach as scripts/gen-dictionary.mjs, so the validator reads
 *  exactly the modules the app does rather than a reimplementation. */
async function loadTs(entry, tmp, name) {
  const out = join(tmp, `${name}.mjs`);
  execFileSync("npx", ["esbuild", entry, "--bundle", "--format=esm", `--outfile=${out}`, "--log-level=error"], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  return import(`file://${out}`);
}

/* ── reporting ──────────────────────────────────────────────────────────── */

const problems = [];

/** Records a failed check. `samples` are shown so the message is actionable
 *  — a count alone tells you something is wrong but not where. */
function fail(rule, count, samples) {
  problems.push({ rule, count, samples: samples.slice(0, 6) });
}

/* ── the checks ─────────────────────────────────────────────────────────── */

function checkShape(entries) {
  const missingGloss = [];
  const missingExample = [];
  const missingExampleEn = [];
  const delimiters = [];
  const duplicates = [];
  const seen = new Set();

  for (const e of entries) {
    const id = String(e.dutch ?? "").toLowerCase();
    if (!e.dutch || !String(e.english ?? "").trim()) missingGloss.push(e.dutch || "(blank)");
    if (!String(e.example ?? "").trim()) missingExample.push(e.dutch);
    if (!String(e.exampleEn ?? "").trim()) missingExampleEn.push(e.dutch);

    for (const [field, value] of Object.entries(e)) {
      if (typeof value === "string" && /[\t\n\r]/.test(value)) {
        delimiters.push(`${e.dutch} (${field})`);
      }
    }

    // A duplicate headword isn't a cosmetic problem: gen-dictionary keeps
    // the first and silently drops the rest, so the second entry's gloss and
    // example vanish from the build with no warning at all.
    if (seen.has(id)) duplicates.push(e.dutch);
    seen.add(id);
  }

  if (missingGloss.length) fail("entry has no Dutch word or no translation", missingGloss.length, missingGloss);
  if (missingExample.length) fail("entry has no example sentence", missingExample.length, missingExample);
  if (missingExampleEn.length) fail("example sentence has no translation", missingExampleEn.length, missingExampleEn);
  if (delimiters.length) fail("field contains a tab or newline (corrupts the encoding)", delimiters.length, delimiters);
  if (duplicates.length) fail("duplicate headword (later copies are silently dropped)", duplicates.length, duplicates);
}

/** The article an entry declares must agree with the article its own example
 *  sentence uses. High precision and low recall by design: it can only see
 *  the entries whose sentence happens to name the article, but when it fires
 *  the entry is definitely wrong about Dutch — it contradicts itself. */
function checkArticleAgreement(entries) {
  const contradictions = [];
  for (const e of entries) {
    if (e.gender !== "de" && e.gender !== "het") continue;
    const word = String(e.dutch).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = String(e.example ?? "").match(new RegExp(`\\b(de|het)\\s+${word}\\b`, "i"));
    if (!m) continue;
    const inSentence = m[1].toLowerCase();
    if (inSentence !== e.gender) {
      contradictions.push(`${e.dutch}: declared "${e.gender}" but its example says "${inSentence} ${e.dutch}"`);
    }
  }
  if (contradictions.length) {
    fail("declared article contradicts the entry's own example", contradictions.length, contradictions);
  }
}

/** An example sentence should actually demonstrate its word.
 *
 *  Checked through the real morphology, not with `includes`: Dutch conjugates
 *  ("gaan" is demonstrated by "Ik ga"), so a substring test reports a quarter
 *  of a perfectly good dictionary as broken. Separable verbs are handled too
 *  — "uitgeven" is demonstrated by "Ze geeft te veel geld uit", where the
 *  prefix has moved to the end of the clause and the two halves never appear
 *  next to each other. */
function checkExamplesUseTheirWord(entries, deinflect, prefixes, isWord) {
  const loose = [];

  for (const e of entries) {
    const sentence = String(e.example ?? "").toLowerCase();
    if (!sentence) continue;
    const id = String(e.dutch).toLowerCase();
    const tokens = sentence.match(/[a-zà-ÿ']+/g) ?? [];
    if (tokens.includes(id)) continue;

    // Any token that deinflects to this headword counts as a demonstration.
    const matchesLemma = (lemma) => tokens.some((t) => t === lemma || deinflect(t, (c) => c === lemma).length > 0);
    if (matchesLemma(id)) continue;

    // Separable verb: prefix at the end of the clause, verb inflected up front.
    const prefix = prefixes.find((p) => id.startsWith(p) && isWord(id.slice(p.length)));
    if (prefix && tokens.includes(prefix) && matchesLemma(id.slice(prefix.length))) continue;

    loose.push(`${e.dutch} — "${e.example}"`);
  }

  if (loose.length > LOOSE_EXAMPLE_CEILING) {
    fail(
      `example sentence doesn't visibly use its word (ceiling ${LOOSE_EXAMPLE_CEILING})`,
      loose.length,
      loose
    );
  }
  return loose.length;
}

/** The invariants that make an entry complete, checked on the SHIPPED
 *  dictionary rather than the authored source — that's where imported words
 *  land, and where the article gap actually lives.
 *
 *  "Every word has at least one meaning" is enforced by the type system now
 *  (DictionaryEntry.senses), but it's asserted here too: the type can only
 *  speak for code paths TypeScript compiles, and the shipped dictionary is
 *  decoded at runtime from a string. */
function checkShippedEntries(dictionary) {
  const senseless = [];
  const emptyGloss = [];
  const badGender = [];
  const unknownArticle = [];
  const ungroundedGenerated = [];
  const VALID = new Set(["de", "het", "none", "unknown"]);

  for (const e of dictionary) {
    if (!Array.isArray(e.senses) || e.senses.length === 0) senseless.push(e.dutch);
    for (const sense of e.senses ?? []) {
      if (!String(sense.english ?? "").trim()) emptyGloss.push(e.dutch);
      if (!VALID.has(sense.gender)) badGender.push(`${e.dutch} (${sense.gender})`);
      if (sense.gender === "unknown") unknownArticle.push(e.dutch);
      // Generated content must be identifiable in the shipped data, so the
      // app can tell a learner where a sentence came from and so a future
      // reviewer can find it again.
      if (sense.source === "generated" && !String(sense.example ?? "").trim()) {
        ungroundedGenerated.push(e.dutch);
      }
    }
  }

  if (senseless.length) fail("word has no meanings at all", senseless.length, senseless);
  if (emptyGloss.length) fail("meaning has an empty translation", emptyGloss.length, emptyGloss);
  if (badGender.length) fail("article is not de/het/none/unknown", badGender.length, badGender);
  if (ungroundedGenerated.length) {
    fail(
      "a generated meaning shipped without its example sentence",
      ungroundedGenerated.length,
      ungroundedGenerated
    );
  }

  // Counted per WORD, not per sense: a word with two meanings pushes two
  // entries above, and the ceiling is a number of words.
  const unknownWords = Array.from(new Set(unknownArticle));
  if (unknownWords.length > UNKNOWN_ARTICLE_CEILING) {
    fail(
      `words whose article was never established (ceiling ${UNKNOWN_ARTICLE_CEILING})`,
      unknownWords.length,
      unknownWords
    );
  }
  return {
    unknownArticle: unknownWords.length,
    senses: dictionary.reduce((n, e) => n + (e.senses?.length ?? 0), 0),
    multiSense: dictionary.filter((e) => (e.senses?.length ?? 0) > 1).length,
    provisional: dictionary.reduce(
      (n, e) => n + (e.senses ?? []).filter((s) => s.provisional).length,
      0
    ),
  };
}

/** The generated-content review queue (scripts/complete-entries.mjs).
 *
 *  Two things are checked, and both are about the queue being a real gate
 *  rather than a formality: an item a reviewer has approved must actually be
 *  promoted into the authored data (`npm run promote`) rather than left
 *  sitting here, and nothing in the queue may claim to be approved without
 *  the example sentence that made it approvable. */
function checkReviewQueue() {
  if (!existsSync(QUEUE_PATH)) return { pending: 0, approved: 0 };
  let queue;
  try {
    queue = JSON.parse(readFileSync(QUEUE_PATH, "utf8"));
  } catch (err) {
    fail("the review queue is not valid JSON", 1, [err.message]);
    return { pending: 0, approved: 0 };
  }

  const approved = queue.filter((q) => q.approved === true);
  if (approved.length) {
    fail(
      "approved proposals are still sitting in the queue — run `npm run promote`",
      approved.length,
      approved.map((q) => `${q.dutch} (${q.kind})`)
    );
  }

  const incomplete = queue.filter((q) => !String(q.example ?? "").trim());
  if (incomplete.length) {
    fail("queued proposal has no example sentence", incomplete.length, incomplete.map((q) => q.dutch));
  }

  return { pending: queue.length - approved.length, approved: approved.length };
}

/** Scores real Dutch through the real pipeline. This is the completeness
 *  check — the one that would have caught a 23% resolution rate. */
function checkCoverage(deinflect, decompose, isWord) {
  const text = readFileSync("data/coverage-corpus.txt", "utf8");
  const lines = text.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));

  const unresolved = new Map();
  let total = 0;
  let resolved = 0;

  for (const line of lines) {
    for (const token of line.toLowerCase().match(/[a-zà-ÿ']+/g) ?? []) {
      if (token.length < 3) continue; // articles and particles aren't vocabulary
      total++;
      if (isWord(token) || deinflect(token, isWord).length > 0 || decompose(token, isWord).length > 0) {
        resolved++;
      } else {
        unresolved.set(token, (unresolved.get(token) ?? 0) + 1);
      }
    }
  }

  const rate = total === 0 ? 1 : resolved / total;
  const worst = Array.from(unresolved.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([w, n]) => `${w} (×${n})`);

  if (rate < COVERAGE_FLOOR) {
    fail(
      `corpus coverage ${(rate * 100).toFixed(1)}% is below the ${(COVERAGE_FLOOR * 100).toFixed(0)}% floor`,
      unresolved.size,
      worst
    );
  }
  return { rate, total, resolved, unresolvedTypes: unresolved.size, worst };
}

/* ── main ───────────────────────────────────────────────────────────────── */

const tmp = mkdtempSync(join(tmpdir(), "woordkast-validate-"));
try {
  const { ENTRIES } = await loadTs("data/curated.ts", tmp, "curated");
  const { deinflect } = await loadTs("src/lib/deinflect.ts", tmp, "deinflect");
  const { decompose } = await loadTs("src/lib/decompose.ts", tmp, "decompose");
  const { SEPARABLE_PREFIXES } = await loadTs("src/data/irregularForms.ts", tmp, "irregular");
  const { DICTIONARY } = await loadTs("src/data/dictionary.ts", tmp, "dictionary");

  const words = new Set(ENTRIES.map((e) => String(e.dutch).toLowerCase()));
  const isWord = (t) => words.has(t);

  checkShape(ENTRIES);
  const shipped = checkShippedEntries(DICTIONARY);
  checkArticleAgreement(ENTRIES);
  const loose = checkExamplesUseTheirWord(ENTRIES, deinflect, SEPARABLE_PREFIXES, isWord);
  const coverage = checkCoverage(deinflect, decompose, isWord);
  const review = checkReviewQueue();

  console.log(`entries checked      ${ENTRIES.length.toLocaleString()}`);
  console.log(
    `corpus coverage      ${(coverage.rate * 100).toFixed(1)}% ` +
      `(${coverage.resolved.toLocaleString()}/${coverage.total.toLocaleString()} tokens, floor ${(COVERAGE_FLOOR * 100).toFixed(0)}%)`
  );
  console.log(`loose examples       ${loose.toLocaleString()} (ceiling ${LOOSE_EXAMPLE_CEILING.toLocaleString()})`);
  console.log(`meanings             ${shipped.senses.toLocaleString()} across ${DICTIONARY.length.toLocaleString()} words`);
  console.log(`  words with >1      ${shipped.multiSense.toLocaleString()}`);
  console.log(`  provisional        ${shipped.provisional.toLocaleString()} (split from a packed gloss, no example yet)`);
  console.log(`article unknown      ${shipped.unknownArticle.toLocaleString()} (ceiling ${UNKNOWN_ARTICLE_CEILING.toLocaleString()})`);
  console.log(`awaiting review      ${review.pending.toLocaleString()} generated proposals`);

  if (coverage.worst.length) {
    console.log(`\nmost common words the pipeline can't resolve:`);
    console.log(`  ${coverage.worst.slice(0, 12).join(", ")}`);
  }

  if (problems.length === 0) {
    console.log("\n✓ dictionary is complete");
    process.exit(0);
  }

  console.error(`\n✗ ${problems.length} check${problems.length === 1 ? "" : "s"} failed\n`);
  for (const p of problems) {
    console.error(`  ${p.rule} — ${p.count.toLocaleString()}`);
    for (const s of p.samples) console.error(`      ${s}`);
    console.error("");
  }
  process.exit(1);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
