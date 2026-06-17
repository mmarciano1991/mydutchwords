import type { Gender, Lookup } from "./types";
import { fallbackLookup } from "./fallbackDictionary";

// The app talks to its own PHP proxy (same origin), never to Anthropic directly,
// so the API key stays on the server. Relative path resolves under the app's
// base (e.g. /mydutchwords/api.php). Overridable for other hosting setups.
const API_URL = import.meta.env.VITE_API_BASE || "api.php";

function normalizeGender(value: unknown): Gender {
  return value === "de" || value === "het" ? value : null;
}

async function callProxy<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Proxy ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Look up a Dutch word: English translation, de/het gender, and an example
 * sentence. Falls back to the offline dictionary if the backend is unreachable
 * or not configured, so capture always works.
 */
export async function lookupWord(dutch: string): Promise<Lookup> {
  try {
    const data = await callProxy<Partial<Lookup> & { error?: string }>({
      action: "lookup",
      word: dutch,
    });
    if (data.error) throw new Error(data.error);
    if (typeof data.translation === "string" && typeof data.example_sentence === "string") {
      return {
        translation: data.translation.trim(),
        gender: normalizeGender(data.gender),
        example_sentence: data.example_sentence.trim(),
      };
    }
    throw new Error("Unexpected lookup shape");
  } catch (err) {
    console.warn("Lookup via proxy failed, using offline fallback:", err);
    return fallbackLookup(dutch);
  }
}

/**
 * Generate a FRESH Dutch sentence that uses `dutch` verbatim, for a
 * fill-in-the-blank exercise. Returns null on failure so the caller can fall
 * back to a cached/stored sentence.
 */
export async function generateExerciseSentence(dutch: string): Promise<string | null> {
  try {
    const data = await callProxy<{ sentence?: string; error?: string }>({
      action: "exercise",
      word: dutch,
    });
    if (data.error || typeof data.sentence !== "string" || !data.sentence.trim()) {
      throw new Error(data.error || "Unexpected exercise shape");
    }
    return data.sentence.trim();
  } catch (err) {
    console.warn("Exercise generation via proxy failed:", err);
    return null;
  }
}

/** Health check for Settings: is the proxy reachable and is a key configured? */
export async function checkBackend(): Promise<{ reachable: boolean; configured: boolean }> {
  try {
    const res = await fetch(API_URL, { method: "GET" });
    if (!res.ok) return { reachable: false, configured: false };
    const data = (await res.json()) as { ok?: boolean; configured?: boolean };
    return { reachable: Boolean(data.ok), configured: Boolean(data.configured) };
  } catch {
    return { reachable: false, configured: false };
  }
}
