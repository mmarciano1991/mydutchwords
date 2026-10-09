import { describe, expect, it } from "vitest";
import {
  backfillDoneDays,
  cueLine,
  currentStreak,
  daysBetween,
  isReturning,
  mergeHabit,
  newHabit,
  normalizeHabit,
  reflectionDue,
  sessionSizeFor,
  todayProgress,
  tomorrowAt,
  weekProgress,
  wordsPractisedOn,
  type HabitState,
} from "./habit";
import { dayKey } from "./dailySet";

// Monday 5 October 2026 … Sunday 11 October 2026.
const at = (day: number, hour = 10) => new Date(2026, 9, day, hour);

function habit(over: Partial<HabitState> = {}): HabitState {
  return { ...newHabit({ commitment: "espresso", time: "08:00" }, at(1)), ...over };
}

describe("session size", () => {
  it("is the commitment's word count", () => {
    expect(sessionSizeFor(habit(), "2026-10-05")).toBe(10);
    expect(sessionSizeFor(habit({ commitment: "ontbijt" }), "2026-10-05")).toBe(20);
    expect(sessionSizeFor(habit({ commitment: "diner" }), "2026-10-05")).toBe(30);
  });

  it("defaults to the smallest before onboarding", () => {
    expect(sessionSizeFor(null, "2026-10-05")).toBe(10);
  });

  it("shrinks to the warm-up on a return day", () => {
    const h = habit({ commitment: "diner", welcomedOn: "2026-10-05" });
    expect(sessionSizeFor(h, "2026-10-05")).toBe(5);
    // …and only on that day.
    expect(sessionSizeFor(h, "2026-10-06")).toBe(30);
  });

  it("splits practice into goal and extra, and extra never changes the goal", () => {
    const p = todayProgress(5, 15, false);
    expect(p).toMatchObject({ goal: 5, towardGoal: 5, extra: 10, done: true });
  });

  it("keeps a recorded day done even if the goal is raised later", () => {
    expect(todayProgress(20, 5, true).done).toBe(true);
    expect(todayProgress(20, 5, false).done).toBe(false);
  });

  it("counts distinct words per day, a repeat once", () => {
    const t = at(5).getTime();
    const results = [
      { entryId: "a", timestamp: t },
      { entryId: "a", timestamp: t + 1 },
      { entryId: "b", timestamp: t + 2 },
      { entryId: "c", timestamp: at(4).getTime() },
    ];
    expect(wordsPractisedOn(results, "2026-10-05").sort()).toEqual(["a", "b"]);
  });
});

