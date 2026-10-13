# The dictionary

How Woordkast's Dutch→English dictionary is built, stored, searched and
reviewed.

## Principles

1. **The unit is the sense, not the string.** `was` is a form of *zijn* and
   *wassen* and the noun *de was*. Each meaning has its own article, example
   and stable id, and the deck stores meanings.
2. **Grammatical facts come from data.** Gender, plural, verb forms,
   separability and part of speech come from Wiktionary, checked across two
   sources.
3. **The model selects and condenses; it never invents.** Everything it
   produces passes mechanical checks before it is stored.
4. **When sources disagree, the entry doesn't ship as is.** It goes to the
   doubt queue.
5. **The whole word beats decomposition.**
6. **A declared gap beats a confident error.** Every field carries its
   source and confidence. A missing field stays missing, and the app says so.

## Sources

| Source | Gives | Licence |
| --- | --- | --- |
| English Wiktionary (kaikki.org extract) | glosses per sense, gender, plurals, verb tables, examples with translations, synonyms, compound etymologies, `[with op ‘for’]` prepositions | CC BY-SA |
| Dutch Wiktionary (kaikki.org extract) | the second opinion on gender, plurals and verb forms; the perfect auxiliary; English translations per sense; Dutch explanations | CC BY-SA |
| OpenTaal word list | official spelling: a headword not in it is not published | BSD / CC BY |
| OpenSubtitles frequency list (top 50k) | ranking of words and suggestions | CC BY-SA |
| Tatoeba NL–EN | real example sentences | CC BY 2.0 FR |

## Pipeline (`scripts/dictionary/`)

| Step | File | What happens |
| --- | --- | --- |
| 1 | `download.mjs` | Sources into `.cache/dictionary` (cached in CI). |
| 2 | `sources/*.mjs`, `assemble.mjs` | Words → uses (one per category; a second use only when separability or stress differs, as with *vóórkomen* / *voorkómen*) → senses. Glosses are shortened mechanically (`condenseGloss`): the most specific sub-gloss, its first listed meaning, no leading article, one short parenthetical. When two meanings shorten to the same gloss, the later one takes its next listed alternative. |
| 3 | `assemble.mjs` | Cross-checks per Wiktionary record. Article (*de bal* / *het bal* are separate records, so the dance keeps *het* as a sense-level override), plural, past tense and participle. Agreement makes a field *verified*; one source makes it *checked*; disagreement sends that record to the doubt queue. A *de/het* double (filter) counts as verified only when both sources state it. |
| 4 | `examples.mjs` | An example per sense. First choice is the Wiktionary usage example attached to that sense; for single-meaning words, a Tatoeba sentence; otherwise the model, with `--llm`. |
| 5 | `src/lib/dictionary/checks.ts` | Mechanical checks on every example: the word is found (spans saved, two for a split separable verb), de/het agrees for every noun in the sentence, every word is OpenTaal spelling, at most 18 words. The gloss rule: one meaning, at most 3 content words plus one parenthetical. |
| 6 | `llm.mjs` | With `--llm` and `ANTHROPIC_API_KEY`, via the Batches API. `claude-opus-5-5` shortens glosses that are still too long and picks among listed alternatives; the result must use only words from the source gloss (`selectedFrom`). It also writes missing examples (up to 3 attempts, then the doubt queue). `claude-sonnet-5-5`, a second model, checks that every generated and Tatoeba example uses the word in that sense. |
| 7 | `ids.mjs` | Stable sense ids, from a registry of source ids. A reworded gloss inherits the id of the vanished sense it resembles, so no learner loses a card. |
| 8 | `validate.mjs` | The gate: every published sense, every example, every key; plus the share of real Dutch (`data/coverage-corpus.txt`) whose words reach an entry, with a 95% floor. |
| 9 | `publish.mjs`, `static.mjs` | Supabase (upsert, then delete rows from older builds) and static shards for builds without Supabase. |

`npm run dictionary:build` takes about 30 s locally (without the model
step) and produces about 59k words, 75k senses and 238k search keys.

### Build output (`.cache/dictionary-build`)

