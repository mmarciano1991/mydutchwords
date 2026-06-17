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

~22,700 Dutch→English words, fully bundled and offline, in two layers:

- **Curated core** (`src/data/dictionary.ts`) — ~158 common words hand-authored
  with `{ dutch, english, gender, example, exampleEn }`, i.e. correct `de/het`
  gender and a natural example sentence. Add more by appending to that array.
- **Full base** (`src/data/freedict.generated.ts`) — the rest of the dictionary,
  generated from the open **FreeDict nld-eng** dataset (CC-BY-SA). These have
  real English translations but no gender/example. Regenerate with
  `node scripts/gen-freedict.mjs` (reads the FreeDict TEI).

`dictionary.ts` merges the two (curated entries win) into one `DICTIONARY`.
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

## Out of scope

Spaced-repetition scheduling, audio pronunciation, photo/OCR capture, tags, and
sharing are deliberately deferred.
