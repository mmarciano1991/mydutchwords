-- Woordkast daily practice set.
--
-- Practice is now a fixed batch of 16 words drawn once per local calendar
-- day (see src/lib/dailySet.ts) rather than an open-ended stream. The draw
-- has to be remembered, or leaving half-way and coming back on another
-- device would hand the user a different set of words and lose the "N to go"
-- and end-of-day result the dashboard reports.
--
-- Only the draw itself is stored: `{"date": "2026-09-10", "wordIds": [...]}`.
-- Progress through it is derived from the `results` log, which is already
-- written per answer and already synced — so there is no second source of
-- truth that can drift out of step with what the user actually answered.
--
-- Null means no set has been drawn yet, which is exactly the state of every
-- existing row, so no backfill is needed: the app draws the day's set on the
-- next visit.

alter table public.user_state
  add column if not exists daily_set jsonb;

-- The existing RLS policies are table-wide (see the init migration), so this
-- column is already restricted to its owner — nothing further to grant.
