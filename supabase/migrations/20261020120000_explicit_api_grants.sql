-- Explicit Data API grants for every table in "public".
--
-- From 2026-10-30 Supabase no longer grants anon / authenticated /
-- service_role access to new tables in "public" automatically. The live
-- project keeps the grants it already has, but anything that replays these
-- migrations from scratch (a new project, a preview branch, a local
-- `supabase db reset`) would create every table with no API access. These
-- grants restore what the app relies on; RLS policies still decide which
-- rows each role sees. On the live project they change nothing.
--
-- Views (user_word_progress & co.) are read from the dashboard / SQL
-- Editor, not over the API, so they get no grants here.
--
-- Safe to run more than once.

-- Signed-in users' own data (RLS: own rows only).
grant select, insert, update, delete on public.user_state to authenticated;
grant select, insert on public.review_events to authenticated;

-- Public dictionary. The dict_* RPCs run as the caller, so they need select
-- on these too.
grant select on public.dict_words, public.dict_keys, public.dict_senses, public.dict_generated_examples
  to anon, authenticated;

-- Crash reports: insert-only from the app (granted in 20261017140000).
grant insert on public.error_reports to anon, authenticated;

-- Service role: the dictionary build, the "example" Edge Function and admin
-- scripts.
grant all on
  public.user_state, public.review_events, public.error_reports,
  public.dict_words, public.dict_keys, public.dict_senses, public.dict_sense_registry,
  public.dict_doubt, public.dict_builds, public.dict_generated_examples, public.dict_example_attempts
  to service_role;
grant usage, select on sequence public.dict_doubt_id_seq to service_role;
