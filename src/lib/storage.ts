import type { DeckItem, PracticeResult } from "./types";

const DECK_KEY = "woordkast.deck";
const RESULTS_KEY = "woordkast.results";

/** A freshly-added deck item: no spaced-repetition history yet, due immediately. */
export function newDeckItem(entryId: string, now: Date): DeckItem {
  return {
    id: entryId,
    dateAdded: now.getTime(),
    interval: 0,
    ease: 2.5,
    reps: 0,
    dueDate: now.toISOString(),
    lapses: 0,
    state: "new",
    lastReviewedAt: null,
  };
}

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

/** The user's flashcard deck, newest first. */
export function loadDeck(): DeckItem[] {
  return read<DeckItem[]>(DECK_KEY, []).sort((a, b) => b.dateAdded - a.dateAdded);
}

export function saveDeck(deck: DeckItem[]): void {
  write(DECK_KEY, deck);
}

export function isInDeck(deck: DeckItem[], entryId: string): boolean {
  return deck.some((d) => d.id === entryId);
}

export function loadResults(): PracticeResult[] {
  return read<PracticeResult[]>(RESULTS_KEY, []);
}

export function saveResults(results: PracticeResult[]): void {
  write(RESULTS_KEY, results);
}
