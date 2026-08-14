/* Online dictionary fallback — Wiktionary REST API (free, CORS-enabled,
   no key). Used by the capture flow when a typed word isn't in the bundled
   dictionary.

   Contract: resolves to a DictionaryEntry when the word has a Dutch entry,
   `null` when it genuinely has none (404 / no Dutch section), and THROWS on
   network failures, server errors, timeouts, and cancellation — so callers
   can tell "not found" apart from "the lookup failed".

   Article and example sentence, best-effort, from two different places:
    - An example sentence rides along on the definition response itself,
      in `parsedExamples`, whenever that sense was authored with Wiktionary's
      {{uxi}} template — no extra request. Most senses simply don't have one
      ("kat" has none at all; "huis" has several), so this is often still
      empty, same as before — the word still enters the normal practice
      cycle either way.
    - The article isn't in the definition response at all — it only shows up
      on the rendered page, in the noun's headword line (`<span
      class="gender"><abbr title="…">`). Fetched separately with a second
      request, and only when a noun sense actually exists to attach it to.
      Any failure here (network, timeout, no headword found) degrades to the
      previous null rather than failing the whole lookup: this is
      enrichment on top of an already-usable result, not part of the
      contract above. */
import type { DictionaryEntry, Gender, WordSense } from "./types";

interface WiktionaryExample {
  example: string;
  translation: string;
}
interface WiktionaryDefinition {
  definition: string;
  parsedExamples?: WiktionaryExample[];
}
interface WiktionaryUsage {
  partOfSpeech: string;
  language: string;
  definitions: WiktionaryDefinition[];
}

/** Plain text from a definition's markup.
 *
 *  Parsed through DOMParser, which produces an inert document: no scripts
 *  run and no subresources are fetched. Assigning this third-party HTML to
 *  `innerHTML` — even on a detached node, as this used to — still fires
 *  handlers like `<img onerror>`. */
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Maps a headword line's `<abbr title="…">` to a Dutch article: "neuter
 *  gender" is the one case that's `het`; masculine, feminine, and the
 *  merged "common gender" (the historical m/f merger most nl-noun entries
 *  actually carry) all take `de`. */
function genderFromAbbrTitle(title: string): Gender {
  const t = title.toLowerCase();
  if (t.includes("neuter")) return "het";
  if (t.includes("masculine") || t.includes("feminine") || t.includes("common")) return "de";
  return null;
}

/** One retry, after a brief pause, for the kind of failure that's usually
 *  gone a moment later: a dropped wifi/cellular handoff (the fetch promise
 *  rejects near-instantly, not after the timeout) or a transient 5xx/429
 *  from Wiktionary's own API. Real cancellation/timeout (the shared
 *  controller already aborted) is never retried — that's a deliberate stop,
 *  not a hiccup. */
async function fetchWithRetry(url: string, signal: AbortSignal): Promise<Response> {
  const attempt = () => fetch(url, { signal, headers: { Accept: "application/json" } });
  let res: Response;
  try {
    res = await attempt();
  } catch (err) {
    if (signal.aborted) throw err;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return attempt();
  }
  if (res.ok || res.status === 404 || signal.aborted) return res;
  await new Promise((resolve) => setTimeout(resolve, 500));
  return attempt();
}

/** Reads the article straight out of the rendered page's headword line —
 *  the one piece of grammar `/page/definition/` doesn't carry at all. Scoped
 *  to the Dutch-language section so an English or Afrikaans homograph's own
 *  headword (`huis` has both) never leaks in. Takes the first noun headword
 *  on the page; a rarer homograph with two differently-gendered noun senses
 *  under separate etymologies would all get that one article, which is a
 *  known simplification, not a bug — still strictly better than the null
 *  every online capture got before this. */
async function fetchGender(term: string, signal: AbortSignal): Promise<Gender> {
  try {
    const res = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/html/${encodeURIComponent(term)}`,
      { signal, headers: { Accept: "text/html" } }
    );
    if (!res.ok) return null;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const section = doc.getElementById("Dutch")?.closest("section");
    const title = section?.querySelector(".headword-line .gender abbr[title]")?.getAttribute("title");
    return title ? genderFromAbbrTitle(title) : null;
  } catch {
    // Best-effort: a failed enrichment request shouldn't fail a lookup that
    // otherwise already succeeded on the definition endpoint.
    return null;
  }
}

export async function lookupWiktionary(
  word: string,
  { signal, timeoutMs = 8000 }: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<DictionaryEntry | null> {
  const term = word.trim().toLowerCase();
  // Inner controller merges the caller's signal with our own timeout, so a
  // timeout surfaces as an error while a caller abort stays a cancellation.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchWithRetry(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(term)}`,
      controller.signal
    );
    if (res.status === 404) return null; // page doesn't exist — a real "not found"
    if (!res.ok) throw new Error(`Wiktionary responded ${res.status}`);
    const data = (await res.json()) as Record<string, WiktionaryUsage[]> | null;
    // Shape is validated rather than trusted: this is a third-party payload,
    // and a TypeError here would be reported to the user as a failed request
    // ("check your connection") when the request in fact succeeded.
    const usages = data?.nl;
    if (!Array.isArray(usages)) return null;
    const dutch = usages.filter((u) => u?.language === "Dutch");
    if (dutch.length === 0) return null;

    // Every distinct Dutch definition, not just the first — the response
    // already carries all of them across every part-of-speech section, and
    // returning only the first meant a genuine heteronym (the exact case
    // Wiktionary is richest for) silently handed back one arbitrary sense.
    // Capped so an unusually prolific entry doesn't turn the capture screen
    // into a wall of choices nobody will read.
    const MAX_SENSES = 5;
    const senses: WordSense[] = [];
    const seen = new Set<string>();
    for (const usage of dutch) {
      if (senses.length >= MAX_SENSES) break;
      if (!Array.isArray(usage.definitions)) continue;
      const label = usage.partOfSpeech?.toLowerCase();
      for (const def of usage.definitions) {
        if (senses.length >= MAX_SENSES) break;
        if (typeof def?.definition !== "string") continue;
        const english = stripHtml(def.definition);
        const key = english.toLowerCase();
        if (!english || seen.has(key)) continue;
        seen.add(key);
        // The first authored {{uxi}} example for this sense, if any — most
        // senses don't have one (see the file header), so this is often
        // still empty.
        const example = def.parsedExamples?.[0];
        senses.push({
          english,
          example: example ? stripHtml(example.example) : "",
          exampleEn: example ? stripHtml(example.translation) : "",
          gender: null,
          label,
        });
      }
    }
    if (senses.length === 0) return null;

    // Only nouns have an article, and it's not in this response at all — so
    // only bother with the extra request when a noun sense is actually here
    // to receive it.
    if (senses.some((s) => s.label === "noun")) {
      const gender = await fetchGender(term, controller.signal);
      if (gender) {
        for (const sense of senses) {
          if (sense.label === "noun") sense.gender = gender;
        }
      }
    }

    // These mirror senses[0] exactly — see DictionaryEntry's own doc comment
    // for why every reader that only looks at the top-level fields is
    // reading the primary sense.
    return {
      id: term,
      dutch: term,
      english: senses[0].english,
      gender: senses[0].gender,
      example: senses[0].example,
      exampleEn: senses[0].exampleEn,
      senses,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
