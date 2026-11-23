# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile-first React web app. A Capacitor shell for iOS and Android is planned (`src/lib/platform.ts`); it wraps the same web design language and does not switch to native iOS/Android patterns.

## Users

English-speaking expats and internationals living in the Netherlands. They meet real Dutch every day (a letter from the municipality, a news article, a sign, a message from school), they are busy, and they learn in a few minutes a day. The job: understand and keep the Dutch words that actually turn up in their life, without studying a course.

The design test for any change: would a tired, busy, slightly unmotivated person still find today easy enough to do?

## Product Purpose

Woordkast turns the Dutch words a learner meets into a personal flashcard deck and makes reviewing it a small, predictable daily habit. Success is a habit that lasts, measured by words truly recalled, not by screen time. The product should, in the long run, make itself less necessary.

## Positioning

Two things together, neither of which a typical Dutch course or gamified vocabulary app can honestly claim:

1. **Words you actually meet.** The deck is built from words the learner looks up or taps in a real text (Add from text), not from a fixed curriculum. A 30-word starter deck exists only so the first session can start immediately.
2. **Habit, not engagement.** A small daily goal that is done once it's met, consistency read per week, no shame, no XP, and a goal that never grows by itself.

## Operating Context

- Learners open the app in short gaps in the day, mostly on a phone.
- Onboarding asks how much fits the day and when. Daily goal sizes (`src/lib/habit.ts`): **Espresso** 10 words / ~5 min, **Ontbijt** 20 / ~10 min, **Diner** 30 / ~15 min.
- The loop: add words (dictionary lookup, or paste a text and tap unknown words) → practise (multiple choice, typing, flashcard, article, verb form, matching, depending on how well a word is known) → words climb a level ladder (1 → 3 → 7 → 14 → 30 → 90 days) → the day is done, then the week is read as days done against a weekly target.
- A 14-day pilot with real testers is the current evaluation setting (`docs/pilot-survey.md`, `docs/pilot-readiness-report.md`); synthetic first-run walkthroughs are kept per build in `docs/studies/`.

## Capabilities and Constraints

- **The unit is the sense, not the string.** About 59,000 words and 75,000 meanings; each meaning has its own English gloss, de/het article, example and stable id, and the deck stores senses.
- **Facts come from data, never from a model.** Grammar facts are *verified* (both Wiktionaries agree), *checked* (one source; the UI says "Article not verified yet"), or held back in the doubt queue. The model may only select, condense, and write examples that pass mechanical checks.
- **A declared gap beats a confident error.** A meaning with no example shows "Example coming soon", never another meaning's sentence. A compound the dictionary lacks is labelled "Reconstructed meaning".
- **The learner can correct the app.** Translations and examples are editable before and after saving.
- Search: combobox with exact/inflected matches first, then prefix by frequency, spelling variants, "Did you mean…?", and compound splitting.
- Progress lives in `localStorage` and syncs to a Supabase account when configured; the app then requires sign-in (email, Apple, Google). Without Supabase it runs fully offline.
- Optional natural voice (Azure neural TTS via an Edge Function); opt-in research log.
- Design tokens come from the Figma design system (`design/figma-tokens.json` → `npm run tokens` → `src/styles/tokens/tokens.json`). Never add a token only in code.
- Deployed as a static build to a subfolder (`base: "./"`).
- Deliberately out of scope: photo/OCR capture, tags, sharing.

## Brand Commitments

- Name: **Woordkast**. Tagline in use: "Dutch words, kept like fine china." Welcome copy: "Capture the Dutch words you meet, then practise them as flashcards."
- Existing identity is Delft Blue, with a tulip medallion mark (`src/components/brand.tsx`) and self-hosted Spectral + Hanken Grotesk (`src/assets/fonts`). These are incumbent assets, not part of the positioning the user chose.
- Habit-goal names are Dutch meal words (Espresso, Ontbijt, Diner).
- Voice: calm, plain, warm. No urgency, no guilt, no "you lost…" copy.
- Exception the user chose: the dashboard topbar shows a day-streak counter next to days-done-this-week. Keep it, but add no streak shaming or loss copy anywhere.

## Evidence on Hand

- Dictionary sources and licences: English and Dutch Wiktionary (CC BY-SA 4.0), Tatoeba (CC BY 2.0 FR), OpenTaal, a frequency list; credited in `src/screens/About.tsx`.
- Synthetic walkthrough runs 01–05 (`docs/studies/`) and the findings response (`docs/recommendations.md`).
- Pilot readiness audit (`docs/pilot-readiness-report.md`) and the pilot survey workflow (`docs/pilot-survey.md`).
- Privacy policy (`public/privacy.html`), GDPR-based with the operator in the Netherlands, and the store privacy labels (`docs/app-privacy.md`).
- No real user testimonials, usage numbers, press, or reviews exist yet. Do not invent them.

## Product Principles

1. **Small enough to do on a bad day.** One primary action on opening, no decision needed. The day is done at the chosen goal; anything beyond is "extra" and never raises tomorrow's goal.
2. **Consistency over streaks.** Show days done against a weekly target. Returning users get a warm welcome with no count of days away, and the 5-word warm-up completes that day.
3. **Rewards are real learning.** Words by name, and how much of a real letter the learner can now read. No XP, points, or badges for their own sake.
4. **The app proposes, the learner disposes.** Show context and confidence honestly, flag gaps, and let the learner correct a meaning.
5. **Every choice is reversible.** Every onboarding choice can be changed in Settings without losing history.

## Accessibility & Inclusion

- Target WCAG 2.1 AA. The pilot readiness audit already checked contrast, labels, focus, and text resize against it.
- Text sizes in rem and pinch-zoom allowed. Respect `prefers-reduced-motion` (already in `src/styles/app.css`).
- Users read English as the interface language and are learning Dutch, so Dutch words must always come with their gloss and article in context.
