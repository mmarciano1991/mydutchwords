import type { Lookup } from "./types";
import { fallbackLookup } from "./fallbackDictionary";
import { loadApiKey } from "./storage";

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

function resolveKey(): string {
  return loadApiKey() || import.meta.env.VITE_ANTHROPIC_API_KEY || "";
}

/** True when a real Claude lookup is possible (a key is configured). */
export function hasApiKey(): boolean {
  return resolveKey().length > 0;
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
}

function buildPrompt(dutch: string): string {
  return [
    `You are a Dutch–English dictionary for a language learner.`,
    `For the Dutch word "${dutch}", respond with ONLY a JSON object, no prose, no code fences:`,
    `{"translation": "<concise English translation>", "example_sentence": "<one natural Dutch sentence that uses the word \\"${dutch}\\" verbatim>"}`,
    `The example_sentence MUST contain the exact word "${dutch}".`,
  ].join("\n");
}

/**
 * Look up a Dutch word's translation and a Dutch example sentence.
 *
 * Approach A from the build spec: one Claude call returning
 * { translation, example_sentence }. If no API key is configured or the call
 * fails, falls back to the offline dictionary so the demo always works.
 */
export async function lookupWord(dutch: string): Promise<Lookup> {
  const apiKey = resolveKey();
  if (!apiKey) return fallbackLookup(dutch);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Required to call the API directly from a browser.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: import.meta.env.VITE_ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 200,
        messages: [{ role: "user", content: buildPrompt(dutch) }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((b) => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(stripFences(text)) as Partial<Lookup>;

    if (
      typeof parsed.translation === "string" &&
      typeof parsed.example_sentence === "string" &&
      parsed.translation.trim() &&
      parsed.example_sentence.trim()
    ) {
      return {
        translation: parsed.translation.trim(),
        example_sentence: parsed.example_sentence.trim(),
      };
    }
    throw new Error("Unexpected response shape");
  } catch (err) {
    console.warn("Claude lookup failed, using offline fallback:", err);
    return fallbackLookup(dutch);
  }
}
