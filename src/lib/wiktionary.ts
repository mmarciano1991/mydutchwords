/* Online dictionary fallback — Wiktionary REST API (free, CORS-enabled,
   no key). Used by the capture flow when a typed word isn't in the bundled
   dictionary.

   Contract: resolves to a DictionaryEntry when the word has a Dutch entry,
   `null` when it genuinely has none (404 / no Dutch section), and THROWS on
   network failures, server errors, timeouts, and cancellation — so callers
   can tell "not found" apart from "the lookup failed".

   Limitations (accepted for this slice): the definition endpoint doesn't
   expose the noun's article, so gender comes back null and example
   sentences are usually absent — the word still enters the normal
   practice cycle. */
import type { DictionaryEntry, WordSense } from "./types";

interface WiktionaryDefinition {
  definition: string;
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
    const res = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(term)}`,
      { signal: controller.signal, headers: { Accept: "application/json" } }
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
      for (const def of usage.definitions) {
        if (senses.length >= MAX_SENSES) break;
        if (typeof def?.definition !== "string") continue;
        const english = stripHtml(def.definition);
        const key = english.toLowerCase();
        if (!english || seen.has(key)) continue;
        seen.add(key);
        // Gender and examples are the same absence as before, per sense —
        // the definition endpoint doesn't carry either.
        senses.push({ english, example: "", exampleEn: "", gender: null, label: usage.partOfSpeech?.toLowerCase() });
      }
    }
    if (senses.length === 0) return null;

    return {
      id: term,
      dutch: term,
      english: senses[0].english,
      gender: null,
      example: "",
      exampleEn: "",
      senses,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
