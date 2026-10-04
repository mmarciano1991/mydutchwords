/* reminders — the trigger in the habit loop: at the time the user picked,
   greeting them for that part of the day ("Good morning!").

   One reminder a day at most, and none once the day is done. Never a second
   nudge, never "you're about to lose…" — the reminder offers the small
   version of the task and nothing else.

   Delivery is the browser Notification API, scheduled from the open app.
   That is honest about its limits: a web app without a service worker and
   a push backend can only notify while a tab is alive (open or
   backgrounded). The timing and copy live here, separate from delivery, so
   a real push channel can reuse them unchanged. */
import { useEffect } from "react";
import { commitmentOf, timeEmoji, timeNudge, timeParts, type HabitState } from "./habit";

export interface ReminderCopy {
  title: string;
  body: string;
}

export function reminderCopy(habit: HabitState): ReminderCopy {
  const c = commitmentOf(habit.commitment);
  return {
    title: `${timeEmoji(habit.time)} ${timeNudge(habit.time)}`,
    body: `${c.words} Dutch words — about ${c.minutes} minute${c.minutes === 1 ? "" : "s"}.`,
  };
}

/** The next moment the reminder should fire: today at the habit time if that
 *  is still ahead and today isn't done, otherwise tomorrow at that time. */
export function nextReminderAt(habit: HabitState, now: Date, todayDone: boolean): Date {
  const [h, m] = timeParts(habit.time);
  const at = new Date(now);
  at.setHours(h, m, 0, 0);
  if (todayDone || at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at;
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Asks for permission. Resolves true once notifications may be shown. */
export async function requestReminderPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

/** Keeps the day's reminder scheduled while the app is open. Re-schedules
 *  whenever the habit or today's done-ness changes, so finishing the day
 *  cancels a pending reminder. */
export function useDailyReminder(habit: HabitState | null, todayDone: boolean): void {
  useEffect(() => {
    if (!habit?.reminders || !notificationsSupported()) return;
    if (Notification.permission !== "granted") return;

    const at = nextReminderAt(habit, new Date(), todayDone);
    // setTimeout overflows past ~24.8 days; a day ahead is well within it.
    const timer = window.setTimeout(() => {
      const { title, body } = reminderCopy(habit);
      try {
        new Notification(title, { body, tag: "woordkast-daily" });
      } catch {
        // Some mobile browsers only allow notifications from a service
        // worker. Nothing to fall back to; the home screen carries the cue.
      }
    }, at.getTime() - Date.now());
    return () => window.clearTimeout(timer);
  }, [habit, todayDone]);
}
