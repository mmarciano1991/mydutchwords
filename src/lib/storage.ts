import type { PracticeRun } from "./dailySet";
import { normalizeHabit, type HabitState } from "./habit";
import { ENGINE_VERSION, LADDER, levelFromInterval, MAX_LEVEL, migrateWords, newWord, type StoredWord } from "./learningEngine";
import type { DeckItem, PracticeResult } from "./types";

const DECK_KEY = "woordkast.deck";
const RESULTS_KEY = "woordkast.results";
const RUN_KEY = "woordkast.practiceRun";
const HABIT_KEY = "woordkast.habit";
/** The deck exactly as it was before the learning-engine v2 migration,
 *  written once, never overwritten. The local half of the rollback (see
 *  LEARNING_ENGINE_PLAN.md, "Rollback"). */
const DECK_BACKUP_KEY = "woordkast.deck.v1-backup";

/** A freshly-added deck item: New, never graded, due immediately. */
export function newDeckItem(entryId: string, now: Date): DeckItem {
  return { ...newWord(entryId, now), dateAdded: now.getTime() };
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

type StoredDeckItem = StoredWord & { dateAdded: number };

/** Backfills deck items from shapes older than the ladder:
 *  - plain {id, dateAdded} (pre spaced-repetition) → fresh new card
 *  - ease-based SM-2 items (no level) → level derived from their interval
 *  The result is then migrated to the current engine (migrateWords). */
function migratePreLadder(raw: StoredDeckItem): StoredDeckItem {
  if (raw.engineVersion === ENGINE_VERSION) return raw;
  if (!raw.state || !raw.dueDate) {
    return { ...newDeckItem(raw.id, new Date(raw.dateAdded)), dateAdded: raw.dateAdded };
  }
  if (typeof raw.level === "number") return raw;
  const level = raw.state === "new" ? 0 : Math.min(MAX_LEVEL, levelFromInterval(raw.interval ?? 0));
  return { ...raw, level, interval: raw.state === "new" ? 0 : level > 0 ? LADDER[level - 1] : 1 };
}

/** Any stored deck, brought up to the current engine. Idempotent. */
export function migrateDeck(items: StoredDeckItem[], results: PracticeResult[], now: Date): DeckItem[] {
  return migrateWords(items.map(migratePreLadder), results, now);
}

/** The user's flashcard deck, newest first, migrated to the current engine.
 *  The first time a pre-v2 deck is loaded, it is backed up untouched. */
export function loadDeck(): DeckItem[] {
  const raw = read<StoredDeckItem[]>(DECK_KEY, []);
  if (raw.some((d) => d.engineVersion !== ENGINE_VERSION) && read<unknown>(DECK_BACKUP_KEY, null) === null) {
    write(DECK_BACKUP_KEY, raw);
  }
  return migrateDeck(raw, loadResults(), new Date()).sort((a, b) => b.dateAdded - a.dateAdded);
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
