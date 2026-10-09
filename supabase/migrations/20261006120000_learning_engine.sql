-- Learning engine v2 — the review log, a pre-migration backup, and a view
-- over the new per-word fields. See LEARNING_ENGINE_PLAN.md.
--
-- Word state itself is migrated by the app, not here: decks live as JSON in
-- user_state.deck, and every client migrates a deck it reads (idempotently,
-- keyed on engineVersion = 2) before using or merging it. This migration
-- only adds what has to exist server-side.
--
-- Safe to run more than once: every statement is guarded.

-- ---------------------------------------------------------------------------
-- 1. Backup of every deck and practice log as it was before v2 clients write
--    to it. Taken once (the insert skips users already backed up), so
--    re-running the migration never overwrites the original copy.
--
--    In the owner-only `research` schema: not exposed over the API, no RLS
--    needed (see 20260812093000_word_progress_views.sql).
-- ---------------------------------------------------------------------------
create table if not exists research.user_state_backup_engine_v2 (
  user_id      uuid primary key,
  deck         jsonb       not null,
  results      jsonb       not null,
  backed_up_at timestamptz not null default now()
);

insert into research.user_state_backup_engine_v2 (user_id, deck, results)
select user_id, deck, results
from public.user_state
on conflict (user_id) do nothing;

comment on table research.user_state_backup_engine_v2 is
  'Decks and practice logs as they were before the learning engine v2 rollout. Rollback source; drop after the field study.';

-- ---------------------------------------------------------------------------
-- 2. The review log — append-only, one row per exercise answered (graded or
--    not). The audit trail for the field study; never edited or deleted.
--
--    The app writes rows from a local outbox with client-generated ids and
--    ON CONFLICT DO NOTHING, so retried uploads never duplicate a row.
--    `occurred_at` is the spec's `timestamp` (a reserved word in SQL).
-- ---------------------------------------------------------------------------
create table if not exists public.review_events (
  id               uuid primary key,
  user_id          uuid        not null references auth.users (id) on delete cascade,
  word_id          text        not null,
  session_id       uuid,
  occurred_at      timestamptz not null,
  local_date       date        not null,
  exercise_type    text        not null check (exercise_type in
                     ('flashcard', 'multiple_choice', 'matching', 'listening', 'sentence_completion', 'active_recall')),
  result           text        not null check (result in
                     ('correct', 'almost', 'wrong', 'dont_know', 'skipped', 'exposure')),
  -- Whether this answer changed scheduling (the word's first graded answer
  -- of the day). Practice rounds, flashcards, skips and repeat answers on
  -- the same day are logged with graded = false.
  graded           boolean     not null,
  response_time_ms integer,
  state_before     text        not null check (state_before in ('new', 'learning', 'learned')),
  state_after      text        not null check (state_after  in ('new', 'learning', 'learned')),
  interval_before  integer     not null,
  interval_after   integer     not null,
  received_at      timestamptz not null default now()
);

create index if not exists review_events_user_time on public.review_events (user_id, occurred_at);
create index if not exists review_events_user_word on public.review_events (user_id, word_id, occurred_at);

alter table public.review_events enable row level security;

-- Read and append your own rows. There is deliberately no update or delete
-- policy: with RLS on, those are denied to every API client.
drop policy if exists "review_events_select_own" on public.review_events;
create policy "review_events_select_own"
  on public.review_events for select
  using (auth.uid() = user_id);

drop policy if exists "review_events_insert_own" on public.review_events;
create policy "review_events_insert_own"
  on public.review_events for insert
  with check (auth.uid() = user_id);

comment on table public.review_events is
  'Append-only review log (learning engine v2). One row per exercise answered. Analysis only — never read back into word state.';

-- ---------------------------------------------------------------------------
-- 3. The v2 per-word fields, flattened. The existing user_word_progress view
--    keeps working unchanged: v2 clients still write `level`, derived from
--    the new state (New 0, Learning 1–5 by interval, Learned 6).
-- ---------------------------------------------------------------------------
create or replace view public.user_word_learning_state
with (security_invoker = on) as
select
  s.user_id,
  w.value ->> 'id'                                        as word_id,
  coalesce((w.value ->> 'engineVersion')::int, 1)         as engine_version,
  w.value ->> 'state'                                     as learning_state,
  (w.value ->> 'evidenceTier')::int                       as evidence_tier,
  (w.value ->> 'interval')::int                           as interval_days,
  (w.value ->> 'ease')::numeric                           as ease,
  (w.value ->> 'dueDate')::timestamptz                    as next_review_at,
  (w.value ->> 'lastReviewedAt')::timestamptz             as last_reviewed_at,
  (w.value ->> 'lastGradedDay')::date                     as last_graded_day,
  coalesce((w.value ->> 'reps')::int, 0)                  as consecutive_correct,
  coalesce((w.value ->> 'consecutiveFailures')::int, 0)   as consecutive_failures,
  coalesce((w.value ->> 'lapses')::int, 0)                as lapses,
  coalesce((w.value ->> 'successfulReviewDays')::int, 0)  as successful_review_days,
  coalesce((w.value ->> 'hasProductionSuccess')::boolean, false) as has_production_success,
  w.value ->> 'lastExerciseType'                          as last_exercise_type,
  w.value ->> 'lastResult'                                as last_result,
  w.value -> 'legacy'                                     as legacy,
  s.updated_at                                            as synced_at
from public.user_state s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.deck) = 'array' then s.deck else '[]'::jsonb end
) as w(value);

comment on view public.user_word_learning_state is
  'One row per (user, word) with the learning engine v2 fields. engine_version 1 = not yet migrated by a client.';

-- ---------------------------------------------------------------------------
-- ROLLBACK (run by hand, in the SQL Editor, only if v2 must be withdrawn):
--
--   -- 1. Deploy the previous app build first, so no client re-migrates.
--   -- 2. Put every deck and log back exactly as it was before v2:
--   update public.user_state s
--      set deck = b.deck, results = b.results, updated_at = now()
--     from research.user_state_backup_engine_v2 b
--    where b.user_id = s.user_id;
--   -- (Progress made after the rollout is lost by this; to keep it instead,
--   --  restore each word's `legacy` fields — see learningEngine.restoreLegacy.)
--   -- 3. Optionally drop the new objects (the review log is study data —
--   --    export it first):
--   drop view  if exists public.user_word_learning_state;
--   drop table if exists public.review_events;
--   drop table if exists research.user_state_backup_engine_v2;
--
-- Devices also keep their own untouched pre-v2 copy in localStorage under
-- "woordkast.deck.v1-backup".
-- ---------------------------------------------------------------------------
