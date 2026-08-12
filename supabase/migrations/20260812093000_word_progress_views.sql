-- Woordkast pilot analytics — per-word views over the sync snapshot.
--
-- `user_state` stores each user's whole progress as three JSON blobs, which
-- is right for syncing (one read, one write, trivial merge) but awkward to
-- query: picking "every word this user has mastered" means hand-writing
-- jsonb operators every time.
--
-- These views flatten the same data into ordinary rows — one row per
-- (user, word) — so the pilot survey can be built with plain SELECTs. They
-- are views, not tables: nothing is duplicated, nothing can drift out of
-- date, and the app keeps writing exactly what it writes today. They also
-- apply retroactively, so users who have been practising since before this
-- migration are already covered.
--
-- Every view is `security_invoker`, so the RLS policies on `user_state`
-- still decide who sees what: a signed-in user querying these from the
-- browser sees only their own words, while the project owner (SQL Editor /
-- service role) sees the whole cohort.

-- ---------------------------------------------------------------------------
-- One row per word in a user's deck.
--
-- Deck items store only the dictionary id, and for bundled words that id *is*
-- the Dutch word (see src/data/dictionary.ts), so `dutch` needs no lookup.
-- The English gloss lives in the app bundle rather than the database, so it
-- is filled in only for user-added (Wiktionary) words, which carry their own
-- translation in `custom_words`. See scripts/survey-words.mjs for attaching
-- glosses to the rest.
-- ---------------------------------------------------------------------------
create or replace view public.user_word_progress
with (security_invoker = on) as
with deck_items as (
  select
    s.user_id,
    s.updated_at,
    s.custom_words,
    item.value as word
  from public.user_state s
  -- Guard the cast: one malformed row would otherwise break the view for
  -- every user, not just its owner.
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(s.deck) = 'array' then s.deck else '[]'::jsonb end
  ) as item(value)
),
levelled as (
  select
    d.*,
    -- Decks synced before the level ladder shipped have no `level`. The app
    -- backfills those on load (storage.migrateDeckItem), but a user who has
    -- not opened it since would otherwise show up here as untouched, which
    -- would quietly drop real progress from the survey shortlist. Same
    -- derivation: nearest ladder rung at or below the stored interval.
    case
      when (d.word ->> 'level') is not null then (d.word ->> 'level')::int
      when d.word ->> 'state' = 'new' then 0
      when coalesce((d.word ->> 'interval')::int, 0) >= 90 then 6
      when coalesce((d.word ->> 'interval')::int, 0) >= 30 then 5
      when coalesce((d.word ->> 'interval')::int, 0) >= 14 then 4
      when coalesce((d.word ->> 'interval')::int, 0) >= 7  then 3
      when coalesce((d.word ->> 'interval')::int, 0) >= 3  then 2
      when coalesce((d.word ->> 'interval')::int, 0) >= 1  then 1
      else 0
    end as level
  from deck_items d
)
select
  d.user_id,
  d.word ->> 'id'                                    as word_id,
  d.word ->> 'id'                                    as dutch,
  custom.value ->> 'english'                         as english,
  custom.value is not null                           as is_custom_word,
  d.level                                            as level,
  case
    when d.level >= 6 then 'mastered'
    when d.level >= 4 then 'strong'
    when d.level >= 1 then 'learning'
    else 'new'
  end                                                as tier,
  d.word ->> 'state'                                 as card_state,
  coalesce((d.word ->> 'reps')::int, 0)              as reps,
  coalesce((d.word ->> 'lapses')::int, 0)            as lapses,
  coalesce((d.word ->> 'lapses')::int, 0) >= 4       as is_leech,
  to_timestamp((d.word ->> 'dateAdded')::bigint / 1000.0) as added_at,
  (d.word ->> 'lastReviewedAt')::timestamptz         as last_reviewed_at,
  (d.word ->> 'dueDate')::timestamptz                as due_at,
  d.updated_at                                       as synced_at
from levelled d
left join lateral (
  select cw.value
  from jsonb_array_elements(
    case when jsonb_typeof(d.custom_words) = 'array' then d.custom_words else '[]'::jsonb end
  ) as cw(value)
  where cw.value ->> 'id' = d.word ->> 'id'
  limit 1
) as custom on true;

comment on view public.user_word_progress is
  'One row per (user, word) in a deck, with its ladder level and mastery tier. Flattens user_state.deck.';

-- ---------------------------------------------------------------------------
-- One row per answered flashcard — the append-only practice log.
-- ---------------------------------------------------------------------------
create or replace view public.user_practice_events
with (security_invoker = on) as
select
  s.user_id,
  r.value ->> 'entryId'                              as word_id,
  r.value ->> 'grade'                                as grade,
  r.value ->> 'grade' = 'know'                       as was_correct,
  to_timestamp((r.value ->> 'timestamp')::bigint / 1000.0) as answered_at
from public.user_state s
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(s.results) = 'array' then s.results else '[]'::jsonb end
) as r(value);

comment on view public.user_practice_events is
  'One row per flashcard answer. Flattens user_state.results.';

