# Woordkast

A mobile-first flashcard app for learning everyday Dutch. It ships with a
built-in Dutch→English dictionary — each word has its English meaning, `de/het`
gender, and a natural example sentence — and you build a personal deck by
picking the words you want to learn.

**Fully offline.** Built with **React + TypeScript + Vite**, state in
`localStorage`. No backend, no account, no API, nothing to pay for.

## The loop

1. **Dictionary** — browse/search the ~160-word built-in dictionary; tap **+**
   to add a word to your deck.
2. **Your words** — the deck you've built; tap a word for its example, or remove it.
3. **Practice** — flashcards: see the Dutch word, tap to flip for the
   translation + gender + example, then rate yourself "Still learning" or
   "I knew it".
4. **Practice Summary** — how many you knew, then back to the dashboard.

## The dictionary

14,193 Dutch→English words, fully bundled and offline.

### Authoring

Sources live in `data/` and are **build inputs — never shipped as-is**:

- **`data/curated.ts`** — the hand-authored core: 14,075 words with
  `{ dutch, english, gender, example, exampleEn }`, i.e. correct `de/het`
  gender and a natural example sentence. Add words by appending here.
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
gender chip show only where present (the curated core).

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

- [`docs/auth-setup.md`](docs/auth-setup.md) — optional accounts and cloud
  sync via Supabase.
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

Spaced-repetition scheduling, audio pronunciation, photo/OCR capture, tags, and
sharing are deliberately deferred.
