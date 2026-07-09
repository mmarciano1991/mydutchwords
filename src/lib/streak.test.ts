import { describe, expect, it } from "vitest";
import { streakDays } from "./streak";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2024, 5, 10, 18, 0, 0); // local 10 June 2024, 18:00

function onDay(offset: number, hour = 12): { timestamp: number } {
  const d = new Date(2024, 5, 10 + offset, hour);
  return { timestamp: d.getTime() };
}

describe("streakDays", () => {
  it("is 0 with no results", () => {
    expect(streakDays([], NOW)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    expect(streakDays([onDay(0), onDay(-1), onDay(-2)], NOW)).toBe(3);
  });

  it("keeps the streak alive if today hasn't been practiced yet", () => {
    expect(streakDays([onDay(-1), onDay(-2)], NOW)).toBe(2);
  });

  it("breaks on a missed day", () => {
    expect(streakDays([onDay(0), onDay(-2), onDay(-3)], NOW)).toBe(1);
    expect(streakDays([onDay(-2), onDay(-3)], NOW)).toBe(0);
  });

  it("multiple sessions on one day count once", () => {
    expect(streakDays([onDay(0, 9), onDay(0, 21), onDay(-1)], NOW)).toBe(2);
  });

  it("handles month boundaries", () => {
    const start = new Date(2024, 6, 1, 10); // 1 July
    const results = [
      { timestamp: start.getTime() },
      { timestamp: start.getTime() - DAY }, // 30 June
      { timestamp: start.getTime() - 2 * DAY }, // 29 June
    ];
    expect(streakDays(results, new Date(2024, 6, 1, 18))).toBe(3);
  });
});
