/* habit — the daily-commitment model: how much Dutch a day asks for, what
   cue it hangs off, and how a week of it is read back.

   The principle every rule here serves: make the day small and predictable
   enough that doing it is easier than skipping it.

   - A day is DONE once one full session has been completed (every word in
     it answered), counted on the local day the session was finished. More
     sessions that day add nothing to the streak or the week, and never
     raise tomorrow's size — that is a setting.
   - Consistency is read primarily per WEEK (N of a target number of days).
     A missed day is simply an empty dot. The dashboard also shows a run of
     consecutive done days (currentStreak), which is kept alive through
     today until today is over.
   - Completed days are RECORDED (doneDays) rather than re-derived from the
     log against the current goal, so changing the commitment later never
     rewrites history: a day done as Espresso stays done after switching to
     Diner.

   Pure and synchronous: no storage, no clock of its own. */
import { dayKey } from "./dailySet";

export type Commitment = "espresso" | "ontbijt" | "diner";

export interface CommitmentOption {
  id: Commitment;
  name: string;
  words: number;
  minutes: number;
}

export const COMMITMENTS: CommitmentOption[] = [
  { id: "espresso", name: "Espresso", words: 10, minutes: 5 },
  { id: "ontbijt", name: "Ontbijt", words: 20, minutes: 10 },
  { id: "diner", name: "Diner", words: 30, minutes: 15 },
];

/** "HH:MM", 24-hour, local time. */
export type HabitTime = string;

/** Onboarding's pre-selected time — early enough to fit before the day
 *  gets busy, and easy to change. */
export const DEFAULT_HABIT_TIME: HabitTime = "08:00";

interface DayPart {
  /** First hour of this part of the day. */
  from: number;
  emoji: string;
  /** Reminder headline — a greeting for that part of the day. */
  nudge: string;
}

/** The time's part of the day sets the emoji and the reminder's greeting;
 *  the copy itself always names the time. Night counts as evening. */
const DAY_PARTS: DayPart[] = [
  { from: 5, emoji: "☀️", nudge: "Good morning!" },
  { from: 12, emoji: "🌤", nudge: "Time for a break?" },
  { from: 18, emoji: "🌙", nudge: "Good evening!" },
];

/** The routine-based times habits were set up with before the time picker,
 *  so a stored or synced habit from then keeps its reminder time. */
const LEGACY_ANCHOR_TIMES: Record<string, HabitTime> = {
  coffee: "08:00",
  commute: "08:15",
  lunch: "12:30",
  bed: "21:30",
};

export function isHabitTime(value: unknown): value is HabitTime {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** [hour, minute] of a habit time. */
export function timeParts(time: HabitTime): [number, number] {
  const [h, m] = time.split(":").map(Number);
  return [h, m];
}

function dayPartOf(time: HabitTime): DayPart {
  const [h] = timeParts(time);
  if (h < DAY_PARTS[0].from) return DAY_PARTS[DAY_PARTS.length - 1];
  return [...DAY_PARTS].reverse().find((p) => h >= p.from)!;
}

export function timeEmoji(time: HabitTime): string {
  return dayPartOf(time).emoji;
}

export function timeNudge(time: HabitTime): string {
  return dayPartOf(time).nudge;
}

/** Default days-per-week target. Deliberately below 7, so a missed day or
 *  two is already built into "on track". */
export const DEFAULT_WEEKLY_TARGET = 4;
export const WEEKLY_TARGET_OPTIONS = [3, 4, 5, 6, 7] as const;

/** The size of the welcome-back warm-up — and, on that day only, of the
 *  goal, so coming back is finished in one small step. */
export const RETURN_WARMUP_WORDS = 5;

/** Days without practice after which an open is treated as a return. */
export const RETURN_GAP_DAYS = 3;

/** Days between "then vs now" reflections. */
export const REFLECTION_INTERVAL_DAYS = 30;

export interface HabitState {
  commitment: Commitment;
  /** When the user means to do their Dutch — the cue, and the reminder time. */
  time: HabitTime;
  weeklyTarget: number;
  /** Opt-in: the user turned on the reminder at their habit time. */
  reminders: boolean;
  /** "Audio exercises": when off, Listening is never selected. On by
   *  default; habits saved before it existed read as on. */
  audioExercises: boolean;
  /** Day the habit was set up (YYYY-MM-DD). Reflection timing counts from here. */
  startedAt: string;
  /** Every day the goal was reached. Append-only; unioned across devices. */
  doneDays: string[];
  /** Last day the monthly reflection was shown, or null. */
  lastReflection: string | null;
  /** Day the welcome-back popup was last shown — also what makes that day a
   *  return day with the smaller goal. */
  welcomedOn: string | null;
  /** When the preferences (commitment/time/target/reminders/audio) last changed.
   *  The tie-break for merging two devices' preferences. */
  updatedAt: number;
}

export function commitmentOf(id: Commitment): CommitmentOption {
  return COMMITMENTS.find((c) => c.id === id) ?? COMMITMENTS[0];
}

/** A stored or synced habit, made current: null if it isn't one, and a
 *  routine-based habit from before the time picker gets that routine's time. */
export function normalizeHabit(raw: unknown): HabitState | null {
  if (!raw || typeof raw !== "object") return null;
  const h = raw as Partial<HabitState> & { anchor?: unknown };
  if (typeof h.commitment !== "string") return null;
  const time = isHabitTime(h.time)
    ? h.time
    : (typeof h.anchor === "string" && LEGACY_ANCHOR_TIMES[h.anchor]) || DEFAULT_HABIT_TIME;
  const { anchor: _legacy, ...rest } = h;
  return {
    ...(rest as HabitState),
    time,
    doneDays: Array.isArray(h.doneDays) ? h.doneDays : [],
    lastReflection: h.lastReflection ?? null,
    welcomedOn: h.welcomedOn ?? null,
    reminders: Boolean(h.reminders),
    audioExercises: h.audioExercises !== false,
  };
}

export function newHabit(
  choice: { commitment: Commitment; time: HabitTime },
  now: Date
): HabitState {
  return {
    commitment: choice.commitment,
    time: choice.time,
    weeklyTarget: DEFAULT_WEEKLY_TARGET,
    reminders: false,
    audioExercises: true,
    startedAt: dayKey(now),
    doneDays: [],
    lastReflection: null,
    welcomedOn: null,
    updatedAt: now.getTime(),
  };
}

/** Steps a calendar day, not 24h — DST days are 23 or 25 hours long. */
function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setHours(12, 0, 0, 0);
  out.setDate(out.getDate() + days);
  return out;
}

