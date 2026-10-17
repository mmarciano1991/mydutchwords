-- Crash reports from the app (lib/errorReporting.ts).
--
-- Write-only for clients: anyone running the app may add a row, nobody can
-- read one back over the API (no select policy). Reports are read from the
-- dashboard / SQL Editor. They carry no user id, email or deck — just the
-- error, where in the app it happened and which build — and the app scrubs
-- email addresses from messages before sending. Old rows are not needed
-- for long: delete what is older than 90 days, e.g. with
--   delete from public.error_reports where created_at < now() - interval '90 days';
--
-- Safe to run more than once.

create table if not exists public.error_reports (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  message     text not null check (length(message) <= 500),
  stack       text check (length(stack) <= 4000),
  source      text not null check (source in ('render', 'error', 'rejection')),
  path        text check (length(path) <= 200),
  release     text check (length(release) <= 40),
  platform    text check (length(platform) <= 20),
  user_agent  text check (length(user_agent) <= 300)
);

create index if not exists error_reports_created on public.error_reports (created_at);

alter table public.error_reports enable row level security;

drop policy if exists "error_reports_insert" on public.error_reports;
create policy "error_reports_insert"
  on public.error_reports for insert
  to anon, authenticated
  with check (true);

grant insert on public.error_reports to anon, authenticated;

comment on table public.error_reports is
  'Client crash reports. Insert-only from the app; no personal data. Prune after 90 days.';
