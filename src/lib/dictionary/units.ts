/* ──────────────────────────────────────────────────────────────────────────
   Units in a sentence — for Add from text.

   A tapped word is often only part of what the learner should learn:

     separable verb    "Ik bel je morgen op"      tap bel → opbellen
     verb + prep       "We wachten op de bus"     tap wachten → wachten op
     expression        "Ik heb zin in koffie"     tap zin → zin hebben
     abbreviated pair  "in- en uitvoer"           tap in → invoer + uitvoer

   Each unit is offered next to the single word ("Just bellen"), with both
   parts of a split verb highlighted. The sentence itself is never changed.
   A compound is already one token ("belastingaanslag", "GGD-test"), so
   tapping any part of it selects all of it without anything here.
   ────────────────────────────────────────────────────────────────────────── */
import { findTargetSpans, tokenize, type Token } from "./checks";
import { resolveAbbreviatedCoordination, splitAtHead } from "./compound";
import type { WordEntry } from "./model";
import { searchKey } from "./normalize";
import { dictionarySource, findCompound, lookup } from "./service";

export interface UnitOffer {
  kind: "separable" | "multiword" | "coordination";
  /** The unit's headword (opbellen, wachten op) — or, for an abbreviated
   *  pair, both full words. */
  forms: string[];
  /** The dictionary entries, when the unit is a word of its own. */
  words: WordEntry[];
  /** Where the unit sits in the sentence — every part highlighted. */
  spans: [number, number][];
}

const PARTICLES = new Set([
  "aan", "af", "bij", "door", "in", "mee", "na", "om", "onder", "op", "over", "toe", "uit", "voor",
  "terug", "weg", "samen", "tegen", "voorbij", "thuis", "neer", "los", "vast", "open", "dicht", "mis",
  "kapot", "schoon", "klaar", "binnen", "buiten", "achter", "rond", "langs", "heen",
]);

const includesToken = (spans: [number, number][], t: Token) => spans.some(([s, e]) => s <= t.start && t.end <= e);

/** Verb lemmas a token can be a form of. */
async function verbLemmas(token: Token, signal?: AbortSignal): Promise<string[]> {
  const r = await lookup(token.text, { signal });
  return r.matches
    .filter((m) => m.word.uses.some((u) => u.pos === "verb" && (!m.useIds || m.useIds.includes(u.id))))
    .map((m) => m.word.form);
}

/** Every unit the tapped token belongs to, in the order to offer them. */
export async function unitsAt(sentence: string, tapped: { start: number; end: number }, signal?: AbortSignal): Promise<UnitOffer[]> {
  const tokens = tokenize(sentence);
  const index = tokens.findIndex((t) => t.start === tapped.start);
  if (index < 0) return [];
  const token = tokens[index];
  const offers: UnitOffer[] = [];

  const coordination = await coordinationAt(sentence, token, signal);
  if (coordination) offers.push(coordination);

  // ── Separable verbs: a particle after a verb, or a verb before a particle.
  const pairs: { verb: Token; particle: Token }[] = [];
  if (PARTICLES.has(token.lower)) {
    for (const t of tokens.slice(Math.max(0, index - 8), index)) pairs.push({ verb: t, particle: token });
  } else {
    for (const t of tokens.slice(index + 1, index + 10)) if (PARTICLES.has(t.lower)) pairs.push({ verb: token, particle: t });
  }
  const seen = new Set<string>();
  for (const { verb, particle } of pairs) {
    for (const lemma of await verbLemmas(verb, signal)) {
      const candidate = particle.lower + lemma;
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      const r = await lookup(candidate, { signal });
      for (const m of r.matches) {
        if (m.via !== "lemma") continue;
        const use = m.word.uses.find((u) => u.pos === "verb" && u.separable);
        if (!use) continue;
        const spans = findTargetSpans(sentence, use.forms.map((f) => f.form));
        if (spans && spans.length > 1 && includesToken(spans, token)) {
          offers.push({ kind: "separable", forms: [m.word.form], words: [m.word], spans });
        }
      }
    }
  }

  // ── Multiword units: the tapped word with a neighbour (or two), as written
  // or as their lemmas, in either order.
  const neighbours = tokens.slice(Math.max(0, index - 3), index + 4).filter((t) => t !== token);
  const tappedForms = new Set([token.lower, ...(await lookup(token.text, { signal })).matches.map((m) => m.word.form.toLowerCase())]);
  const neighbourForms = new Map<Token, Set<string>>();
  for (const n of neighbours) {
    neighbourForms.set(n, new Set([n.lower, ...(await lookup(n.text, { signal })).matches.map((m) => m.word.form.toLowerCase())]));
  }
  const phrases = new Set<string>();
  for (const a of tappedForms) {
    for (const [, forms] of neighbourForms) {
      for (const b of forms) {
        phrases.add(`${a} ${b}`);
        phrases.add(`${b} ${a}`);
        for (const [, forms2] of neighbourForms) {
          for (const c of forms2) {
            if (c === b) continue;
            phrases.add(`${a} ${b} ${c}`);
            phrases.add(`${b} ${a} ${c}`);
            phrases.add(`${b} ${c} ${a}`);
          }
        }
      }
    }
  }
  const keyed = new Map([...phrases].map((p) => [searchKey(p), p]));
  const parts = await dictionarySource().parts([...keyed.keys()], signal);
  const unitIds = [...new Set(parts.filter((p) => p.kind === "multiword" && p.isLemma).map((p) => p.wordId))];
  const units = await dictionarySource().words(unitIds, signal);
  for (const word of units) {
    for (const use of word.uses) {
      const spans = findTargetSpans(sentence, [word.form, ...use.forms.map((f) => f.form)]);
      if (spans && includesToken(spans, token) && !offers.some((o) => o.forms.includes(word.form))) {
        offers.push({ kind: "multiword", forms: [word.form], words: [word], spans });
      }
    }
  }
  return offers;
}

