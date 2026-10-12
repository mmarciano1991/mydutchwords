/* ──────────────────────────────────────────────────────────────────────────
   Mechanical checks — what every entry must pass before it is stored,
   whoever (or whatever) wrote it. The build pipeline runs these on every
   sense and example; the app runs the same target-finding on a sentence the
   learner captured.

     glossIssues        one meaning, at most 3 content words + a parenthetical
     condenseGloss      the deterministic first pass at a short gloss
     findTargetSpans    where the word sits in a sentence (two spans for a
                        split separable verb: "Ik bel je morgen op")
     articleIssues      de/het agreement for every noun in a sentence
     spellingIssues     every word of a sentence is a real Dutch word

   Pure, no imports beyond normalize: the Node pipeline imports it directly.
   ────────────────────────────────────────────────────────────────────────── */
import { foldDiacritics } from "./normalize.ts";

// ── Glosses ──

/** Words that don't count toward a gloss's length. */
const FUNCTION_WORDS = new Set([
  "to", "a", "an", "the", "of", "for", "in", "on", "at", "with", "by", "from", "up", "out", "off",
  "as", "and", "be", "one's", "oneself", "someone", "something", "somebody", "sth", "sb", "into",
  "onto", "about", "over", "down", "away", "back", "it", "its",
]);

/** Splits on `sep` only outside parentheses and brackets. */
function splitTopLevel(text: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if (depth === 0 && sep.test(ch)) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** The part before a top-level " or ". */
function splitOr(text: string): string {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if (depth === 0 && text.startsWith(" or ", i)) return text.slice(0, i).trim();
  }
  return text;
}

/** Content words outside parentheses. */
export function contentWords(gloss: string): string[] {
  const bare = gloss.replace(/\([^)]*\)/g, " ");
  return bare
    .toLowerCase()
    .split(/[\s/]+/)
    .map((w) => w.replace(/[^a-z'-]/g, ""))
    .filter((w) => w && !FUNCTION_WORDS.has(w));
}

/** What's wrong with a gloss, or [] when it is short and says one thing. */
export function glossIssues(gloss: string): string[] {
  const issues: string[] = [];
  const g = gloss.trim();
  if (!g) return ["empty gloss"];
  const outside = g.replace(/\([^)]*\)/g, "");
  if (/[;,/]/.test(outside) || /\bor\b/.test(outside)) issues.push("more than one meaning");
  if ((g.match(/\(/g) ?? []).length > 1) issues.push("more than one parenthetical");
  const words = contentWords(g);
  if (words.length > 3) issues.push(`${words.length} content words (max 3)`);
  // A gloss of function words only is fine when that is the meaning: the
  // article "een" is "a", the preposition "op" is "on".
  return issues;
}

/** The deterministic first pass at a short gloss: the most specific
 *  sub-gloss, its first meaning, leading "a/an/the" off, at most one short
 *  parenthetical kept. The result may still fail glossIssues — the model
 *  (or a reviewer) then condenses it, or it goes to the doubt queue. */
export function condenseGloss(raw: string): string {
  let g = raw.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  g = g.replace(/\.$/, "");
  // First meaning: before ";" then before "," — outside parentheses.
  g = splitTopLevel(g, /;/)[0] ?? g;
  // A comma that separates alternatives — not one inside a phrase ("scratch
  // on a hard, smooth surface"): the first part must not end mid-phrase.
  const commaParts = splitTopLevel(g, /,/);
  if (commaParts.length > 1 && !/\s(a|an|the)\s+[a-z][\w-]*$/.test(commaParts[0])) g = commaParts[0];
  // "a ball or any object with such a shape" → "a ball": alternatives
  // joined by "or" outside parentheses are separate meanings.
  g = splitOr(g);
  g = g.replace(/^(a|an|the)\s+(?=\S)/i, "");
  // Keep the first parenthetical only if it is short (≤ 3 words).
  const parens = [...g.matchAll(/\s*\(([^)]*)\)/g)];
  parens.forEach((m, i) => {
    const words = m[1].trim().split(/\s+/).length;
    if (i > 0 || words > 3) g = g.replace(m[0], "");
  });
  return g.replace(/\s+/g, " ").trim();
}

// ── Finding the word in a sentence ──

export interface Token {
  text: string;
  lower: string;
  start: number;
  end: number;
}

/** Same word shape as the reading screen: letters with inner apostrophes
 *  and hyphens, a leading apostrophe allowed ('s, 't). */
const WORD = /'?[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu;

export function tokenize(sentence: string): Token[] {
  return [...sentence.matchAll(WORD)].map((m) => ({
    text: m[0],
    lower: m[0].toLowerCase(),
    start: m.index!,
    end: m.index! + m[0].length,
  }));
}

/** The forms a word can take in a sentence. Multi-token forms ("kom aan",
 *  "zin hebben in") are matched part by part, left to right, with other
 *  words allowed in between — which is how a separable verb splits. */
export function findTargetSpans(sentence: string, forms: string[]): [number, number][] | null {
  const tokens = tokenize(sentence);
  const lowerForms = [...new Set(forms.map((f) => f.toLowerCase().trim()).filter(Boolean))];
  // Longest (most parts) first, so "kom aan" beats a lone "kom".
  const parts = lowerForms
    .map((f) => f.split(/\s+/))
    .sort((a, b) => b.length - a.length || b.join(" ").length - a.join(" ").length);

  for (const p of parts) {
    if (p.length === 1) {
      const hit = tokens.find((t) => t.lower === p[0] || foldDiacritics(t.lower) === foldDiacritics(p[0]));
      if (hit) return [[hit.start, hit.end]];
      continue;
    }
    // Ordered, gaps allowed, at most 8 words between consecutive parts.
    const spans: [number, number][] = [];
    let from = 0;
    let lastIndex = -1;
    for (const part of p) {
      const idx = tokens.findIndex((t, i) => i >= from && t.lower === part);
      if (idx === -1 || (lastIndex >= 0 && idx - lastIndex > 9)) {
        spans.length = 0;
        break;
      }
      spans.push([tokens[idx].start, tokens[idx].end]);
      lastIndex = idx;
      from = idx + 1;
    }
    if (spans.length === p.length) return mergeAdjacent(sentence, spans);
  }
  return null;
}

/** Spans that touch (only a space between) are one span: "zin hebben in"
 *  written together is one highlight, not three. */
function mergeAdjacent(sentence: string, spans: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const s of spans) {
    const last = out[out.length - 1];
    if (last && /^\s+$/.test(sentence.slice(last[1], s[0]))) last[1] = s[1];
    else out.push([...s]);
  }
  return out;
}

