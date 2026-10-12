/* Stable sense ids.

   A learner's deck and progress hang on a sense id, so it must survive
   rebuilds. Each sense has a source id (wiktextract's own per-sense id, or
   one derived for Dutch-Wiktionary senses); a registry maps source ids to
   our ids. When Wiktionary rewords a gloss its source id changes, so a
   sense with an unknown source id first looks for a vanished sense of the
   same word and part of speech with a similar gloss and takes over its id.
   Only a sense with no such predecessor gets a new one.

   The registry lives in Supabase (dict_sense_registry) and is pulled before
   a build (publish.mjs --pull-registry); locally it is a JSON file. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { contentWords } from "../../src/lib/dictionary/checks.ts";

export function loadRegistry(path) {
  if (!existsSync(path)) return { bySource: new Map(), entries: [] };
  const entries = JSON.parse(readFileSync(path, "utf8"));
  return { bySource: new Map(entries.map((e) => [e.sourceId, e])), entries };
}

export function saveRegistry(path, registry) {
  writeFileSync(path, JSON.stringify(registry.entries));
}

function newId(sourceId) {
  return "s_" + createHash("sha256").update(sourceId).digest("base64url").slice(0, 12);
}

function similarity(a, b) {
  const x = new Set(contentWords(a));
  const y = new Set(contentWords(b));
  if (!x.size || !y.size) return 0;
  const inter = [...x].filter((w) => y.has(w)).length;
  return inter / new Set([...x, ...y]).size;
}

/** Assigns `sense.id` for every sense, reusing ids wherever the registry
 *  knows them. Returns how many ids were kept, carried over and new. */
export function assignSenseIds(words, registry) {
  const stats = { kept: 0, carried: 0, created: 0 };
  const seenSources = new Set();
  const unmatched = [];
  // Source ids are not guaranteed unique (wiktextract repeats one for two
  // identical-looking glosses): a repeat gets a stable suffix.
  const used = new Map();
  for (const word of words) {
    for (const use of word.uses) {
      for (const sense of use.senses) {
        const n = used.get(sense.sourceId) ?? 0;
        used.set(sense.sourceId, n + 1);
        if (n > 0) sense.sourceId = `${sense.sourceId}~${n}`;
        seenSources.add(sense.sourceId);
        const known = registry.bySource.get(sense.sourceId);
        if (known) {
          sense.id = known.senseId;
          known.gloss = sense.gloss;
          stats.kept++;
        } else unmatched.push({ word, use, sense });
      }
    }
  }
  // Senses that vanished from the sources this build, by word + pos.
  const vanished = new Map();
  for (const e of registry.entries) {
    if (seenSources.has(e.sourceId)) continue;
    const k = `${e.wordId}|${e.pos}`;
    if (!vanished.has(k)) vanished.set(k, []);
    vanished.get(k).push(e);
  }
  for (const { word, use, sense } of unmatched) {
    const pool = vanished.get(`${word.id}|${use.pos}`) ?? [];
    let best = null;
    let bestScore = 0.5;
    for (const e of pool) {
      if (e.claimed) continue;
      const score = similarity(e.gloss, sense.gloss);
      if (score >= bestScore) {
        best = e;
        bestScore = score;
      }
    }
    if (best) {
      best.claimed = true;
      sense.id = best.senseId;
      registry.entries.push({ sourceId: sense.sourceId, senseId: best.senseId, wordId: word.id, pos: use.pos, gloss: sense.gloss });
      stats.carried++;
    } else {
      sense.id = newId(sense.sourceId);
      registry.entries.push({ sourceId: sense.sourceId, senseId: sense.id, wordId: word.id, pos: use.pos, gloss: sense.gloss });
      stats.created++;
    }
  }
  for (const e of registry.entries) delete e.claimed;
  registry.bySource = new Map(registry.entries.map((e) => [e.sourceId, e]));
  return stats;
}
