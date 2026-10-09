/* exercises — building and checking the individual exercises.

   Which exercise a word gets, and what an answer does to its schedule, is
   decided by the learning engine (lib/learningEngine). This module only
   builds an exercise's content: the options of a multiple choice or a
   listening exercise, and the part-of-speech hint. Typed answers are
   checked in lib/answerCheck.

   The order a session asks its words in, review included, is
   lib/sessionQueue's.

   Pure and synchronous: no React, no storage, no clock. Randomness is
   injectable so the tests are deterministic. */
import { editDistance } from "./answerCheck";
import { LISTENING_OPTION_COUNT, MC_OPTION_COUNT } from "./learningConfig";
import type { DictionaryEntry } from "./types";

// ── Parts of speech ──

export type Shape = "verb" | "noun" | "other";

/** A rough part of speech, so distractors look like plausible answers:
 *  "to meet" should be offered verbs, not "tegenwoordig". There is no
 *  structured part-of-speech field: verbs are glossed "to …", nouns carry
 *  de/het. Everything else is "other" — unknown, not "not a noun". */
export function shapeOf(entry: DictionaryEntry): Shape {
  if (/^to\s/i.test(entry.english.trim())) return "verb";
  if (entry.gender === "de" || entry.gender === "het") return "noun";
  return "other";
}

const POS_LABELS = ["noun", "verb", "adjective", "adverb", "preposition", "pronoun", "conjunction", "numeral", "interjection"];

/** The Active Recall hint: "noun · het", "verb", or a part of speech the
 *  online dictionary gave. Null when it isn't known — better no hint than a
 *  guessed one. */
export function posHint(entry: DictionaryEntry): string | null {
  const shape = shapeOf(entry);
  if (shape === "noun") return `noun · ${entry.gender}`;
  if (shape === "verb") return "verb";
  const label = entry.senses?.[0]?.label?.toLowerCase().trim();
  return label && POS_LABELS.includes(label) ? label : null;
}

/** Fisher–Yates, with an injectable random source. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Every English gloss of an entry, normalised — the meanings a distractor
 *  must not share. */
function glosses(entry: DictionaryEntry): Set<string> {
  return new Set([entry.english, ...(entry.senses ?? []).map((s) => s.english)].map(normalize));
}

// ── Matching ──

/** One short English label per Matching tile, so a tile stays on one line:
 *  "different / various / diverse" becomes a single gloss. Each word gets its
 *  first gloss that no other word on the grid also has — "ander" (other /
 *  another / different) and "verschillend" (different / various) show
 *  "other" and "various", never two "different"s. If every gloss is shared,
 *  the first one stands. In the order of `entries`. */
export function matchingLabels(entries: DictionaryEntry[]): string[] {
  const parts = (e: DictionaryEntry) =>
    e.english
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean);
  const all = entries.map((e) => new Set([...parts(e), ...(e.senses ?? []).flatMap((s) => s.english.split("/"))].map(normalize)));
  const used = new Set<string>();
  return entries.map((e, i) => {
    const own = parts(e);
    const label =
      own.find((p) => {
        const n = normalize(p);
        return !used.has(n) && all.every((g, j) => j === i || !g.has(n));
      }) ??
      own[0] ??
      e.english;
    used.add(normalize(label));
    return label;
  });
}

// ── Multiple choice ──

/** English options for Multiple Choice: the answer's translation plus
 *  distractors, same part of speech first, in random order. Distractors
 *  come from the user's own deck; only when it can't supply enough are the
 *  rest drawn from `filler` (the bundled dictionary). Null when even that
 *  isn't enough.
 *
 *  A distractor never shares a meaning with the answer (that would be a
 *  correct answer marked wrong), and no two options read the same. */
export function buildEnglishChoices(
  answer: DictionaryEntry,
  pool: DictionaryEntry[],
  random: () => number = Math.random,
  filler: DictionaryEntry[] = []
): string[] | null {
  const own = glosses(answer);
  const seen = new Set([normalize(answer.english)]);
  const dutchSeen = new Set([normalize(answer.dutch)]);
  const shape = shapeOf(answer);
  const needed = MC_OPTION_COUNT - 1;

  /** Usable distractors from `source`, same shape first, at most `limit`. */
  function draw(source: DictionaryEntry[], limit: number): DictionaryEntry[] {
    const usable: DictionaryEntry[] = [];
    for (const e of shuffle(source, random)) {
      const english = normalize(e.english);
      const dutch = normalize(e.dutch);
      if (!english || dutchSeen.has(dutch) || seen.has(english)) continue;
      if ([...glosses(e)].some((g) => own.has(g))) continue;
      usable.push(e);
    }
    const ranked = [...usable.filter((e) => shapeOf(e) === shape), ...usable.filter((e) => shapeOf(e) !== shape)];
    const picked: DictionaryEntry[] = [];
    for (const e of ranked) {
      if (picked.length === limit) break;
      // Re-check: two entries in this source can share a gloss or spelling.
      if (seen.has(normalize(e.english)) || dutchSeen.has(normalize(e.dutch))) continue;
      seen.add(normalize(e.english));
      dutchSeen.add(normalize(e.dutch));
      picked.push(e);
    }
    return picked;
  }

  const distractors = draw(pool, needed);
  if (distractors.length < needed && filler.length > 0) {
    // Only the deck's own words are excluded from the filler by spelling.
    for (const e of pool) dutchSeen.add(normalize(e.dutch));
    distractors.push(...draw(filler, needed - distractors.length));
  }
  if (distractors.length < needed) return null;
  return shuffle([answer.english, ...distractors.map((e) => e.english)], random);
}

// ── Listening ──

/** Dutch options for Listening: the word plus the words that look most
 *  like it (closest spelling first), in random order — "fiets" is offered
 *  with "vies", "vis", "feest". Look-alikes come from the user's deck and
 *  from `filler` (the bundled dictionary); on equal distance the deck's own
 *  word wins. Null when even together they can't supply enough. */
export function buildListeningChoices(
  answer: DictionaryEntry,
  pool: DictionaryEntry[],
  random: () => number = Math.random,
  filler: DictionaryEntry[] = []
): string[] | null {
  const target = normalize(answer.dutch);
  const seen = new Set([target]);
  const others: { dutch: string; own: boolean }[] = [];
  for (const [source, own] of [[pool, true], [filler, false]] as const) {
    for (const e of shuffle(source, random)) {
      const d = normalize(e.dutch);
      if (!d || seen.has(d)) continue;
      seen.add(d);
      others.push({ dutch: e.dutch, own });
    }
  }
  const similar = others
    .map((o) => ({ ...o, distance: editDistance(normalize(o.dutch), target) }))
    .sort((a, b) => a.distance - b.distance || Number(b.own) - Number(a.own))
    .slice(0, LISTENING_OPTION_COUNT - 1)
    .map((o) => o.dutch);
  if (similar.length < LISTENING_OPTION_COUNT - 1) return null;
  return shuffle([answer.dutch, ...similar], random);
}

// ── Typing ──

/** Lower case, accents off, punctuation off, single spaces. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Dutch words in `pool` that translate `entry` exactly as well — accepted
 *  as typed answers. */
export function synonymsOf(entry: DictionaryEntry, pool: DictionaryEntry[]): string[] {
  const english = normalize(entry.english);
  return pool.filter((e) => e.id !== entry.id && normalize(e.english) === english).map((e) => e.dutch);
}
