import type { DailySet, PracticeRun } from "./dailySet";
import { normalizeHabit, type HabitState } from "./habit";
import { intervalForLevel, LADDER, MAX_LEVEL } from "./learningEngine";
import type { DeckItem, PracticeResult } from "./types";

const DECK_KEY = "woordkast.deck";
const RESULTS_KEY = "woordkast.results";
const DAILY_SET_KEY = "woordkast.dailySet";
const RUN_KEY = "woordkast.practiceRun";
const HABIT_KEY = "woordkast.habit";

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

/** Falls back on unreadable or corrupt data — a bad entry shouldn't stop the
 *  app booting — but says so, since silently starting from scratch looks
 *  identical to losing the user's deck. */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (err) {
    console.warn(`[woordkast] could not read "${key}" — using defaults`, err);
    return fallback;
  }
}

/** Writes fail on a full quota or in private mode. Nothing here can recover,
 *  but the failure is logged rather than swallowed: without it, progress
 *  stops persisting with no signal anywhere. */
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[woordkast] could not save "${key}" — changes stay in memory`, err);
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

/** Today's draw, if one has been made and saved. Null before the first
 *  practice day, or when the saved value is from an older schema. */
export function loadDailySet(): DailySet | null {
  const raw = read<DailySet | null>(DAILY_SET_KEY, null);
  if (!raw || typeof raw.date !== "string" || !Array.isArray(raw.wordIds)) return null;
  return raw;
}

export function saveDailySet(set: DailySet | null): void {
  write(DAILY_SET_KEY, set);
}

/** The current (or last) run through a set of words. Null before the first
 *  practice, or when the saved value is from an older schema. */
export function loadRun(): PracticeRun | null {
  const raw = read<PracticeRun | null>(RUN_KEY, null);
  if (!raw || typeof raw.date !== "string" || !Array.isArray(raw.wordIds)) return null;
  // `answers` was added with the run itself; guard anyway so a hand-edited or
  // partially-written value degrades to "nothing answered" rather than
  // throwing on every render.
  return { ...raw, answers: raw.answers && typeof raw.answers === "object" ? raw.answers : {} };
}

export function saveRun(run: PracticeRun | null): void {
  write(RUN_KEY, run);
}

/** The user's daily commitment and its history. Null until onboarding has
 *  been completed (on this device, or synced from another). */
export function loadHabit(): HabitState | null {
  return normalizeHabit(read<unknown>(HABIT_KEY, null));
}

export function saveHabit(habit: HabitState | null): void {
  write(HABIT_KEY, habit);
}
