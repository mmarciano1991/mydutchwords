-- The dictionary, on the server.
--
-- Built and published by the dictionary pipeline (scripts/dictionary/,
-- .github/workflows/dictionary.yml) with the service role. The app only
-- reads, through the RPCs at the bottom; every table is read-only to
-- clients (RLS) and the doubt queue and id registry aren't readable at all.
--
--   dict_words           one row per word: the full entry as JSON, plus a
--                        small preview for suggestion rows
--   dict_keys            the search index: every key that leads to a word
--                        (its own form, inflected forms, variants, an
--                        abbreviation's expansion)
--   dict_senses          sense id → word, for refreshing deck snapshots
--   dict_sense_registry  source sense id → our stable sense id
--   dict_doubt           everything a build held back, for review
--   dict_builds          one row per published build, with its report
--
-- Safe to run more than once.

create extension if not exists pg_trgm;

create table if not exists public.dict_words (
  id          text primary key,
  form        text not null,
  kind        text not null,
  search_key  text not null,
  -- learner-confusion key (lib/dictionary/normalize confusionKey): "klijn"
  -- and "klein" share it, so "Did you mean…?" is one index lookup
  canon_key   text not null,
  frequency   integer not null,
  preview     jsonb not null,
  data        jsonb not null,
  build_id    text not null,
  updated_at  timestamptz not null default now()
);
create index if not exists dict_words_canon_idx on public.dict_words (canon_key);
create index if not exists dict_words_trgm_idx on public.dict_words using gin (search_key gin_trgm_ops);

create table if not exists public.dict_keys (
  key        text not null,
  word_id    text not null references public.dict_words (id) on delete cascade,
  via        text not null check (via in ('lemma', 'form', 'variant', 'expansion')),
  form       text not null,
  use_id     text not null default '',
  frequency  integer not null,
  primary key (key, word_id, via, use_id)
);
-- Prefix search ("belas%") and mid-word search ("%aanslag%").
create index if not exists dict_keys_prefix_idx on public.dict_keys (key text_pattern_ops);
create index if not exists dict_keys_trgm_idx on public.dict_keys using gin (key gin_trgm_ops);
create index if not exists dict_keys_word_idx on public.dict_keys (word_id);

create table if not exists public.dict_senses (
  id       text primary key,
  word_id  text not null references public.dict_words (id) on delete cascade,
  use_id   text not null,
  pos      text not null,
  gloss    text not null,
  rank     integer not null
);
create index if not exists dict_senses_word_idx on public.dict_senses (word_id);

create table if not exists public.dict_sense_registry (
  source_id  text primary key,
  sense_id   text not null,
  word_id    text not null,
  pos        text not null,
  gloss      text not null
);

create table if not exists public.dict_doubt (
  id          bigserial primary key,
  build_id    text not null,
  word        text not null,
  scope       text not null,
  pos         text,
  reason      text not null,
  detail      jsonb,
  -- set by a reviewer: 'accepted' (publish as is next build), 'rejected',
  -- or a corrected value in `resolution`
  status      text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'corrected')),
  resolution  jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists dict_doubt_open_idx on public.dict_doubt (status, reason);

create table if not exists public.dict_builds (
  id          text primary key,
  created_at  timestamptz not null default now(),
  report      jsonb not null
);

alter table public.dict_words enable row level security;
alter table public.dict_keys enable row level security;
alter table public.dict_senses enable row level security;
alter table public.dict_sense_registry enable row level security;
alter table public.dict_doubt enable row level security;
alter table public.dict_builds enable row level security;

drop policy if exists "dictionary is public" on public.dict_words;
create policy "dictionary is public" on public.dict_words for select using (true);
drop policy if exists "dictionary keys are public" on public.dict_keys;
create policy "dictionary keys are public" on public.dict_keys for select using (true);
drop policy if exists "dictionary senses are public" on public.dict_senses;
create policy "dictionary senses are public" on public.dict_senses for select using (true);
-- dict_sense_registry, dict_doubt, dict_builds: no policy — service role only.

-- ── RPCs ─────────────────────────────────────────────────────────────────

-- LIKE pattern from a search key: % and _ taken literally.
create or replace function public.dict_like_escape(q text) returns text
language sql immutable as $$
  select replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_')
$$;

