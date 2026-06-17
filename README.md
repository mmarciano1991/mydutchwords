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

The dictionary lives in `src/data/dictionary.ts` — a plain array of
`{ dutch, english, gender, example, exampleEn }`. It's authored by hand
(translations, correct `de/het`, and example sentences) so the whole app works
offline with no generation at runtime. **Adding words is trivial** — append
entries to that array and rebuild.

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
