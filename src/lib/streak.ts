/* Practice streak — derived from the results log, no extra storage.
   A streak day is any local calendar day with at least one graded card.
   The streak counts consecutive days ending today — or ending yesterday
   (today's practice just hasn't happened yet; the streak isn't broken
   until the day is actually missed). */

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Steps one calendar day back, in place. Not `-24h`: clock days are 23 or
 *  25 hours long across a DST change, which landed the cursor back on the
 *  same day (counting it twice) or skipped one (ending the streak early). */
function stepBackOneDay(d: Date): void {
  d.setDate(d.getDate() - 1);
}

export function streakDays(results: { timestamp: number }[], now: Date): number {
  if (results.length === 0) return 0;
  const days = new Set(results.map((r) => dayKey(new Date(r.timestamp))));

  // Anchor on today, or yesterday if today hasn't been practiced yet.
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) {
    stepBackOneDay(cursor);
    if (!days.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    stepBackOneDay(cursor);
  }
  return streak;
}