-- Autocomplete. Prefix matches rank above mid-word ones; an exact key comes
-- first — the word itself, then a word it is an inflected form of ("liep" →
-- lopen) — then words starting with the query by frequency, then spelling
-- variants.
create or replace function public.dict_suggest(q text, lim integer default 9)
returns table (
  word_id text, form text, kind text, via text, matched text, use_id text,
  frequency integer, exact boolean, mid boolean, preview jsonb
)
language sql stable as $$
  with p as (
    select distinct on (k.word_id)
      k.word_id, k.via, k.form as matched, k.use_id, (k.key = q) as exact, false as mid
    from public.dict_keys k
    where k.key like public.dict_like_escape(q) || '%'
    order by k.word_id, (k.key = q) desc, (k.via = 'lemma') desc, (k.via = 'form') desc
  ),
  m as (
    select distinct on (k.word_id)
      k.word_id, k.via, k.form as matched, k.use_id, false as exact, true as mid
    from public.dict_keys k
    where length(q) >= 3
      and k.via = 'lemma'
      and k.key like '%' || public.dict_like_escape(q) || '%'
      and not exists (select 1 from p where p.word_id = k.word_id)
    order by k.word_id
  ),
  hits as (select * from p union all select * from m)
  select w.id, w.form, w.kind, h.via, h.matched, h.use_id, w.frequency, h.exact, h.mid, w.preview
  from hits h join public.dict_words w on w.id = h.word_id
  order by h.exact desc, (h.exact and h.via <> 'lemma') asc, h.mid asc, (h.via = 'variant') asc, (h.via = 'expansion') asc, w.frequency asc, (w.kind = 'properNoun') asc, w.form asc
  limit lim
$$;

-- Every word a typed or tapped form can be: "was" → zijn, wassen, de was.
create or replace function public.dict_lookup(q text)
returns table (word_id text, via text, use_id text, matched text, data jsonb)
language sql stable as $$
  select w.id, k.via, k.use_id, k.form, w.data
  from public.dict_keys k join public.dict_words w on w.id = k.word_id
  where k.key = q
  order by (k.via = 'lemma') desc, w.frequency asc
$$;

-- Full entries by id.
create or replace function public.dict_words_get(ids text[])
returns table (word_id text, data jsonb)
language sql stable as $$
  select w.id, w.data from public.dict_words w where w.id = any(ids)
$$;

-- Candidates for "Did you mean…?": same confusion key, or trigram-close
-- with the same first letter. The client ranks them (lib/dictionary/fuzzy).
create or replace function public.dict_fuzzy(q text, canon text, lim integer default 30)
returns table (word_id text, form text, frequency integer, preview jsonb)
language sql stable as $$
  select w.id, w.form, w.frequency, w.preview
  from public.dict_words w
  where w.canon_key = canon
     or (w.search_key % q and (left(w.search_key, 1) = left(q, 1) or left(w.canon_key, 1) = left(canon, 1)))
  order by (w.canon_key = canon) desc, similarity(w.search_key, q) desc, w.frequency asc
  limit lim
$$;

-- What a compound split needs to know about each candidate segment.
create or replace function public.dict_parts(keys text[])
returns table (key text, word_id text, form text, kind text, frequency integer, is_lemma boolean)
language sql stable as $$
  select distinct on (k.key) k.key, w.id, w.form, w.kind, w.frequency, (k.via in ('lemma', 'variant'))
  from public.dict_keys k join public.dict_words w on w.id = k.word_id
  where k.key = any(keys) and k.via in ('lemma', 'variant', 'form')
  order by k.key, (k.via in ('lemma', 'variant')) desc, w.frequency asc
$$;

-- The words that hold these senses — to refresh the deck's local copies.
create or replace function public.dict_senses_get(ids text[])
returns table (sense_id text, word_id text, data jsonb)
language sql stable as $$
  select s.id, w.id, w.data
  from public.dict_senses s join public.dict_words w on w.id = s.word_id
  where s.id = any(ids)
$$;

-- Common words with a short gloss: distractors for Multiple Choice and
-- Listening when the learner's deck is still small.
create or replace function public.dict_common(lim integer default 400)
returns table (word_id text, form text, frequency integer, preview jsonb)
language sql stable as $$
  select w.id, w.form, w.frequency, w.preview
  from public.dict_words w
  where w.kind in ('word', 'compound')
  order by w.frequency asc
  limit lim
$$;

grant execute on function public.dict_suggest(text, integer) to anon, authenticated;
grant execute on function public.dict_lookup(text) to anon, authenticated;
grant execute on function public.dict_words_get(text[]) to anon, authenticated;
grant execute on function public.dict_fuzzy(text, text, integer) to anon, authenticated;
grant execute on function public.dict_parts(text[]) to anon, authenticated;
grant execute on function public.dict_senses_get(text[]) to anon, authenticated;
grant execute on function public.dict_common(integer) to anon, authenticated;
