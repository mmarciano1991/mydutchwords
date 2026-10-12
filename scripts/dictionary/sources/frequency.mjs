/* Word frequency — OpenSubtitles 2018, top 50k forms. A word's rank is its
   position (1 = most common); a word not in the list ranks after all of it. */
import { join } from "node:path";
import { eachLine } from "../io.mjs";
import { CACHE_DIR } from "../paths.mjs";

export const UNRANKED = 100_000;

export async function loadFrequency() {
  const rank = new Map();
  let i = 0;
  await eachLine(join(CACHE_DIR, "nl-frequency.txt"), (line) => {
    const [word] = line.split(" ");
    if (!word) return;
    i++;
    const w = word.normalize("NFC").toLowerCase();
    if (!rank.has(w)) rank.set(w, i);
  });
  /** Rank of a form; for a multiword unit, its rarest word's rank (a phrase
   *  is at most as common as its least common word). */
  function of(form) {
    const words = form.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return UNRANKED;
    return Math.max(...words.map((w) => rank.get(w) ?? UNRANKED));
  }
  return { of, size: rank.size };
}
