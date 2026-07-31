/* Example sentences, loaded on demand.
 *
 * They are ~68% of the dictionary's bytes but are only ever read one word at
 * a time — a flashcard, an expanded deck row, the Add-a-word card — so they
 * live in their own chunk instead of the initial download. Nothing blocks on
 * them: until the chunk arrives, entries simply have no example, which every
 * consumer already renders correctly (that is also the state of the ~118
 * FreeDict words, which have none at all).
 *
 * Keyed by position in DICTIONARY: the file is index-aligned with the first
 * RICH_COUNT entries, so no ids are repeated on the wire.
 */
import { RICH_COUNT } from "./core.generated";

export interface Example {
  example: string;
  exampleEn: string;
}

let lines: string[] | null = null;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** The example for a dictionary position, or undefined if it has none or the
 *  chunk hasn't arrived yet. Synchronous by design — callers stay sync. */
export function exampleAt(index: number | undefined): Example | undefined {
  if (lines === null || index === undefined || index >= RICH_COUNT) return undefined;
  const line = lines[index];
  if (!line) return undefined;
  const tab = line.indexOf("\t");
  return { example: line.slice(0, tab), exampleEn: line.slice(tab + 1) };
}

/** Fetches the chunk (once) and notifies subscribers. Safe to call repeatedly
 *  and from several places at once — concurrent calls share one request. */
export function loadExamples(): Promise<void> {
  if (lines !== null) return Promise.resolve();
  if (pending) return pending;
  pending = import("./examples.generated")
    .then(({ EXAMPLES }) => {
      lines = EXAMPLES.split("\n");
      for (const notify of listeners) notify();
    })
    .catch((err) => {
      // Not fatal: the app works, words just show without their sentence.
      console.warn("[woordkast] example sentences failed to load", err);
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Subscribes to the moment examples become available, so a screen already
 *  showing a word can re-render with its sentence. Returns an unsubscribe. */
export function onExamplesLoaded(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True once the chunk is in memory. */
export function examplesReady(): boolean {
  return lines !== null;
}
