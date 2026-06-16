# Woordkast

A mobile-first app for Dutch-learning expats. Words enter the app only through
your own lived experience — a sign, a letter, a colleague, an article. Capture a
Dutch word, get its meaning and an example sentence, then practise it until you
can use it confidently.

This repository is a **thin vertical slice** (demoable end-to-end loop), not the
full MVP. Built with **React + TypeScript + Vite**, state persisted to
`localStorage`, no backend.

## The loop

1. **Dashboard** — shows your word count. Practice unlocks at 5 words; below
   that a locked state tells you how many more to add.
2. **Add Word** — type a Dutch word; it's translated and given an example
   sentence. Duplicates are caught before saving.
3. **Dictionary** — all saved words, newest first; tap a word for its example.
4. **Practice** — fill-in-the-blank using each word's example sentence.
5. **Practice Summary** — your score, then back to the dashboard.

## Translation (Approach A)

On capture, the app makes a single Claude call asking for
`{ translation, example_sentence }`. This keeps capture to one field and gives
the fill-in-the-blank exercise a real sentence.

There is **no backend** in this slice, so the Claude call is made directly from
the browser using a key you provide:

- Add an Anthropic API key under **Settings** (stored only in `localStorage`), or
- set `VITE_ANTHROPIC_API_KEY` (and optionally `VITE_ANTHROPIC_MODEL`) at build time.

**Without a key the app still works end-to-end** via a small built-in offline
dictionary, so the full demo flow runs with zero setup. The offline path gives
real translations for a set of common words and a usable templated sentence for
anything else.

## Develop

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## Deploy

The `Deploy to Hostinger (Manual)` GitHub Action builds the app and uploads
`dist/` to `/public_html/mydutchwords/` over FTPS. Trigger it manually from the
Actions tab. Vite is configured with `base: "./"` so it works from that
subfolder.

## Out of scope for this slice

Photo/OCR capture, audio pronunciation, grammatical gender display, spaced
repetition / difficulty-weighted ordering, onboarding walkthrough, tags,
sharing, and notifications are deliberately deferred.
