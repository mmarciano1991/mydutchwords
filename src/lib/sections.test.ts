import { describe, expect, it } from "vitest";
import {
  dayKey,
  firstSectionNewCap,
  gradeWord,
  newWord,
  reviewsDueBy,
  selectSessionWords,
  type Word,
} from "./learningEngine";
import { MAX_NEW_WORDS_PER_SESSION } from "./learningConfig";

/* Sections vs learning days.
   A learner may keep going in full sections on the same day; that must add
   words, never days: one graded answer per word per day, schedules that
   only move with real elapsed time, no skipped reviews. */

const START = new Date(2026, 0, 5, 9, 0, 0, 0);
function at(dayN: number, hour = 9, minute = 0): Date {
  const d = new Date(START);
  d.setDate(d.getDate() + dayN);
  d.setHours(hour, minute, 0, 0);
  return d;
}
function midnightOf(dayN: number): string {
  const d = at(dayN);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

type W = Word & { dateAdded: number };
const deckOfNew = (n: number): W[] =>
  Array.from({ length: n }, (_, i) => ({ ...newWord(`w${i}`, at(-1)), dateAdded: i }));

/** Answers every word in `ids` with a correct graded Multiple Choice (or a
 *  miss for ids in `miss`). Returns the deck and how many answers graded. */
function answerSection(deck: W[], ids: string[], now: Date, miss = new Set<string>()) {
  let graded = 0;
  const set = new Set(ids);
  const next = deck.map((w) => {
    if (!set.has(w.id)) return w;
    const out = gradeWord(w, { exerciseType: "multiple_choice", result: miss.has(w.id) ? "wrong" : "correct" }, now);
    if (out.graded) graded++;
    return { ...out.word, dateAdded: w.dateAdded };
  });
  return { deck: next, graded };
}

describe("sections within one learning day", () => {
  it("serves full follow-on sections from a 200-word deck instead of 5-word scraps", () => {
    let deck = deckOfNew(200);
    const sizes: number[] = [];
    for (let s = 0; s < 4; s++) {
      const words = selectSessionWords(deck, at(0, 9, s * 20), { size: 30 });
      sizes.push(words.length);
      deck = answerSection(deck, words.map((w) => w.id), at(0, 9, s * 20 + 10)).deck;
    }
    // First section: 10% of the 200 waiting = 20; every section after it is full.
    expect(sizes).toEqual([20, 30, 30, 30]);
  });

  it("the first section's new words scale with the backlog waiting", () => {
    const first = (n: number, size: number) => selectSessionWords(deckOfNew(n), at(0), { size }).length;
    expect(first(20, 30)).toBe(MAX_NEW_WORDS_PER_SESSION); // small deck: floor of 5
    expect(first(49, 30)).toBe(MAX_NEW_WORDS_PER_SESSION);
    expect(first(100, 30)).toBe(10);
    expect(first(200, 30)).toBe(20);
    expect(first(200, 10)).toBe(10); // never more than the section
    expect(first(3, 30)).toBe(3); // never more than exist
  });

  it("firstSectionNewCap is bounded by the floor and the section size", () => {
    expect(firstSectionNewCap(0, 20)).toBe(MAX_NEW_WORDS_PER_SESSION);
    expect(firstSectionNewCap(150, 20)).toBe(15);
    expect(firstSectionNewCap(500, 20)).toBe(20);
    expect(firstSectionNewCap(500, 3)).toBe(3);
  });

  it("the cap shrinks as the backlog is learned", () => {
    let deck = deckOfNew(120);
    const firsts: number[] = [];
    for (let d = 0; d < 4; d++) {
      const words = selectSessionWords(deck, at(d), { size: 30 });
      firsts.push(words.filter((w) => w.state === "new").length);
      deck = answerSection(deck, words.map((w) => w.id), at(d, 9, 30)).deck;
    }
    // 120 waiting → 12; 108 → 11; 97 → 10; 87 → 9 allowed, but on day 4
    // 22 due reviews fill the 30-word section first, leaving room for 8.
    expect(firsts).toEqual([12, 11, 10, 8]);
  });

  it("follow-on sections still put due reviews before New words", () => {
    let deck = deckOfNew(50);
    // A Learning word due today, and a missed one.
    const learning = (id: string, lastResult: Word["lastResult"]): W => ({
      ...newWord(id, at(-5)),
      state: "learning",
      interval: 1,
      evidenceTier: 1,
      dueDate: midnightOf(0),
      lastReviewedAt: at(-1).toISOString(),
      lastGradedDay: dayKey(at(-1)),
      lastResult,
      dateAdded: -1,
    });
    // Section 1 grades five new words; the reviews are added afterwards to
    // simulate them syncing in from another device mid-day.
    const first = selectSessionWords(deck, at(0), { size: 10 });
    deck = answerSection(deck, first.map((w) => w.id), at(0, 9, 5)).deck;
    deck = [...deck, learning("due", "correct"), learning("missed", "wrong")];
    const second = selectSessionWords(deck, at(0, 10), { size: 10 });
    expect(second.slice(0, 2).map((w) => w.id)).toEqual(["missed", "due"]);
    expect(second).toHaveLength(10);
  });

  it("never grades a word twice in one day, however many sections", () => {
    let deck = deckOfNew(120);
    const gradedIds: string[] = [];
    for (let s = 0; s < 5; s++) {
      const words = selectSessionWords(deck, at(0, 10 + s), { size: 30 });
      gradedIds.push(...words.map((w) => w.id));
      deck = answerSection(deck, words.map((w) => w.id), at(0, 10 + s, 30)).deck;
    }
    expect(new Set(gradedIds).size).toBe(gradedIds.length);
    // Forcing a second answer on a word graded today changes nothing.
    const again = answerSection(deck, [gradedIds[0]], at(0, 20));
    expect(again.graded).toBe(0);
    expect(again.deck.find((w) => w.id === gradedIds[0])).toEqual(deck.find((w) => w.id === gradedIds[0]));
  });

  it("a word met in section 4 is scheduled exactly like one met in section 1", () => {
    let deck = deckOfNew(120);
    const sections: string[][] = [];
    for (let s = 0; s < 4; s++) {
      const words = selectSessionWords(deck, at(0, 9 + s * 2), { size: 30 });
      sections.push(words.map((w) => w.id));
      deck = answerSection(deck, words.map((w) => w.id), at(0, 9 + s * 2, 30)).deck;
    }
    const pick = (id: string) => {
      const w = deck.find((d) => d.id === id)!;
      return { state: w.state, interval: w.interval, dueDate: w.dueDate, successfulReviewDays: w.successfulReviewDays };
    };
    const early = pick(sections[0][0]);
    const late = pick(sections[3][0]);
    expect(late).toEqual(early);
    expect(early).toEqual({ state: "learning", interval: 1, dueDate: midnightOf(1), successfulReviewDays: 1 });
  });

  it("extra sections don't advance the schedule: next day matches a one-section day", () => {
    // Two learners with the same word: A did 4 sections, B did 1.
    let a = deckOfNew(120);
    for (let s = 0; s < 4; s++) {
      const words = selectSessionWords(a, at(0, 9 + s), { size: 30 });
      a = answerSection(a, words.map((w) => w.id), at(0, 9 + s, 30)).deck;
    }
    let b = deckOfNew(120);
    const bWords = selectSessionWords(b, at(0), { size: 30 });
    b = answerSection(b, bWords.map((w) => w.id), at(0, 9, 30)).deck;

    // Next day, both answer w0 correctly.
    const next = (deck: W[]) => answerSection(deck, ["w0"], at(1)).deck.find((w) => w.id === "w0")!;
    const wa = next(a);
    const wb = next(b);
    expect(wa.interval).toBe(wb.interval);
    expect(wa.dueDate).toBe(wb.dueDate);
    expect(wa.successfulReviewDays).toBe(2);
  });

  it("the next day starts with yesterday's words due, misses first — none skipped", () => {
    let deck = deckOfNew(100);
    const met: string[] = [];
    let missed = "";
    for (let s = 0; s < 3; s++) {
      const words = selectSessionWords(deck, at(0, 9 + s), { size: 30 });
      met.push(...words.map((w) => w.id));
      if (s === 2) missed = words[0].id;
      deck = answerSection(deck, words.map((w) => w.id), at(0, 9 + s, 30), new Set([missed].filter(Boolean))).deck;
    }
    // Day 1: a big enough session asks every word met yesterday.
    const day1 = selectSessionWords(deck, at(1), { size: 200, maxNewWords: 0 });
    expect(day1[0].id).toBe(missed);
    expect(new Set(day1.map((w) => w.id))).toEqual(new Set(met));
  });

  it("resumes on real elapsed time after days away", () => {
    let deck = deckOfNew(60);
    for (let s = 0; s < 2; s++) {
      const words = selectSessionWords(deck, at(0, 9 + s), { size: 30 });
      deck = answerSection(deck, words.map((w) => w.id), at(0, 9 + s, 30)).deck;
    }
    // Back after 4 days: elapsed 4 × recognition 1.4 = 5.6 → 6 days.
    const w = answerSection(deck, ["w0"], at(4)).deck.find((d) => d.id === "w0")!;
    expect(w.interval).toBe(6);
    expect(w.dueDate).toBe(midnightOf(10));
  });
});

describe("reviewsDueBy", () => {
  it("counts tomorrow's reviews, including words introduced today", () => {
    let deck = deckOfNew(60);
    expect(reviewsDueBy(deck, at(0))).toBe(0);
    for (let s = 0; s < 2; s++) {
      const words = selectSessionWords(deck, at(0, 9 + s), { size: 20 });
      deck = answerSection(deck, words.map((w) => w.id), at(0, 9 + s, 30)).deck;
    }
    // 6 (first section: 10% of 60) + 20 (follow-on) words, all due tomorrow.
    expect(reviewsDueBy(deck, at(0, 20))).toBe(26);
  });
});
