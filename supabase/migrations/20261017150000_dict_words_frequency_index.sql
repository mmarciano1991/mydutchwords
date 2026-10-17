-- Index for dict_common: the most frequent words, quiz distractors.
--
-- dict_words had no index on frequency, so every dict_common call read the
-- whole table (~59k rows, each with its jsonb data and preview) to sort it,
-- even for lim = 10. On production that ran past the statement timeout
-- (57014 after ~3.3s), so the distractor top-up for Multiple Choice and
-- Listening always failed and the app fell back to deck-only options.
--
-- The index matches dict_common exactly (20261017120000_dictionary_rpc_limits.sql):
--
--   where kind in ('word', 'compound')   the partial index predicate
--   order by frequency asc               the index order
--
-- so the planner walks the index in order and stops after lim rows, reading
-- only those heap rows.
--
-- Safe to run more than once.

create index if not exists dict_words_common_idx
  on public.dict_words (frequency)
  where kind in ('word', 'compound');

analyze public.dict_words;
