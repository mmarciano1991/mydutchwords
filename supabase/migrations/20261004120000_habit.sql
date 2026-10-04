-- Woordkast habit — the daily commitment and how the week is read back.
--
--   {"commitment": "espresso", "time": "08:00", "weeklyTarget": 4,
--    "reminders": false, "startedAt": "2026-10-04",
--    "doneDays": ["2026-10-04"], "lastReflection": null,
--    "welcomedOn": null, "updatedAt": 1791100000000}
--
-- commitment/time/weeklyTarget are the onboarding choices, editable later
-- in Settings. doneDays records each day the goal was reached — recorded
-- rather than re-derived from the practice log, so changing the commitment
-- never rewrites past weeks.
--
-- Null means the user hasn't been through onboarding yet; the app shows it
-- on next open. No backfill: existing practice history is untouched, and the
-- app backfills doneDays from it when the user sets the habit up.

alter table public.user_state
  add column if not exists habit jsonb;

-- RLS policies are table-wide (see the init migration), so this column is
-- already restricted to its owner.
