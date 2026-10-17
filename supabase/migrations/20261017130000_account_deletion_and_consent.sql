-- Account deletion from inside the app, and the review log made opt-in.
--
-- 1. delete_my_account() — App Store guideline 5.1.1(v): an app that lets
--    you create an account must let you delete it, in the app. Deleting the
--    auth.users row cascades to user_state and review_events (both
--    `on delete cascade`). The pre-v2 backup in `research` has no foreign
--    key (20261006120000_learning_engine.sql), so it is cleared here by
--    hand — as must any future table in `research` that holds a user_id.
--
-- 2. review_events accepts rows only from users who opted in to the field
--    study (user_metadata.research_consent = true, set from Settings). The
--    app already stops recording without consent; this makes the server
--    agree. user_metadata is writable by the user, which is right for a
--    consent flag: it is theirs to give and to withdraw.
--
-- Safe to run more than once.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  delete from research.user_state_backup_engine_v2 where user_id = v_user;
  -- user_state and review_events go with the user (on delete cascade).
  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Deletes the calling user and everything stored for them, research backup included.';

drop policy if exists "review_events_insert_own" on public.review_events;
create policy "review_events_insert_own"
  on public.review_events for insert
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt() -> 'user_metadata' ->> 'research_consent')::boolean, false)
  );
