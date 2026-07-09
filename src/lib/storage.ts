import { intervalForLevel, LADDER, MAX_LEVEL } from "./learningEngine";
import type { DeckItem, PracticeResult } from "./types";

const DECK_KEY = "woordkast.deck";
const RESULTS_KEY = "woordkast.results";

/** A freshly-added deck item: no spaced-repetition history yet, due immediately. */
export function newDeckItem(entryId: string, now: Date): DeckItem {
  return {
    id: entryId,
    dateAdded: now.getTime(),
    level: 0,
    interval: 0,
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

/** Nearest ladder level at or below a stored interval (for migrating decks
 *  saved by the previous ease-based scheduler, which had no level field). */
function levelFromInterval(interval: number): number {
  for (let i = LADDER.length - 1; i >= 0; i--) {
    if (interval >= LADDER[i]) return i + 1;
  }
  return 0;
}

/** Backfills deck items from older storage shapes:
 *  - plain {id, dateAdded} (pre spaced-repetition) → fresh new card
 *  - ease-based SM-2 items (no level) → level derived from their interval */
function migrateDeckItem(raw: DeckItem): DeckItem {
  if (!raw.state || !raw.dueDate) {
    return { ...newDeckItem(raw.id, new Date(raw.dateAdded)), dateAdded: raw.dateAdded };
  }
  if (typeof raw.level === "number") return raw;
  const level = raw.state === "new" ? 0 : Math.min(MAX_LEVEL, levelFromInterval(raw.interval));
  return { ...raw, level, interval: raw.state === "new" ? 0 : intervalForLevel(level) };
}

/** The user's flashcard deck, newest first. */
export function loadDeck(): DeckItem[] {
  return read<DeckItem[]>(DECK_KEY, [])
    .map(migrateDeckItem)
    .sort((a, b) => b.dateAdded - a.dateAdded);
}

export function saveDeck(deck: DeckItem[]): void {
  write(DECK_KEY, deck);
}

export function isInDeck(deck: DeckItem[], entryId: string): boolean {
  return deck.some((d) => d.id === entryId);
}

export function loadResults(): PracticeResult[] {
  // Older results used the 3-grade scale ("easy"/"hard"); both were successes.
  return read<PracticeResult[]>(RESULTS_KEY, []).map((r) =>
    r.grade === "dontKnow" ? r : { ...r, grade: "know" as const }
  );
}

export function saveResults(results: PracticeResult[]): void {
  write(RESULTS_KEY, results);
}
