/* Word structure from Wiktionary etymologies: a compound's binary tree,
   the morphemes of a derived word, and which syllable is stressed.

   Only ever built when the written word is exactly the parts put together
   (with an allowed joint) and every part is a published word: a structure
   that needs a spelling change explained (begraven + plaats →
   begraafplaats) is left out rather than half-explained. */

const SEPARABLE = new Set(["aan", "af", "bij", "door", "in", "mee", "na", "om", "onder", "op", "over", "toe", "uit", "voor", "terug", "weg", "samen", "tegen", "voorbij", "thuis", "neer", "los", "vast", "open", "dicht", "mis", "kapot", "schoon", "klaar", "binnen", "buiten", "achter", "rond", "langs", "heen", "teweeg"]);
const INSEPARABLE = new Set(["be", "ver", "ont", "her", "ge", "er"]);
const LINKS = new Set(["s", "en", "e", "er"]);

const bare = (p) => p.replace(/^-+|-+$/g, "");

/** Parts and the joint after each: ["belasting", "-s-", "aanslag"] →
 *  [{form: belasting, link: s}, {form: aanslag}]. */
function partsWithLinks(parts) {
  const out = [];
  for (const p of parts) {
    if (/^-.+-$/.test(p) && LINKS.has(bare(p)) && out.length) out[out.length - 1].link = bare(p);
    else out.push({ form: bare(p), link: "" });
  }
  return out;
}

export function buildCompound(word, words) {
  const ety = word._etymology;
  if (!ety || !["compound", "com", "com+", "af", "affix"].includes(ety.template)) return null;
  const use = word.uses[0];
  if (!["noun", "adjective"].includes(use.pos)) return null;
  const parts = partsWithLinks(ety.parts);
  if (parts.length < 2) return null;
  // Every part must be a dictionary word — no bound morphemes, no guesses.
  for (const p of parts) {
    const w = words.get(p.form) ?? words.get(p.form.toLowerCase());
    if (!w) return null;
    // A compound joins content words; "aan" + "slag" is a derivation.
    if (!w.uses.some((u) => ["noun", "verb", "adjective"].includes(u.pos)) && w.kind !== "abbreviation" && w.kind !== "properNoun") return null;
  }
  const joined = parts.map((p, i) => p.form + (i < parts.length - 1 ? p.link : "")).join("");
  if (joined.toLowerCase() !== word.form.toLowerCase().replace(/-/g, "")) return null;
  const leaf = (p) => {
    const target = words.get(p.form) ?? words.get(p.form.toLowerCase());
    const componentKind = target.kind === "properNoun" ? "properNoun" : target.kind === "abbreviation" ? "abbreviation" : "lemma";
    return { form: p.form, componentKind, wordId: target.id };
  };
  // Head-final, left-branching: ((a + b) + c).
  let node = leaf(parts[0]);
  let text = parts[0].form;
  for (let i = 1; i < parts.length; i++) {
    const link = parts[i - 1].link;
    text = text + link + parts[i].form;
    node = { form: text, link, componentKind: "lemma", left: node, right: leaf(parts[i]) };
  }
  node.form = word.form;
  return node;
}

export function morphemesOf(word) {
  const ety = word._etymology;
  const out = [];
  if (ety) {
    const parts = ety.parts.map((p) => p);
    const use = word.uses[0];
    for (let i = 0; i < parts.length; i++) {
      const raw = parts[i];
      const text = bare(raw);
      const isLast = i === parts.length - 1;
      if (raw.endsWith("-") || (i === 0 && use.pos === "verb" && parts.length === 2 && (SEPARABLE.has(text) || INSEPARABLE.has(text)))) {
        const type = text === "on" ? "on" : SEPARABLE.has(text) && use.separable ? "separablePrefix" : INSEPARABLE.has(text) ? "inseparablePrefix" : SEPARABLE.has(text) ? "separablePrefix" : "root";
        out.push({ text, type });
      } else if (raw === "-en" || (text === "en" && isLast)) {
        return undefined; // the infinitive ending is not a derivation
      } else if (raw.startsWith("-") && !raw.endsWith("-")) {
        out.push({ text, type: "suffix" });
      } else if (ety.template.startsWith("suf") && isLast && i > 0) {
        out.push({ text, type: "suffix" });
      } else if (/^-.+-$/.test(raw)) {
        continue; // interfix: part of the compound, not a morpheme
      } else {
        out.push({ text, type: "root" });
      }
    }
    // The pieces must spell the word. A suffix on a verb drops the
    // infinitive -en (beschikken + ing → beschik·k·ing doesn't spell, so
    // nothing is shown for it).
    if (out.length >= 2 && out.some((m) => m.type !== "root")) {
      const spelled = out.map((m) => m.text).join("");
      if (spelled === word.form) return out;
      if (out[out.length - 1].type === "suffix") {
        const stem = out[0].text.replace(/en$/, "");
        const alt = [stem, ...out.slice(1).map((m) => m.text)].join("");
        if (alt === word.form) return [{ ...out[0], text: stem }, ...out.slice(1)];
      }
    }
  }
  return undefined;
}

/** The stressed syllable, from the IPA's primary-stress mark matched against
 *  the hyphenation — only when both agree on the number of syllables. */
export function stressOf(word) {
  const ph = word._phonology;
  if (!ph?.ipa || !ph?.hyphenation?.length) return undefined;
  const ipa = ph.ipa.replace(/^[/[]|[/\]]$/g, "").split(/[ ,]/)[0];
  const syllables = ipa.split(/(?=[ˈˌ.])/).map((s) => s.replace(/^\./, "")).filter(Boolean);
  if (syllables.length !== ph.hyphenation.length) return undefined;
  const stressed = syllables.findIndex((s) => s.startsWith("ˈ"));
  if (stressed < 0) return undefined;
  return { parts: ph.hyphenation, stressed };
}
