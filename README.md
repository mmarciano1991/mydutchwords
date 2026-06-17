# Woordkast

A mobile-first app for Dutch-learning expats. Words enter the app only through
your own lived experience — a sign, a letter, a colleague, an article. Capture a
Dutch word, get its meaning and an example sentence, then practise it until you
can use it confidently.

Built with **React + TypeScript + Vite** (state in `localStorage`) plus a tiny
**PHP proxy** so the app can translate any Dutch word and generate practice
sentences with Claude — without exposing an API key in the browser.

## The loop

1. **Dashboard** — shows your word count. Practice unlocks at 5 words; below
   that a locked state tells you how many more to add.
2. **Add Word** — type any Dutch word; Claude returns its meaning, `de/het`
   gender, and an example sentence. Duplicates are caught before saving.
3. **Dictionary** — all saved words, newest first, with gender chips; tap a word
   for its example.
4. **Practice** — fill-in-the-blank using a **fresh, AI-generated** sentence for
   each question (cached for variety + offline reuse).
5. **Practice Summary** — your score, then back to the dashboard.

The app builds **its own dictionary over time**: each word looked up is saved,
so it doesn't ship a fixed list — it learns the words users actually meet.

## AI backend (PHP proxy)

The browser never calls Anthropic directly. It POSTs to `api.php`
(`{ action: "lookup" | "exercise", word }`), which holds the key server-side and
forwards the request to Claude. This keeps the key off the client and stops
other sites from spending your budget (the proxy is same-origin only).

`public/api.php` is copied into `dist/` by Vite, so it deploys alongside the app
to `/public_html/mydutchwords/api.php`.

### Configuring the key

Provide the Anthropic key to the proxy in one of two ways (checked in order):

1. **Environment variable** `ANTHROPIC_API_KEY` on the host, or
2. a **`config.local.php`** file that `return`s the key (see
   `config.example.php`). Put it either next to `api.php` **or — recommended on
   Hostinger — one folder up** (`/public_html/config.local.php`), so manual
   deploys that overwrite the app folder never wipe your key.

`config.local.php` is gitignored and never committed. Get a key at
<https://console.anthropic.com/> → API Keys.

**Without a key configured, the app still works end-to-end** via a small offline
starter dictionary, so the full flow runs with zero setup. Live Claude
translations + fresh exercise sentences switch on automatically once the key is
present (check the status banner under **Settings**).

## Develop

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

## Deploy

The `Deploy to Hostinger (Manual)` GitHub Action builds the app and uploads
`dist/` (including `api.php`) to `/public_html/mydutchwords/` over FTPS. Trigger
it manually from the Actions tab. Vite is configured with `base: "./"` so it
works from that subfolder. Your `config.local.php` (the key) is uploaded
manually once and lives outside the deployed folder, so deploys don't touch it.

## Out of scope

Photo/OCR capture, audio pronunciation, spaced repetition / difficulty-weighted
ordering, onboarding walkthrough, tags, sharing, and notifications are
deliberately deferred.
