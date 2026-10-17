-- Bounds on the public dictionary RPCs.
--
-- They are callable by anon, and every limit and id list came straight from
-- the caller: dict_common(1000000), or an id array of 100k entries, made the
-- database do as much work as anyone asked. The data is public anyway; what
-- is being protected is the database's time.
--
--   limits   clamped to a ceiling well above what the app asks for
--            (suggest 9–50, fuzzy 30, common 800)
--   arrays   refused past 500 ids; the app sends them in batches of 200
--            (lib/dictionary/supabaseSource.ts)
--
-- Same signatures as 20261011120000_dictionary.sql, so the existing grants
-- carry over. Safe to run more than once.

create or replace function public.dict_check_ids(ids text[]) returns void
language plpgsql immutable as $$
begin
  if coalesce(cardinality(ids), 0) > 500 then
    raise exception 'too many ids (max 500)' using errcode = '22023';
  end if;
end;
$$;

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
  limit least(greatest(coalesce(lim, 9), 1), 100)
$$;

create or replace function public.dict_words_get(ids text[])
returns table (word_id text, data jsonb)
language plpgsql stable as $$
begin
  perform public.dict_check_ids(ids);
  return query select w.id, w.data from public.dict_words w where w.id = any(ids);
end;
$$;

create or replace function public.dict_fuzzy(q text, canon text, lim integer default 30)
returns table (word_id text, form text, frequency integer, preview jsonb)
language sql stable as $$
  select w.id, w.form, w.frequency, w.preview
  from public.dict_words w
  where w.canon_key = canon
     or (w.search_key % q and (left(w.search_key, 1) = left(q, 1) or left(w.canon_key, 1) = left(canon, 1)))
  order by (w.canon_key = canon) desc, similarity(w.search_key, q) desc, w.frequency asc
  limit least(greatest(coalesce(lim, 30), 1), 50)
$$;

create or replace function public.dict_parts(keys text[])
returns table (key text, word_id text, form text, kind text, frequency integer, is_lemma boolean)
language plpgsql stable as $$
begin
  perform public.dict_check_ids(keys);
  return query
    select distinct on (k.key) k.key, w.id, w.form, w.kind, w.frequency, (k.via in ('lemma', 'variant'))
    from public.dict_keys k join public.dict_words w on w.id = k.word_id
    where k.key = any(keys) and k.via in ('lemma', 'variant', 'form')
    order by k.key, (k.via in ('lemma', 'variant')) desc, w.frequency asc;
end;
$$;

create or replace function public.dict_senses_get(ids text[])
returns table (sense_id text, word_id text, data jsonb)
language plpgsql stable as $$
begin
  perform public.dict_check_ids(ids);
  return query
    select s.id, w.id, w.data
    from public.dict_senses s join public.dict_words w on w.id = s.word_id
    where s.id = any(ids);
end;
$$;

create or replace function public.dict_common(lim integer default 400)
returns table (word_id text, form text, frequency integer, preview jsonb)
language sql stable as $$
  select w.id, w.form, w.frequency, w.preview
  from public.dict_words w
  where w.kind in ('word', 'compound')
  order by w.frequency asc
  limit least(greatest(coalesce(lim, 400), 1), 1000)
$$;
