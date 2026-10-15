-- Examples written on demand by the "example" Edge Function, for dictionary
-- senses that shipped without one ("Example coming soon").
--
-- One row per sense, written once and shared by every learner: the first
-- learner to save the sense pays for the sentence, everyone after reads it.
-- Keyed by the stable sense id, and also by form / pos / gloss — the key the
-- build uses for stored examples (scripts/dictionary/stored.mjs) — so the
-- next dictionary build folds these into the published entries, after
-- running them through the same checks as every other example.
--
-- Readable by anyone (the dictionary is public); written only by the
-- function (service role).
--
-- Safe to run more than once.

create table if not exists public.dict_generated_examples (
  sense_id    text primary key,
  form        text not null,
  pos         text not null,
  gloss       text not null,
  nl          text not null,
  en          text not null,
  model       text not null,
  created_at  timestamptz not null default now()
);

-- Senses the model couldn't write a passing sentence for: after a few
-- attempts the function stops trying, so a sense that always fails can't
-- be made to cost again and again. Service role only.
create table if not exists public.dict_example_attempts (
  sense_id    text primary key,
  attempts    integer not null default 0,
  last_issue  text,
  updated_at  timestamptz not null default now()
);

alter table public.dict_generated_examples enable row level security;
alter table public.dict_example_attempts enable row level security;

drop policy if exists "generated examples are public" on public.dict_generated_examples;
create policy "generated examples are public" on public.dict_generated_examples for select using (true);
-- dict_example_attempts: no policy — service role only.
