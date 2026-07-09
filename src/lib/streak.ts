/* Practice streak — derived from the results log, no extra storage.
   A streak day is any local calendar day with at least one graded card.
   The streak counts consecutive days ending today — or ending yesterday
   (today's practice just hasn't happened yet; the streak isn't broken
   until the day is actually missed). */

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function streakDays(results: { timestamp: number }[], now: Date): number {
  if (results.length === 0) return 0;
  const days = new Set(results.map((r) => dayKey(new Date(r.timestamp))));

  // Anchor on today, or yesterday if today hasn't been practiced yet.
  let cursor = new Date(now);
  if (!days.has(dayKey(cursor))) {
    cursor = new Date(cursor.getTime() - MS_PER_DAY);
    if (!days.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - MS_PER_DAY);
  }
  return streak;
}
