/* One-off: writes the frozen pre-server dictionary (src/data/legacy) as
   static JSON shards in public/legacy, so it leaves the JS bundle.

   Run once with `npx vite-node scripts/legacy/export-legacy.ts`, before
   src/data/legacy was deleted. Kept for the record of how the shards were
   made; the shards themselves are now the frozen copy. */
import { mkdirSync, writeFileSync } from "node:fs";
import { DICTIONARY } from "../../src/data/legacy/dictionary";
import { legacyEntry, ready } from "../../src/data/legacy/resolve";
import { legacyShardOf } from "../../src/lib/legacyDictionary";

await ready();
const shards = new Map<string, Record<string, unknown>>();
let words = 0;
for (const e of DICTIONARY) {
  const base = legacyEntry(e.id);
  if (!base) continue;
  const shard = legacyShardOf(e.id);
  if (!shards.has(shard)) shards.set(shard, {});
  // Only the word and its senses: every other field of an entry is read off
  // the sense the id points at ("aanslag#1" → senses[1]), at runtime. Empty
  // example fields are left out (lib/legacyDictionary puts them back).
  const senses = base.senses.map((sense) => {
    const out: Record<string, unknown> = { ...sense };
    if (!out.example) delete out.example;
    if (!out.exampleEn) delete out.exampleEn;
    return out;
  });
  shards.get(shard)![e.id] = { dutch: base.dutch, senses };
  words++;
}
mkdirSync("public/legacy", { recursive: true });
for (const [name, data] of shards) writeFileSync(`public/legacy/${name}.json`, JSON.stringify(data));
console.log(`${words} words in ${shards.size} shards`);
