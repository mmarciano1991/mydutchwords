-- Woordkast practice run — what the user actually did in a sitting.
--
-- The daily set (see the previous migration) says *which* words today is
-- about. It cannot say what happened to them: the practice log is
-- append-only and has no notion of a session, so it can't distinguish
-- "started a re-drill and stopped half-way" from "finished the set", and it
-- can't be reset when a new sitting begins. Deriving the dashboard's
-- practice card from it meant a finished set kept reporting an old result
-- after a re-drill had gone badly.
--
-- This column holds that missing piece:
--   {"date": "2026-09-10", "wordIds": [...], "answers": {"huis": "know"}}
-- It is written as each answer is given, so a run survives a reload or a
-- switch of device mid-sitting, and the card can never disagree with what
-- was actually answered.
--
-- Null means nobody has practised yet, which is the state of every existing
-- row — no backfill needed. Existing decks, schedules and practice history
-- are untouched; this only records the shape of a sitting.

alter table public.user_state
  add column if not exists practice_run jsonb;

-- The existing RLS policies are table-wide (see the init migration), so this
-- column is already restricted to its owner — nothing further to grant.
