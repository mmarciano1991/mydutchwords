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
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
