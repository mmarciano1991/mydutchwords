-- Woordkast cloud sync — run once in your Supabase project.
-- Dashboard → SQL Editor → paste → Run.
--
-- One row per user holds their whole progress snapshot (deck + practice
-- results + custom words) as JSON. Row-Level Security restricts every row to
-- its owner, which is what makes it safe to read/write straight from the
-- browser with the public anon key.

create table if not exists public.user_state (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  deck         jsonb       not null default '[]'::jsonb,
  results      jsonb       not null default '[]'::jsonb,
  custom_words jsonb       not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- A user may only see and change their own row.
drop policy if exists "user_state_select_own" on public.user_state;
create policy "user_state_select_own"
  on public.user_state for select
  using (auth.uid() = user_id);

drop policy if exists "user_state_insert_own" on public.user_state;
create policy "user_state_insert_own"
  on public.user_state for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_state_update_own" on public.user_state;
create policy "user_state_update_own"
  on public.user_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