// ── de/het agreement ──

const DE_DETERMINERS = new Set(["de", "deze"]);
const HET_DETERMINERS = new Set(["het", "dit", "'t"]);

/** Every determiner + noun pair whose article disagrees with the noun.
 *  `articleOf` answers for a SINGULAR noun form with one article (de or het
 *  — never the double), and undefined for anything else, so plurals ("de
 *  huizen") and de/het words never trip it. */
export function articleIssues(sentence: string, articleOf: (lowerToken: string) => "de" | "het" | undefined): string[] {
  const tokens = tokenize(sentence);
  const issues: string[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const det = tokens[i - 1].lower;
    if (!DE_DETERMINERS.has(det) && !HET_DETERMINERS.has(det)) continue;
    // Only adjacent words: "het" followed by a comma or a line break is not
    // a determiner of what comes after.
    if (!/^\s+$/.test(sentence.slice(tokens[i - 1].end, tokens[i].start))) continue;
    const article = articleOf(tokens[i].lower);
    if (!article) continue;
    if (article === "het" && DE_DETERMINERS.has(det)) issues.push(`"${det} ${tokens[i].text}" — ${tokens[i].text} is a het-word`);
    if (article === "de" && HET_DETERMINERS.has(det)) issues.push(`"${det} ${tokens[i].text}" — ${tokens[i].text} is a de-word`);
  }
  return issues;
}

// ── Spelling ──

/** Words in the sentence that aren't real Dutch words. Capitalised words
 *  after the first are taken to be names and skipped; numbers too. */
export function spellingIssues(sentence: string, isKnown: (token: string) => boolean): string[] {
  const issues: string[] = [];
  tokenize(sentence).forEach((t, i) => {
    if (/^\p{N}+$/u.test(t.text)) return;
    if (i > 0 && /^\p{Lu}/u.test(t.text)) return;
    if (isKnown(t.text) || isKnown(t.lower)) return;
    issues.push(`unknown word "${t.text}"`);
  });
  return issues;
}

// ── Cognates ──

/** True when an English gloss is (nearly) the Dutch word itself — sauna,
 *  podcast, hotel. Such a word stays in the deck for recognition but proves
 *  nothing when answered. */
export function isCognate(dutch: string, gloss: string): boolean {
  const d = foldDiacritics(dutch.toLowerCase()).replace(/[^a-z]/g, "");
  const g = foldDiacritics(gloss.toLowerCase())
    .replace(/\([^)]*\)/g, "")
    .replace(/^(to|a|an|the)\s+/, "")
    .replace(/[^a-z]/g, "");
  if (!d || !g) return false;
  if (d === g) return true;
  // One edit apart on a word of 5+ letters (hotel/hotel, muziek/music no).
  if (Math.min(d.length, g.length) < 5) return false;
  let i = 0;
  while (i < d.length && d[i] === g[i]) i++;
  return d.slice(i + 1) === g.slice(i + 1) || d.slice(i + 1) === g.slice(i) || d.slice(i) === g.slice(i + 1);
}
