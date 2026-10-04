/* useAppState — the learner's persistent progress: deck, practice log, the
   day's set, the current run and the habit. Each piece is read from local
   storage once and written back whenever it changes; this is also the shape
   the cloud sync merges and pushes. */
import { useCallback, useEffect, useState } from "react";
import type { DeckItem, PracticeResult } from "./types";
import type { AppState } from "./cloudState";
import { buildDailySet, dayKey, type DailySet, type PracticeRun } from "./dailySet";
import { commitmentOf, type HabitState } from "./habit";
import {
  loadDailySet,
  loadDeck,
  loadHabit,
  loadResults,
  loadRun,
  saveDailySet,
  saveDeck,
  saveHabit,
  saveResults,
  saveRun,
} from "./storage";

/** Daily set size for a habit — the commitment, or the smallest one before
 *  onboarding has happened. */
export function setSizeFor(habit: HabitState | null): number {
  return commitmentOf(habit?.commitment ?? "espresso").words;
}

export function useAppState() {
  const [deck, setDeck] = useState<DeckItem[]>(() => loadDeck());
  const [results, setResults] = useState<PracticeResult[]>(() => loadResults());
  // The daily commitment, cue, weekly target and days done. Null until the
  // user has been through onboarding (here or on another device).
  const [habit, setHabit] = useState<HabitState | null>(() => loadHabit());
  // The day's drawn batch of words. Persisted and synced, because half a set
  // done on the phone has to still be half a set done on the laptop.
  // Drawn during the very first render, not in an effect: an effect would
  // paint one frame with no set at all, which reads as the caught-up card
  // before flipping to the real one. `deck` is already initialised above.
  const [dailySet, setDailySet] = useState<DailySet | null>(() => {
    const saved = loadDailySet();
    const today = dayKey(new Date());
    if (saved && saved.date === today && saved.wordIds.length > 0) return saved;
    return buildDailySet(deck, new Date(), setSizeFor(habit));
  });
  // What the user actually did, in their current or most recent sitting.
  const [run, setRun] = useState<PracticeRun | null>(() => loadRun());

  useEffect(() => saveDeck(deck), [deck]);
  useEffect(() => saveResults(results), [results]);
  useEffect(() => saveDailySet(dailySet), [dailySet]);
  useEffect(() => saveRun(run), [run]);
  useEffect(() => saveHabit(habit), [habit]);

  /** Replaces everything with a merged snapshot (custom words are the sync
   *  hook's to set). */
  const applyMerged = useCallback((state: AppState) => {
    setDeck(state.deck);
    setResults(state.results);
    setDailySet(state.dailySet);
    setRun(state.run);
    setHabit(state.habit ?? null);
  }, []);

  /** Back to a blank slate, so the next account doesn't inherit this one. */
  const reset = useCallback(() => {
    setDeck([]);
    setResults([]);
    setDailySet(null);
    setRun(null);
    setHabit(null);
  }, []);

  return {
    deck,
    setDeck,
    results,
    setResults,
    habit,
    setHabit,
    dailySet,
    setDailySet,
    run,
    setRun,
    applyMerged,
    reset,
  };
}
