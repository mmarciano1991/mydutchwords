/* Online dictionary fallback — Wiktionary REST API (free, CORS-enabled,
   no key). Used by the capture flow when a typed word isn't in the bundled
   dictionary. Returns a DictionaryEntry-shaped result, or null when the
   word has no Dutch entry.

   Limitations (accepted for this slice): the definition endpoint doesn't
   expose the noun's article, so gender comes back null and example
   sentences are usually absent — the word still enters the normal
   practice cycle. */
import type { DictionaryEntry } from "./types";

interface WiktionaryDefinition {
  definition: string;
}
interface WiktionaryUsage {
  partOfSpeech: string;
  language: string;
  definitions: WiktionaryDefinition[];
}

function stripHtml(html: string): string {
  const el = document.createElement("div");
  el.innerHTML = html;
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

export async function lookupWiktionary(
  word: string,
  timeoutMs = 8000
): Promise<DictionaryEntry | null> {
  const term = word.trim().toLowerCase();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(term)}`,
      { signal: controller.signal, headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, WiktionaryUsage[]>;
    const dutch = data.nl?.filter((u) => u.language === "Dutch");
    if (!dutch || dutch.length === 0) return null;

    // First usable gloss across the Dutch part-of-speech sections.
    for (const usage of dutch) {
      for (const def of usage.definitions) {
        const english = stripHtml(def.definition);
        if (english) {
          return {
            id: term,
            dutch: term,
            english,
            gender: null,
            example: "",
            exampleEn: "",
          };
        }
      }
    }
    return null;
  } catch {
    return null; // network error / timeout → treated as not found online
  } finally {
    clearTimeout(timer);
  }
}
