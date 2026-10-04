-- Woordkast pilot analytics — `dutch` without the sense suffix.
--
-- A deck id is a meaning, not a word: the second meaning of "aanslag" is
-- stored as "aanslag#1" (see src/lib/wordSources.ts). user_word_progress
-- took the id as the Dutch word, so second meanings showed up in the survey
-- views as "aanslag#1". The word is the id up to the "#".
--
-- Same columns, same order: survey_candidates and study_participants read
-- this view and pick the change up as they are. `english` for a second
-- meaning now resolves too, since the app keeps each one's content in
-- custom_words — which is also why those copies are kept out of
-- is_custom_word.

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
  -- A second meaning's id carries its sense index ("aanslag#1"); the word
  -- itself is everything before it.
  regexp_replace(d.word ->> 'id', '#[0-9]+$', '')    as dutch,
  custom.value ->> 'english'                         as english,
  -- A second meaning's copy in custom_words is the app keeping its content
  -- stable, not a word the user brought in from outside the dictionary.
  custom.value is not null
    and d.word ->> 'id' !~ '#[0-9]+$'                as is_custom_word,
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
