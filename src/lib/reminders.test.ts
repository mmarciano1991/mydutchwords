import { describe, expect, it } from "vitest";
import { nextReminderAt } from "./reminders";
import { newHabit, type HabitState } from "./habit";

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
const habit = (over: Partial<HabitState> = {}): HabitState => ({
  ...newHabit({ commitment: "espresso", time: "08:00" }, at(5, 7)),
  reminders: true,
  ...over,
});
const open = { done: false, eligible: true, hasWords: true };

describe("nextReminderAt", () => {
  it("is today at the chosen time while today still has a session to do", () => {
    expect(nextReminderAt(habit(), at(5, 7), open)).toEqual(at(5, 8));
  });

  it("moves to tomorrow once the time has passed", () => {
    expect(nextReminderAt(habit(), at(5, 9), open)).toEqual(at(6, 8));
  });

  it("cancels today's reminder once a full session is done", () => {
    expect(nextReminderAt(habit(), at(5, 7), { ...open, done: true })).toEqual(at(6, 8));
  });

  it("skips today when nothing is eligible to practise", () => {
    expect(nextReminderAt(habit(), at(5, 7), { ...open, eligible: false })).toEqual(at(6, 8));
  });

  it("is off until set, and never with an empty deck", () => {
    expect(nextReminderAt(habit({ reminders: false }), at(5, 7), open)).toBeNull();
    expect(nextReminderAt(habit(), at(5, 7), { ...open, hasWords: false })).toBeNull();
  });
});
