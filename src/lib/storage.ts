import type { PracticeResult, Word } from "./types";

const WORDS_KEY = "woordkast.words";
const RESULTS_KEY = "woordkast.results";
const APIKEY_KEY = "woordkast.apiKey";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — fail quietly for this demo slice */
  }
}

export function loadWords(): Word[] {
  // Newest first.
  return read<Word[]>(WORDS_KEY, []).sort((a, b) => b.dateAdded - a.dateAdded);
}

export function saveWords(words: Word[]): void {
  write(WORDS_KEY, words);
}

export function loadResults(): PracticeResult[] {
  return read<PracticeResult[]>(RESULTS_KEY, []);
}

export function saveResults(results: PracticeResult[]): void {
  write(RESULTS_KEY, results);
}

/** Normalise a Dutch word for duplicate comparison. */
export function normalize(word: string): string {
  return word.trim().toLowerCase();
}

export function findDuplicate(words: Word[], dutch: string): Word | undefined {
  const n = normalize(dutch);
  return words.find((w) => normalize(w.dutch) === n);
}

/** User-supplied Anthropic API key (optional; enables real translations). */
export function loadApiKey(): string {
  return read<string>(APIKEY_KEY, "");
}

export function saveApiKey(key: string): void {
  write(APIKEY_KEY, key.trim());
}
