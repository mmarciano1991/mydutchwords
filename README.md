# Woordkast

A mobile-first flashcard app for learning everyday Dutch. It ships with a
built-in Dutch→English dictionary — each word has its English meaning, `de/het`
gender, and a natural example sentence — and you build a personal deck by
picking the words you want to learn.

Built with **React + TypeScript + Vite**. Progress lives in `localStorage`
and, when a Supabase project is configured, syncs to the learner's account —
the app then requires signing in. Without one it runs fully offline, with no
account (see [`docs/auth-setup.md`](docs/auth-setup.md)).

## The loop

1. **A daily habit** — onboarding asks how much fits the day (Espresso 10,
   Ontbijt 20 or Diner 30 words) and when; a starter deck of 30 everyday
   words means the first session starts straight away.
2. **Add words** — look one up in the 14k-word dictionary, or paste a text
   and tap the words you don't know.
3. **Practice** — multiple choice, typing or a flashcard, depending on how
   well a word is known; a missed word comes back later in the sitting. Words
   move up a level ladder (1 → 3 → 7 → 14 → 30 → 90 days) as they're
   recalled on schedule.
4. **The day, then the week** — the goal is done once the day's words are,
   and the week is read as days done against a weekly target.

## The dictionary

14,211 Dutch→English words and 16,017 distinct meanings, fully bundled and
offline.

### Completeness

The dictionary is checked, not trusted. `npm run validate` fails the build if
any word is missing a meaning, a translation, an example or (for a noun) its
article — and `npm run build` runs it first, so an incomplete entry cannot
ship. Two ideas do most of the work:

- **An article is `de`, `het`, `none` or `unknown`.** "Takes no article" and
  "nobody established the article" used to be the same value, so a noun with a
  missing `de/het` looked exactly like a verb that never needed one. Separating
  them made the gap countable (80 words today, and capped), and lets the app
  show a `de/het?` chip instead of silence.
- **You cannot list the words that are missing.** So completeness is measured
  instead: `data/coverage-corpus.txt` holds real Dutch — municipal letters,
  news, everyday speech — and the validator requires that a set percentage of
  it resolves through the real lookup pipeline. That check is what catches a
  missing word; no rule about the shape of the data ever could.

### Meanings

A word is not the unit of meaning — a sense is. `aanslag` is a tax assessment
*and* an attack, and each meaning carries its own article, example sentence and
optional context note. Deck cards are keyed by meaning (`aanslag`,
`aanslag#1`), so the same Dutch word can be learned twice with independent
progress instead of the second meeting being answered with "you already have
this word".

### Finding a word

Real Dutch text almost never contains a headword. Three layers sit in front of
the dictionary, in order of how much they can be trusted:

1. **`src/lib/deinflect.ts`** — verb, noun and adjective morphology, plus
   tables for what no rule can derive (`gelopen` → `lopen`).
2. **`src/lib/decompose.ts`** — compound splitting. Dutch builds words
   productively, so `belastingaanslag` can never be in any list; it is
   `belasting` + `aanslag`, and the last part carries the meaning and article.
3. Spelling suggestions, then the online dictionary.

Each step short-circuits the ones below it: a guess about typing must never be
offered next to an answer grammar can justify.

### Authoring

Sources live in `data/` and are **build inputs — never shipped as-is**:

- **`data/curated.ts`** — the hand-authored core: `{ dutch, english, gender,
  example, exampleEn }`, i.e. correct `de/het` gender and a natural example
  sentence. Add words by appending here. `gender` is never blank: use `"none"`
  for anything that isn't a noun.
- **`data/freedict.source.ts`** — the open **FreeDict nld-eng** dataset
  (CC-BY-SA), translations only. Regenerate with `node scripts/gen-freedict.mjs`
  (reads the FreeDict TEI).

After editing either, run:

```bash
npm run dictionary
```

### What actually ships

That script writes two modules into `src/data/`, and the split is the point:

- **`core.generated.ts`** — every word, gloss and gender. Loaded up front,
  because search, suggestions and the deck all need the whole list.
- **`examples.generated.ts`** — the example sentences, ~68% of the data but
  only ever read one word at a time. Loaded as a **separate chunk** once the
  app is interactive, which keeps ~370 kB gzip off the critical path. Until it
  arrives (or if it fails) words simply show without their sentence; nothing
  blocks on it.

The script also drops the ~9,900 FreeDict entries the curated list already
covers — they contributed 118 new words for 111 kB gzip — and encodes both
files as delimited strings rather than object literals, which roughly halves
the bytes and parses far faster than 14k object literals.

Flashcards work for every word (Dutch ⇄ translation); the example sentence and
gender chip show only where present. Where an entry is thinner than the curated
core — from the FreeDict import, split out of a packed gloss, or fetched
online — the app says so in one line rather than leaving it looking damaged.

### Filling the gaps

The validator names roughly 2,750 remaining gaps (meanings with no example,
articles never established, examples that don't use their word). Too many to
write by hand, so there is a pipeline — and it cannot ship anything unreviewed:

```bash
npm run complete -- --kind=article --limit=20        # dry run, costs nothing
npm run complete -- --kind=article --limit=20 --run  # asks the model
npm run promote                                      # dry run
npm run promote -- --write                           # applies what you approved
```

Proposals pass a mechanical gate first (`src/lib/proposalCheck.ts`, unit
tested): the article must be real and must agree with the sentence, and the
example must actually use an inflected form of its own headword. What survives
lands in `data/generated/pending.json` with `"approved": false` and goes no
further until a person changes that. Anything promoted is marked
`source: "generated"` so the app can say where it came from.

The reason for the two gates is the failure this app has already had: a wrong
meaning that arrived looking exactly like a right one (`aanslag` glossed as an
assassination on a letter about a tax bill). Generating at scale without review
would trade missing information for confident misinformation, which is worse
for a learner who cannot yet tell the difference.

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

- [`docs/auth-setup.md`](docs/auth-setup.md) — accounts and cloud sync via
  Supabase.
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

Audio pronunciation, photo/OCR capture, tags, and sharing are deliberately
deferred.