/** "in- en uitvoer" around the tapped token → invoer + uitvoer. */
async function coordinationAt(sentence: string, token: Token, signal?: AbortSignal): Promise<UnitOffer | null> {
  const patterns = [/(\p{L}+)-\s+(en|of|tot|en\/of)\s+(\p{L}+)/gu, /(\p{L}+)\s+(en|of|tot|en\/of)\s+-(\p{L}+)/gu];
  for (const re of patterns) {
    for (const m of sentence.matchAll(re)) {
      const start = m.index!;
      const end = start + m[0].length;
      if (token.start < start || token.end > end) continue;
      const known = new Map<string, boolean>();
      const heads = new Map<string, { modifier: string; head: string } | null>();
      // Answer the synchronous checks with data fetched up front.
      const words = [m[1], m[3]];
      for (const w of words) {
        const r = await lookup(w, { signal });
        const lemma = r.matches.find((x) => x.word.compound);
        heads.set(w, lemma?.word.compound ? splitAtHead(lemma.word.compound) : r.compound ? splitAtHead(r.compound.node) : null);
      }
      // Candidates: the abbreviated word completed with each possible head.
      const candidates = new Set<string>();
      const [x, y] = words;
      const ySplit = heads.get(y);
      const xSplit = heads.get(x);
      if (re === patterns[0]) {
        const options = ySplit ? [ySplit.head] : Array.from({ length: Math.max(0, y.length - 3) }, (_, i) => y.slice(i + 1));
        for (const h of options) candidates.add(x + h);
      } else if (xSplit) {
        candidates.add(xSplit.modifier + y);
      }
      for (const c of candidates) {
        const r = await lookup(c, { signal });
        known.set(c, r.matches.length > 0 || Boolean(r.compound));
      }
      const resolved = resolveAbbreviatedCoordination(m[0], {
        splitHead: (w) => heads.get(w) ?? null,
        isKnownOrDecomposable: (w) => known.get(w) ?? false,
      });
      if (!resolved) continue;
      const found: WordEntry[] = [];
      for (const f of resolved.full) {
        const r = await lookup(f, { signal });
        const w = r.matches.find((x) => x.via === "lemma")?.word ?? r.matches[0]?.word ?? (await findCompound(f, signal))?.word;
        if (w) found.push(w);
      }
      return { kind: "coordination", forms: resolved.full, words: found, spans: [[start, end]] };
    }
  }
  return null;
}