/** Whole calendar days from `from` to `to` (YYYY-MM-DD each). */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** Distinct words graded on the given local day. The log only records
 *  scheduled answers — re-drills are deliberately ungraded — so this counts
 *  real practice, and a word answered twice counts once. */
export function wordsPractisedOn(results: { entryId: string; timestamp: number }[], day: string): string[] {
  const seen = new Set<string>();
  for (const r of results) {
    if (dayKey(new Date(r.timestamp)) === day) seen.add(r.entryId);
  }
  return [...seen];
}

export interface TodayProgress {
  /** Words that make today done. */
  goal: number;
  /** Distinct words practised today. */
  practised: number;
  /** min(practised, goal) — what fills the goal. */
  towardGoal: number;
  /** Past the goal. Never feeds back into tomorrow. */
  extra: number;
  done: boolean;
}

/** Words per session: the commitment's size (10/20/30), except on a return
 *  day, when it is the warm-up, so coming back is one small step. Sessions
 *  hold fewer when fewer words are eligible (see selectSessionWords). */
export function sessionSizeFor(habit: HabitState | null, today: string): number {
  const size = commitmentOf(habit?.commitment ?? "espresso").words;
  return habit?.welcomedOn === today ? Math.min(size, RETURN_WARMUP_WORDS) : size;
}

export function todayProgress(goal: number, practised: number, alreadyDone: boolean): TodayProgress {
  const towardGoal = Math.min(practised, goal);
  return {
    goal,
    practised,
    towardGoal,
    extra: Math.max(0, practised - goal),
    // Once recorded, a day stays done — lowering the goal can complete a
    // day, raising it never un-completes one.
    done: alreadyDone || practised >= goal,
  };
}