-- ---------------------------------------------------------------------------
-- Practice history rolled up per (user, word).
--
-- `reps` on a deck item is the *current streak* — it resets to 0 on a wrong
-- answer — so it does not say how much work a word took. These totals do.
-- ---------------------------------------------------------------------------
create or replace view public.user_word_review_stats
with (security_invoker = on) as
select
  user_id,
  word_id,
  count(*)                                           as reviews,
  count(*) filter (where was_correct)                as correct,
  count(*) filter (where not was_correct)            as wrong,
  round(
    100.0 * count(*) filter (where was_correct) / nullif(count(*), 0)
  )::int                                             as accuracy_pct,
  min(answered_at)                                   as first_reviewed_at,
  max(answered_at)                                   as last_reviewed_at,
  count(distinct date(answered_at))                  as days_practised
from public.user_practice_events
group by user_id, word_id;

comment on view public.user_word_review_stats is
  'Lifetime practice totals per (user, word) — unlike deck.reps, these do not reset on a wrong answer.';

-- ---------------------------------------------------------------------------
-- The words worth putting in the survey: mastered (level 6) or close to it
-- (level 4–5), with the practice history that backs the claim.
--
-- Words the user flagged as already-known at capture time are not evidence
-- of learning: they are created at level 6 with no reviews, so filter on
-- `reviews > 0` when you want words the app actually taught.
-- ---------------------------------------------------------------------------
create or replace view public.survey_candidates
with (security_invoker = on) as
select
  p.user_id,
  p.word_id,
  p.dutch,
  p.english,
  p.is_custom_word,
  p.tier,
  p.level,
  p.reps                                             as current_streak,
  p.lapses,
  coalesce(st.reviews, 0)                            as reviews,
  coalesce(st.correct, 0)                            as correct,
  coalesce(st.wrong, 0)                              as wrong,
  st.accuracy_pct,
  coalesce(st.days_practised, 0)                     as days_practised,
  p.added_at,
  st.first_reviewed_at,
  p.last_reviewed_at,
  p.due_at
from public.user_word_progress p
left join public.user_word_review_stats st
  on st.user_id = p.user_id
 and st.word_id = p.word_id
where p.level >= 4;

comment on view public.survey_candidates is
  'Words at level 4+ (strong or mastered) per user — the shortlist to test in the pilot survey.';

-- ---------------------------------------------------------------------------
-- One row per pilot participant: how much they used the app and how much
-- there is to test. Useful daily during the 14 days, not just at the end.
-- ---------------------------------------------------------------------------
create or replace view public.study_participants
with (security_invoker = on) as
with deck as (
  select
    user_id,
    count(*)                                         as words_in_deck,
    count(*) filter (where tier = 'mastered')        as mastered,
    count(*) filter (where tier = 'strong')          as strong,
    count(*) filter (where tier = 'learning')        as learning,
    count(*) filter (where tier = 'new')             as not_started,
    count(*) filter (where is_leech)                 as leeches,
    min(added_at)                                    as first_word_added_at,
    max(added_at)                                    as last_word_added_at,
    max(synced_at)                                   as last_synced_at
  from public.user_word_progress
  group by user_id
),
practice as (
  select
    user_id,
    count(*)                                         as total_reviews,
    count(distinct date(answered_at))                as active_days,
    min(answered_at)                                 as first_review_at,
    max(answered_at)                                 as last_review_at
  from public.user_practice_events
  group by user_id
)
select
  coalesce(d.user_id, p.user_id)                     as user_id,
  coalesce(d.words_in_deck, 0)                       as words_in_deck,
  coalesce(d.mastered, 0)                            as mastered,
  coalesce(d.strong, 0)                              as strong,
  coalesce(d.mastered, 0) + coalesce(d.strong, 0)    as survey_ready_words,
  coalesce(d.learning, 0)                            as learning,
  coalesce(d.not_started, 0)                         as not_started,
  coalesce(d.leeches, 0)                             as leeches,
  coalesce(p.total_reviews, 0)                       as total_reviews,
  coalesce(p.active_days, 0)                         as active_days,
  d.first_word_added_at,
  d.last_word_added_at,
  p.first_review_at,
  p.last_review_at,
  d.last_synced_at
from deck d
full outer join practice p on p.user_id = d.user_id;

comment on view public.study_participants is
  'Per-user pilot rollup: deck size, mastery mix, review volume and activity dates.';

-- ---------------------------------------------------------------------------
-- A private workspace for pilot data that must not move — chiefly the day-14
-- snapshot of which words each user had mastered, which the survey is scored
-- against. Users keep practising while the survey is open, so reading live
-- views at scoring time would silently change the questions' premise.
--
-- Deliberately not in `public`: only `public` and `graphql_public` are
-- exposed over the API, and nothing here is granted to anon/authenticated, so
-- these tables are reachable only from the SQL Editor / service role. That
-- matters because a snapshot is cohort-wide — no RLS policy is protecting it.
-- ---------------------------------------------------------------------------
create schema if not exists research;
revoke all on schema research from public;

comment on schema research is
  'Owner-only pilot analysis (survey snapshots). Not exposed over the API.';
