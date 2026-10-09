-- Woordkast sync — conflict-safe writes.
--
-- A plain upsert of the whole snapshot is last-write-wins: a device whose
-- copy predates another device's progress would push its older snapshot over
-- it. So every row now carries a `version`, and the app writes through
-- `sync_user_state`, which only applies a write made against the version the
-- device last saw. On a mismatch nothing is written; the current row comes
-- back instead, and the app merges it (cloudState.mergeState) and retries.
--
-- The function also takes practice results as a delta and appends them here,
-- deduped, so a push no longer re-uploads the whole (ever-growing) log.

alter table public.user_state
  add column if not exists version bigint not null default 0;

-- Writes that don't go through the function (a client running an older build)
-- still move the version on, so a newer client sees them as a conflict rather
-- than silently overwriting them.
create or replace function public.user_state_bump_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.version is not distinct from old.version then
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists user_state_bump_version on public.user_state;
create trigger user_state_bump_version
  before update on public.user_state
  for each row execute function public.user_state_bump_version();

-- Shape and size limits. RLS keeps a row to its owner, but the owner can
-- write anything through the public key; these keep one row from growing
-- without bound or holding a non-array where the app expects a list.
-- NOT VALID: enforced on every write from now on, without failing the
-- migration over a row that predates the limits.
alter table public.user_state
  drop constraint if exists user_state_shape,
  add constraint user_state_shape check (
    jsonb_typeof(deck) = 'array'
    and jsonb_typeof(results) = 'array'
    and jsonb_typeof(custom_words) = 'array'
  ) not valid;

alter table public.user_state
  drop constraint if exists user_state_size,
  add constraint user_state_size check (
    pg_column_size(deck) <= 2097152
    and pg_column_size(results) <= 10485760
    and pg_column_size(custom_words) <= 2097152
    and coalesce(pg_column_size(daily_set), 0) <= 65536
    and coalesce(pg_column_size(practice_run), 0) <= 65536
    and coalesce(pg_column_size(habit), 0) <= 65536
  ) not valid;

-- Returns {"status": "ok", "version": n} once written, or
-- {"status": "conflict", "row": <current row or null>} when the caller's
-- expected version is stale. Runs as the caller, so RLS still applies.
create or replace function public.sync_user_state(
  p_expected_version bigint,
  p_deck jsonb,
  p_new_results jsonb,
  p_custom_words jsonb,
  p_daily_set jsonb,
  p_practice_run jsonb,
  p_habit jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.user_state%rowtype;
  v_new jsonb := coalesce(p_new_results, '[]'::jsonb);
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_row from public.user_state where user_id = v_user for update;

  if not found then
    if p_expected_version <> 0 then
      return jsonb_build_object('status', 'conflict', 'row', null);
    end if;
    insert into public.user_state
      (user_id, deck, results, custom_words, daily_set, practice_run, habit, version, updated_at)
    values
      (v_user, p_deck, v_new, p_custom_words, p_daily_set, p_practice_run, p_habit, 1, now())
    on conflict (user_id) do nothing;
    if not found then
      -- Another device created the row in the meantime.
      select * into v_row from public.user_state where user_id = v_user;
      return jsonb_build_object('status', 'conflict', 'row', to_jsonb(v_row));
    end if;
    return jsonb_build_object('status', 'ok', 'version', 1);
  end if;

  if v_row.version <> p_expected_version then
    return jsonb_build_object('status', 'conflict', 'row', to_jsonb(v_row));
  end if;

  update public.user_state set
    deck = p_deck,
    results = case
      when jsonb_array_length(v_new) = 0 then v_row.results
      else (
        select coalesce(jsonb_agg(r order by (r ->> 'timestamp')::bigint), '[]'::jsonb)
        from (
          select distinct on (r ->> 'entryId', r ->> 'timestamp', r ->> 'grade') r
          from jsonb_array_elements(
            case when jsonb_typeof(v_row.results) = 'array' then v_row.results else '[]'::jsonb end
            || v_new
          ) as t(r)
        ) deduped
      )
    end,
    custom_words = p_custom_words,
    daily_set = p_daily_set,
    practice_run = p_practice_run,
    habit = p_habit,
    version = v_row.version + 1,
    updated_at = now()
  where user_id = v_user;

  return jsonb_build_object('status', 'ok', 'version', v_row.version + 1);
end;
$$;

revoke all on function public.sync_user_state(bigint, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.sync_user_state(bigint, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