export interface WeekDay {
  date: string;
  /** Single-letter label, Monday first. */
  label: string;
  done: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export type WeekTone = "complete" | "on-track" | "open";

export interface WeekProgress {
  days: WeekDay[];
  done: number;
  target: number;
  tone: WeekTone;
  /** "3 of 4 days" */
  count: string;
  /** "✓ on track", "✓ week done", or a warm line — never a deficit. */
  status: string;
}

const LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/** The current Monday–Sunday week. Missed days look exactly like days still
 *  to come: an empty dot. Nothing here counts what wasn't done. */
export function weekProgress(doneDays: string[], target: number, now: Date): WeekProgress {
  const today = dayKey(now);
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = addDays(now, -mondayOffset);
  const doneSet = new Set(doneDays);

  const days: WeekDay[] = LABELS.map((label, i) => {
    const date = dayKey(addDays(monday, i));
    return { date, label, done: doneSet.has(date), isToday: date === today, isFuture: date > today };
  });

  const done = days.filter((d) => d.done).length;
  // Days still available this week, today included if not yet done.
  const left = days.filter((d) => !d.done && (d.isFuture || d.isToday)).length;
  // Pace with slack: a target of 4 asks for ~1 day by Wednesday, not 2.
  const elapsed = mondayOffset + 1;
  const pace = Math.floor((target * elapsed) / 7);

  let tone: WeekTone;
  let status: string;
  if (done >= target) {
    tone = "complete";
    status = "✓ week done";
  } else if (done >= pace && done + left >= target) {
    tone = "on-track";
    status = "✓ on track";
  } else {
    tone = "open";
    // Past the point where the target is reachable, or just a slow start:
    // either way the days done are worth something and nothing is "behind".
    status = done === 0 ? "a fresh week" : "nice going";
  }

  return {
    days,
    done,
    target,
    tone,
    count: `${done} of ${target} days`,
    status,
  };
}

/** Consecutive done days up to today. Today not being done yet does not
 *  break the run — it still counts back from yesterday. */
export function currentStreak(doneDays: string[], now: Date): number {
  const done = new Set(doneDays);
  let offset = done.has(dayKey(now)) ? 0 : -1;
  let streak = 0;
  while (done.has(dayKey(addDays(now, offset)))) {
    streak++;
    offset--;
  }
  return streak;
}

/** The most recent day with any graded answer, or null. */
export function lastPractisedDay(results: { timestamp: number }[]): string | null {
  let latest = -Infinity;
  for (const r of results) if (r.timestamp > latest) latest = r.timestamp;
  return Number.isFinite(latest) ? dayKey(new Date(latest)) : null;
}

/** Whether opening the app now is a return after time away. Says nothing
 *  about how long — that number is never shown. */
export function isReturning(
  habit: HabitState,
  results: { timestamp: number }[],
  now: Date
): boolean {
  const today = dayKey(now);
  if (habit.welcomedOn === today) return false;
  const last = lastPractisedDay(results);
  if (!last) return false;
  return daysBetween(last, today) >= RETURN_GAP_DAYS;
}

/** Whether a "then vs now" reflection is due. */
export function reflectionDue(habit: HabitState, now: Date): boolean {
  const since = habit.lastReflection ?? habit.startedAt;
  return daysBetween(since, dayKey(now)) >= REFLECTION_INTERVAL_DAYS;
}

/** Copy for the home screen's practice card: "🌙 Your Dutch at 21:30". */
/** Copy for the home screen's practice card: "🌙 Your Dutch at 21:30". */
export function cueLine(habit: HabitState): string {
  return `${timeEmoji(habit.time)} Your Dutch at ${habit.time}`;
}

/** Completes "See you tomorrow…": " at 08:00" — the time chosen in
 *  onboarding, the cue the habit hangs off. "" before onboarding. */
export function tomorrowAt(habit: HabitState | null): string {
  return habit ? ` at ${habit.time}` : "";
}

/** The commitment as one sentence: "Every day at 08:00, I learn 5 Dutch words." */
export function planSentence(commitment: Commitment, time: HabitTime): string {
  const c = commitmentOf(commitment);
  return `Every day at ${time}, I learn ${c.words} Dutch words.`;
}

/** Two devices' habit state, merged. Preferences come from whichever changed
 *  them last; history (done days, reflection, welcome) is unioned / maxed so
 *  nothing either device recorded is lost. */
export function mergeHabit(a: HabitState | null, b: HabitState | null): HabitState | null {
  if (!a) return b;
  if (!b) return a;
  const prefs = b.updatedAt > a.updatedAt ? b : a;
  const maxDay = (x: string | null, y: string | null) => (!x ? y : !y ? x : x > y ? x : y);
  return {
    ...prefs,
    startedAt: a.startedAt < b.startedAt ? a.startedAt : b.startedAt,
    doneDays: [...new Set([...a.doneDays, ...b.doneDays])].sort(),
    lastReflection: maxDay(a.lastReflection, b.lastReflection),
    welcomedOn: maxDay(a.welcomedOn, b.welcomedOn),
  };
}

/** Days in the log that already meet `goal` — used once, when an existing
 *  user sets up the habit, so their recent practice shows on the week strip
 *  rather than starting from an empty week. */
export function backfillDoneDays(results: { entryId: string; timestamp: number }[], goal: number): string[] {
  const perDay = new Map<string, Set<string>>();
  for (const r of results) {
    const day = dayKey(new Date(r.timestamp));
    if (!perDay.has(day)) perDay.set(day, new Set());
    perDay.get(day)!.add(r.entryId);
  }
  return [...perDay.entries()]
    .filter(([, ids]) => ids.size >= goal)
    .map(([day]) => day)
    .sort();
}