- `words.jsonl`: published entries (`src/lib/dictionary/model.ts`, `WordEntry`)
- `keys.jsonl`: the search index (a word's own form, inflected forms,
  variants, an abbreviation's expansion)
- `doubt.jsonl`: everything held back, with the reason and a `priority`
  (`frequent` / `rare`)
- `report.json`: counts, also shown in the workflow summary
- `registry.json`: the sense-id registry

## On the server

`supabase/migrations/20261011120000_dictionary.sql`:

- `dict_words`: the full entry as JSON, plus a preview for suggestion rows
- `dict_keys`: prefix index (`text_pattern_ops`) and trigram index (`pg_trgm`)
- `dict_senses`: sense id → word, for refreshing deck copies
- `dict_sense_registry`, `dict_doubt`, `dict_builds`: service role only

The app calls read-only RPCs: `dict_suggest`, `dict_lookup`, `dict_fuzzy`,
`dict_parts`, `dict_words_get`, `dict_senses_get` and `dict_common`. Every
table is readable without an account (RLS); nothing is writable from the
app. `src/lib/dictionary/memorySource.ts` implements the same ordering for
tests and for the static shards, and a change to one is a change to both.

**Setup:** run the migration, then add `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` and (optionally) `ANTHROPIC_API_KEY` as
repository secrets, and run the **Dictionary** workflow once. Without a
Supabase project, the deploy workflow downloads the static shards from the
`dictionary-latest` release into `public/dictionary`.

## In the app

- `src/lib/dictionary/service.ts`: search (autocomplete), lookup (every
  lemma a form can be, with context ranking from the sentence), compound
  splitting. Results are cached per key.
- `src/lib/dictionary/units.ts`: units around a tapped word in Add from
  text (separable verbs, verb + preposition, expressions, `in- en uitvoer`).
- `src/lib/wordSources.ts`: the deck keeps a **snapshot of every sense** it
  holds, so practice works offline. A launch refreshes the snapshots from
  the dictionary, and fields the learner edited (`userEdited`) are never
  overwritten. Deck ids saved before the server dictionary (`aanslag#1`) keep
  their stored content: the frozen legacy dictionary (`src/data/legacy/`)
  is loaded once, only for such ids, to pin them. Those cards never get a
  snapshot, so a launch also fills in what they **lack** (an example, a
  noun's article) from the one dictionary sense their gloss names
  (`fillMissingDetails`): never a guess, never over a field that is already
  there or that the learner edited, and retried weekly when nothing matched.
- A word the dictionary doesn't have can be saved as a **personal word**,
  only with a translation, a word type and an example sentence (the sentence
  it was met in is offered); a noun's article is the learner's to state, or
  "Not sure" (`unknown`). A sense from the online dictionary keeps the
  page's own example and part-of-speech label.

## The doubt queue: who reviews it

After the first build, 19,173 entries are held back. 1,915 are
`frequent`, meaning words in the top 30k by frequency, and those come first.
The reasons:

| Reason | Count (first build) | What a reviewer does |
| --- | --- | --- |
| gloss: too long or more than one meaning | 5,531 (1,453 frequent) | Mostly resolved by running the model step; the rest need a short gloss written from the source gloss. |
| article: sources disagree | 595 (233 frequent) | Check the Woordenlijst (woordenlijst.org) and record the article. |
| plural / past tense / participle disagree | 189 (50 frequent) | Same: the Woordenlijst decides. |
| abbreviation: no English meaning for its expansion | 183 (48 frequent) | Write the English meaning (AOW → state pension). |
| spelling not in OpenTaal | 12,675 (131 frequent) | Usually right to exclude: archaic spellings, English words in the Dutch section. |
| example: failed checks 3 times / different sense | (model step) | Write or pick an example. |

`dict_doubt.status` takes `accepted`, `rejected` or `corrected`, with the
correction in `resolution`. **Open question:** someone has to own this
queue. The 1,915 frequent items are a few days' work for a Dutch-speaking
reviewer, less after a model-step build. The pipeline doesn't read resolutions back yet:
applying them to the next build (as an overrides layer between steps 3 and
5) is the next piece of work.

## Completeness audit

`npm run dictionary:audit` (`-- --build` for a full build, `--markdown` for
a table) counts what is **missing** rather than wrong: senses without an
example, examples without a translation, nouns without an article or with an
unverified one, uses without a part of speech. It lists the most frequent
incomplete words first, which is where to start. The Dictionary workflow puts
it in the run summary and keeps `audit.json` with the doubt queue. A build
without the model step now raises a warning annotation instead of passing
silently.

The first production build (12 Oct 2026) ran **without** the model step
(`ANTHROPIC_API_KEY` unset). Of 73,926 published senses, 18,246 have an
example: 6,605 from Wiktionary and 11,641 from Tatoeba. **57,183 have
none.** The fix is operational: set the secret and run the workflow with
`model` on. The model writes an example for each sense that has none, and
each one passes the same checks as a corpus sentence plus a second model's
same-sense check. Anything that fails three times goes to the doubt queue.

## Known data gaps (first build, without the model step)

- `zin hebben in` isn't a unit in either source, so "Ik heb zin in koffie"
  resolves to **zin hebben** ("to feel like"). The fixed preposition isn't
  stated by any source, and grammar isn't invented.
- **AOW** and **zzp'er** have expansions but no English meaning in any
  source, so they are not published until the model step or a reviewer adds
  one.
- **beschikking**: the administrative sense ("decision, ruling") sits in the
  second half of a long Wiktionary gloss. Only the model step can select it.
- About 60k of 75k senses have no example yet ("Example coming soon").
  Wiktionary gives 6.6k examples and Tatoeba 9.4k; the model step writes
  the rest.

The acceptance tests that depend on the model step
(`src/lib/dictionary/acceptance.test.ts`) run when the fixture comes from a
`--llm` build and are reported as skipped otherwise.