describe("weekly consistency", () => {
  it("runs Monday to Sunday and marks only done days", () => {
    const w = weekProgress(["2026-10-05", "2026-10-07"], 4, at(8));
    expect(w.days.map((d) => d.date)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
    expect(w.days.map((d) => d.done)).toEqual([true, false, true, false, false, false, false]);
    expect(w.count).toBe("2 of 4 days");
  });

  it("is on track with a missed day already behind it", () => {
    // Done Mon + Wed, missed Tue, it's Thursday: still on track for 4.
    const w = weekProgress(["2026-10-05", "2026-10-07"], 4, at(8));
    expect(w.tone).toBe("on-track");
    expect(w.status).toBe("✓ on track");
  });

  it("reads 4 of 7 days as a complete week", () => {
    const w = weekProgress(["2026-10-05", "2026-10-06", "2026-10-08", "2026-10-10"], 4, at(11));
    expect(w.tone).toBe("complete");
    expect(w.status).toBe("✓ week done");
  });

  it("never phrases a short week as a deficit", () => {
    const w = weekProgress([], 4, at(11));
    expect(w.status).not.toMatch(/miss|lost|broke|behind|only/i);
    expect(w.status).toBe("a fresh week");
  });

  it("ignores days from other weeks", () => {
    expect(weekProgress(["2026-10-04", "2026-10-12"], 4, at(8)).done).toBe(0);
  });
});

describe("streak", () => {
  it("counts consecutive done days ending today", () => {
    expect(currentStreak(["2026-10-06", "2026-10-07", "2026-10-08"], at(8))).toBe(3);
  });

  it("keeps yesterday's run while today is still open", () => {
    expect(currentStreak(["2026-10-06", "2026-10-07"], at(8))).toBe(2);
  });

  it("stops at a gap", () => {
    expect(currentStreak(["2026-10-05", "2026-10-07", "2026-10-08"], at(8))).toBe(2);
    expect(currentStreak(["2026-10-05"], at(8))).toBe(0);
  });
});

describe("returning", () => {
  const log = (day: number) => [{ timestamp: at(day).getTime() }];

  it("is a return after three or more days away", () => {
    expect(isReturning(habit(), log(5), at(8))).toBe(true);
    expect(isReturning(habit(), log(6), at(8))).toBe(false);
  });

  it("is not a return for someone who has never practised", () => {
    expect(isReturning(habit(), [], at(8))).toBe(false);
  });

  it("is welcomed once per day", () => {
    expect(isReturning(habit({ welcomedOn: "2026-10-08" }), log(1), at(8))).toBe(false);
  });
});

describe("reflection timing", () => {
  it("is due 30 days after setup, then 30 days after the last one", () => {
    const h = habit({ startedAt: "2026-09-05" });
    expect(reflectionDue(h, at(4))).toBe(false);
    expect(reflectionDue(h, at(5))).toBe(true);
    expect(reflectionDue({ ...h, lastReflection: "2026-10-05" }, at(11))).toBe(false);
  });
});

describe("stored habits", () => {
  it("gives a habit from before the time picker its routine's time", () => {
    const { time: _t, ...rest } = habit();
    expect(normalizeHabit({ ...rest, anchor: "bed" })).toMatchObject({ time: "21:30" });
    expect(normalizeHabit({ ...rest, anchor: "commute" })).not.toHaveProperty("anchor");
  });

  it("keeps a valid time and replaces a malformed one", () => {
    expect(normalizeHabit(habit({ time: "06:05" }))?.time).toBe("06:05");
    expect(normalizeHabit(habit({ time: "25:00" }))?.time).toBe("08:00");
  });

  it("is null for anything that isn't a habit", () => {
    expect(normalizeHabit(null)).toBeNull();
    expect(normalizeHabit({ time: "08:00" })).toBeNull();
  });
});

describe("merging two devices", () => {
  it("takes preferences from the newer change and keeps both histories", () => {
    const a = habit({ commitment: "espresso", doneDays: ["2026-10-05"], updatedAt: 1 });
    const b = habit({ commitment: "diner", doneDays: ["2026-10-06"], updatedAt: 2, lastReflection: "2026-10-01" });
    const m = mergeHabit(a, b)!;
    expect(m.commitment).toBe("diner");
    expect(m.doneDays).toEqual(["2026-10-05", "2026-10-06"]);
    expect(m.lastReflection).toBe("2026-10-01");
  });
});

describe("backfill for existing users", () => {
  it("credits past days that already met the goal", () => {
    const day = (d: number, ids: string[]) => ids.map((entryId, i) => ({ entryId, timestamp: at(d).getTime() + i }));
    const results = [...day(5, ["a", "b", "c", "d", "e"]), ...day(6, ["a", "b"])];
    expect(backfillDoneDays(results, 5)).toEqual(["2026-10-05"]);
  });
});

it("daysBetween counts calendar days across DST", () => {
  // Europe/Amsterdam leaves DST on 25 Oct 2026.
  expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  expect(daysBetween(dayKey(at(5)), dayKey(at(11)))).toBe(6);
});

describe("cue copy", () => {
  it("names the time chosen in onboarding", () => {
    expect(cueLine(habit({ time: "21:30" }))).toBe("🌙 Your Dutch at 21:30");
    expect(tomorrowAt(habit({ time: "08:00" }))).toBe(" at 08:00");
    expect(tomorrowAt(null)).toBe("");
  });
});
