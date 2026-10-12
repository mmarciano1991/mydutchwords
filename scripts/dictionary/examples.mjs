/* Step 4–5: an example per sense, and the mechanical checks every example
   passes before it is stored.

   In order of preference:
     1. the usage example Wiktionary attaches to THIS sense (the source
        itself asserts it shows this meaning), with its translation;
     2. a Tatoeba sentence — for a word with one meaning, any sentence
        using it; for a word with several, only when the English translation
        names this meaning's gloss word and no other meaning's (the
        translation says which meaning the sentence uses);
     3. a sentence the model writes for this sense (llm.mjs), only when the
        model step is enabled.
   Otherwise the sense ships without one and the app says "Example coming
   soon" — never another sense's example.

   Checks (all must pass): the word is found in the sentence (spans saved),
   every de/het before a noun agrees, every word is spelled as OpenTaal
   spells it, and the sentence is short enough to read on a card. */
import { articleIssues, contentWords, findTargetSpans, spellingIssues, tokenize } from "../../src/lib/dictionary/checks.ts";

const MAX_WORDS = 18;
const MIN_WORDS = 3;

/** Every form the word can take in a sentence, for target finding. */
export function targetForms(word, use) {
  const forms = [word.form, ...use.forms.map((f) => f.form)];
  if (use.pattern && use.headForms) {
    // A verb + preposition unit: any form of the verb, then the preposition.
    const prep = use.governs;
    for (const f of use.headForms) forms.push(`${f} ${prep}`);
  }
  return forms;
}

/** What's wrong with a candidate example, or [] when it passes. */
export function exampleIssues(example, forms, ctx) {
  const issues = [];
  const words = tokenize(example.nl);
  if (words.length < MIN_WORDS) issues.push("too short");
  if (words.length > MAX_WORDS) issues.push("too long");
  if (!example.en?.trim()) issues.push("no translation");
  if (/[\n[\]{}|]/.test(example.nl)) issues.push("markup in sentence");
  const spans = findTargetSpans(example.nl, forms);
  if (!spans) issues.push("word not found in sentence");
  issues.push(...articleIssues(example.nl, ctx.articleOf));
  issues.push(...spellingIssues(example.nl, ctx.isKnown));
  return { issues, spans };
}

/** Tatoeba, indexed by lower-case word. */
export function indexTatoeba(pairs) {
  const byToken = new Map();
  pairs.forEach((p, i) => {
    for (const t of new Set(tokenize(p.nl).map((x) => x.lower))) {
      const list = byToken.get(t);
      if (list) list.push(i);
      else byToken.set(t, [i]);
    }
  });
  return { pairs, byToken };
}

/** Assigns examples to every sense of a word. Returns counters for the
 *  build report. */
export function assignExamples(word, ctx, tatoeba) {
  const stats = { wiktionary: 0, tatoeba: 0, rejected: 0, none: 0, rejections: [] };
  const senseCount = word.uses.reduce((n, u) => n + u.senses.length, 0);
  for (const use of word.uses) {
    const forms = targetForms(word, use);
    for (const sense of use.senses) {
      sense.examples = [];
      for (const raw of sense._rawExamples ?? []) {
        if (sense.examples.length >= 2) break;
        const example = { nl: raw.text.normalize("NFC").trim(), en: String(raw.translation ?? "").normalize("NFC").trim() };
        const { issues, spans } = exampleIssues(example, forms, ctx);
        if (issues.length) {
          stats.rejected++;
          if (stats.rejections.length < 3) stats.rejections.push({ word: word.form, sentence: example.nl, issues });
          continue;
        }
        sense.examples.push({ ...example, targetSpans: spans, source: "corpus", origin: "wiktionary" });
        stats.wiktionary++;
      }
      if (sense.examples.length === 0 && word.kind !== "multiword" && tatoeba) {
        // One meaning: any sentence with the word is that meaning. Several:
        // the translation has to say which — it must contain this meaning's
        // gloss word and no other meaning's.
        const accept = senseCount === 1 ? () => true : translationPicks(sense, word);
        const found = accept ? tatoebaExample(word, forms, ctx, tatoeba, accept, senseCount > 1) : null;
        if (found) {
          sense.examples.push(found);
          stats.tatoeba++;
        }
      }
      if (sense.examples.length === 0) stats.none++;
    }
  }
  return stats;
}

/** English words a gloss is recognised by in a translation: its content
 *  words, with plural and verb endings allowed ("ball" → balls, "to call"
 *  → calls, called, calling). */
function glossWords(gloss) {
  return contentWords(gloss).filter((w) => w.length >= 3);
}

const mentions = (english, word) => new RegExp(`\\b${word.replace(/[^a-z'-]/g, "")}(s|es|d|ed|ing)?\\b`, "i").test(english);

/** A test for "this translation shows this meaning", or null when the
 *  meaning can't be told apart from its siblings by gloss words. */
function translationPicks(sense, word) {
  const siblings = new Set(word.uses.flatMap((u) => u.senses).filter((s) => s !== sense).flatMap((s) => glossWords(s.gloss)));
  // Only words that tell this meaning apart from the others.
  const own = glossWords(sense.gloss).filter((w) => !siblings.has(w));
  if (!own.length) return null;
  return (english) => own.some((w) => mentions(english, w)) && ![...siblings].some((w) => mentions(english, w));
}

function tatoebaExample(word, forms, ctx, tatoeba, accept = () => true, strict = false) {
  const single = [...new Set(forms.filter((f) => !f.includes(" ")).map((f) => f.toLowerCase()))];
  const candidates = new Set();
  for (const f of single) for (const i of tatoeba.byToken.get(f) ?? []) candidates.add(i);
  const ranked = [...candidates]
    .map((i) => tatoeba.pairs[i])
    .filter((p) => p.nl.length >= 20)
    .sort((a, b) => a.nl.length - b.nl.length);
  for (const p of ranked.filter((x) => accept(x.en)).slice(0, 40)) {
    const example = { nl: p.nl, en: p.en };
    const { issues, spans } = exampleIssues(example, forms, ctx);
    // For a word with several meanings, the word in the sentence must be
    // this word's alone: "benen" is also the plural of been.
    if (!issues.length && strict && spans.some(([a, b]) => (ctx.ownerCount?.(p.nl.slice(a, b).toLowerCase()) ?? 1) > 1)) continue;
    if (!issues.length) return { ...example, targetSpans: spans, source: "corpus", origin: "tatoeba" };
  }
  return null;
}
