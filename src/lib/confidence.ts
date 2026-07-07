import type { ConfidenceLevel, PracticeResult } from "./types";

/* Word confidence (US-38).
   Confidence is driven solely by successful recalls — any grade other than
   "dontKnow". At MASTERED_RECALLS the word is mastered and is excluded from
   future flashcard sessions. */

export const MASTERED_RECALLS = 15;

/** Successful-recall thresholds (inclusive lower bound) per level. */
const LEVELS: { min: number; level: ConfidenceLevel }[] = [
  { min: 15, level: "mastered" },
  { min: 10, level: "mastering" },
  { min: 5, level: "medium" },
  { min: 0, level: "weak" },
];

/** Tally successful recalls per dictionary-entry id across all results. */
export function recallCounts(results: PracticeResult[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of results) {
    if (r.grade !== "dontKnow") counts.set(r.entryId, (counts.get(r.entryId) ?? 0) + 1);
  }
  return counts;
}

/** Confidence level for a given number of successful recalls. */
export function confidenceLevel(recalls: number): ConfidenceLevel {
  return (LEVELS.find((l) => recalls >= l.min) ?? LEVELS[LEVELS.length - 1]).level;
}

export function isMastered(recalls: number): boolean {
  return recalls >= MASTERED_RECALLS;
}

/** Progress toward mastery, clamped to 0–1 (recalls / MASTERED_RECALLS). */
export function masteryProgress(recalls: number): number {
  return Math.max(0, Math.min(1, recalls / MASTERED_RECALLS));
}
