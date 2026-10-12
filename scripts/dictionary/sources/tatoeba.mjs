/* Tatoeba — real Dutch sentences with an English translation (CC-BY 2.0 FR).
   Returns pairs; a Dutch sentence with several translations keeps the
   shortest. */
import { join } from "node:path";
import { eachBz2Line } from "../io.mjs";
import { CACHE_DIR } from "../paths.mjs";

export async function loadTatoeba() {
  const nl = new Map();
  await eachBz2Line(join(CACHE_DIR, "tatoeba-nld.tsv.bz2"), (line) => {
    const [id, , text] = line.split("\t");
    if (id && text) nl.set(id, text.normalize("NFC").trim());
  });
  const links = new Map(); // nl id → en ids
  await eachBz2Line(join(CACHE_DIR, "tatoeba-nld-eng-links.tsv.bz2"), (line) => {
    const [a, b] = line.split("\t");
    if (!nl.has(a)) return;
    const list = links.get(a);
    if (list) list.push(b);
    else links.set(a, [b]);
  });
  const wanted = new Set([...links.values()].flat());
  const en = new Map();
  await eachBz2Line(join(CACHE_DIR, "tatoeba-eng.tsv.bz2"), (line) => {
    const [id, , text] = line.split("\t");
    if (wanted.has(id)) en.set(id, text.normalize("NFC").trim());
  });
  const pairs = [];
  for (const [id, enIds] of links) {
    const translations = enIds.map((e) => en.get(e)).filter(Boolean).sort((x, y) => x.length - y.length);
    if (translations.length) pairs.push({ id, nl: nl.get(id), en: translations[0] });
  }
  return pairs;
}
