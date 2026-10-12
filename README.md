# Woordkast

A mobile-first flashcard app for learning everyday Dutch. A Dutch→English
dictionary built from open sources (Wiktionary, OpenTaal, Tatoeba) gives
every meaning of a word its own English gloss, `de/het` article and example
sentence, and you build a personal deck by picking the meanings you want to
learn.

Built with **React + TypeScript + Vite**. Progress lives in `localStorage`
and, when a Supabase project is configured, syncs to the learner's account —
the app then requires signing in. Without one it runs fully offline, with no
account (see [`docs/auth-setup.md`](docs/auth-setup.md)).

## The loop

1. **A daily habit** — onboarding asks how much fits the day (Espresso 10,
   Ontbijt 20 or Diner 30 words) and when; a starter deck of 30 everyday
   words means the first session starts straight away.
2. **Add words** — look one up in the dictionary (every meaning is its own
   card), or paste a text and tap the words you don't know.
3. **Practice** — multiple choice, typing or a flashcard, depending on how
   well a word is known; a missed word comes back later in the sitting. Words
   move up a level ladder (1 → 3 → 7 → 14 → 30 → 90 days) as they're
   recalled on schedule.
4. **The day, then the week** — the goal is done once the day's words are,
   and the week is read as days done against a weekly target.

## The dictionary

About 59,000 Dutch words and 75,000 meanings, built from open sources and
served from Supabase. The full design is in
[`docs/dictionary.md`](docs/dictionary.md); the short version:

- **The unit is the sense, not the string.** `was` is a form of *zijn* and
  *wassen* and also the noun *de was*. Each meaning is its own entry with its
  own article, example and stable id, and the deck stores senses.
- **Facts come from data, never from a model.** Gender, plurals, verb forms
  and parts of speech come from English *and* Dutch Wiktionary. Where they
  agree a fact is *verified*; where only one states it, it is *checked*, and
  the app says so ("Article not verified yet"); where they disagree, it goes
  to the **doubt queue** and is not published.
- **The model only selects and condenses.** With an API key, the build can
  shorten a gloss using only words already in it, write an example for a
  meaning with none, and check (with a second model) that sentence and
  meaning match. Everything it writes passes the same mechanical checks as
  real sentences: spelling (OpenTaal), de/het agreement, the word found in
  the sentence, the gloss rule.
- **A declared gap beats a confident error.** A meaning without an example
  shows "Example coming soon", never another meaning's sentence.

### Building it

```bash
npm run dictionary:download   # sources into .cache/dictionary (~200 MB)
npm run dictionary:build      # → .cache/dictionary-build (add -- --llm for the model step)
npm run dictionary:validate   # every sense, every example, corpus coverage
npm run dictionary:inspect -- was bal   # read entries as text
npm run dictionary:static     # static shards in public/dictionary (no-Supabase builds)
npm run dictionary:publish    # Supabase (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
npm run dictionary:fixture    # the test fixture, from a real build
```

In production, the **Dictionary** GitHub workflow runs all of this weekly
and on demand. The schema and RPCs are in
`supabase/migrations/20261011120000_dictionary.sql`.

### Finding a word

Search is a combobox with suggestions as you type: exact matches first (an
inflected form counts, so `liep` → *lopen*), then words starting with the
query by frequency, then spelling variants, then "Did you mean…?" (learner
confusions such as ei/ij or g/ch cost half an edit), then a compound split.
A compound the dictionary lacks (`huurtoeslagaanvraag`) is split into
verified parts. Its article and plural come from the head, and its meaning
is labelled "Reconstructed meaning". In **Add from text**, a tap offers the
whole unit when there is one: `Ik bel je morgen op` → *opbellen*, `We wachten
op de bus` → *wachten op*, `in- en uitvoer` → *invoer* + *uitvoer*.

## Develop

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## Deploy

The `Deploy to Hostinger (Manual)` GitHub Action builds the app and uploads
`dist/` to `/public_html/mydutchwords/` over FTPS. Trigger it from the Actions
tab. Vite is configured with `base: "./"` so it works from that subfolder.

## Docs

- [`docs/dictionary.md`](docs/dictionary.md) — the dictionary: sources,
  pipeline, data model, search, the doubt queue and who reviews it.
- [`docs/auth-setup.md`](docs/auth-setup.md) — accounts and cloud sync via
  Supabase.
- [`docs/tts-setup.md`](docs/tts-setup.md) — the natural (Azure neural) voice
  for exercises, via a Supabase Edge Function.
- [`docs/pilot-survey.md`](docs/pilot-survey.md) — running a timed user test:
  querying which words each tester is learning, and building a survey from the
  ones the app calls mastered.
- [`docs/studies/`](docs/studies/) — synthetic first-run walkthroughs, one per
  build: whether the task script still matches the app before real
  participants see it. Start at the
  [index](docs/studies/README.md); the newest run holds the task script in
  force.
- [`docs/recommendations.md`](docs/recommendations.md) — what to do about the
  findings still open, with the reasoning and the comparable apps behind each.

## Out of scope

Photo/OCR capture, tags, and sharing are deliberately deferred.
