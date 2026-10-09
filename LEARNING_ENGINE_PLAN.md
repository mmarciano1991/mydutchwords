# Learning engine — Phase 0 plan

Status: **investigation only, no code changed.** Awaiting approval before Phase 1.
Baseline: `npm test` → 486 tests passing (note: vitest also collects the copies under `.claude/worktrees/`, which is why a run takes ~2.5 min; Phase 1 will add an `exclude` for that).

---

## 1. Findings

### 1.0 Platform and storage (affects several spec items)

- The app is a **Vite + React 18 web app** (`src/main.tsx`, `index.html`), deployed as static files (README: Hostinger subfolder). There is no React Native / Capacitor shell. "Mobile app" today means a mobile browser.
- **Storage is offline-first localStorage**, synced as **one JSONB snapshot row per user** in `public.user_state` (`deck`, `results`, `custom_words`, `daily_set`, `practice_run`, `habit`). See `src/lib/storage.ts`, `src/lib/cloudState.ts`, `src/lib/useCloudSync.ts`. There are no per-word SQL rows. The only SQL view is `user_word_progress` (`supabase/migrations/20260812093000_word_progress_views.sql`), which derives a tier from `level`.
- Two devices merge by union (`mergeState`). Per word, the copy with the higher `reps + lapses` wins (`pickDeckItem`).
- Consequence: **the word-state "migration" is a client-side data migration** (same pattern as the existing `migrateDeckItem` in `storage.ts`), applied to local data and to every remote snapshot that gets merged in. The SQL migration only adds the `review_events` table, a backup, and an updated view.

### 1.1 Word model and progress fields

`DeckItem extends Word` (`src/lib/types.ts`, `src/lib/learningEngine.ts`):

| Field | Meaning today |
|---|---|
| `id` | Sense key (`"aanslag"`, `"aanslag#1"`) |
| `dateAdded` | ms epoch of capture |
| `level` | 0–6 on the fixed ladder `1 → 3 → 7 → 14 → 30 → 90` days |
| `interval` | Days, derived from `level` |
| `reps` | Consecutive correct answers (reset to 0 on a miss) |
| `dueDate` | ISO string, normalised to **local midnight**. Already calendar-day based. |
| `lapses` | Total `dontKnow` answers, all-time. Drives the "Tricky" leech tag at ≥ 4 (`isLeech`). |
| `state` | `"new" \| "learning" \| "mature"` (mature = level 6) |
| `lastReviewedAt` | ISO string or null |

The word's content (`DictionaryEntry`) is resolved separately by id (`wordSources.resolveEntry`). It has `english`, `gender` (`de/het/none/unknown`), `example`, `exampleEn`, `senses[]`, and the optional `metIn` (the sentence the word was captured from).

The log is `results: PracticeResult[]` = `{ entryId, grade: "know" | "dontKnow", timestamp }`. It is append-only and unioned on sync. It is read by habit (`wordsPractisedOn`, `isReturning`, `backfillDoneDays`), the monthly reflection, and "New today" on the report. It does not record exercise type or session.

### 1.2 Where learning logic lives today

- `src/lib/learningEngine.ts` is already a pure module that takes `now` and has no I/O: `applyGrade` (ladder ±1), `buildSession`, `dueBreakdown`, `buildMissedSession`, `buildNextSession`, `markAsKnown` (unused), plus report helpers. Several of these are unused by the app (`dueBreakdown`, `buildMissedSession`, `buildNextSession`, `buildRestudySession`, `markAsKnown`).
- `src/lib/exercises.ts` holds the **same-session re-queue**: `advanceQueue` puts a missed word back `REQUEUE_GAP = 3` places later, and the sitting ends only when every word has been answered correctly. `pickExercise` chooses the exercise kind from `level`.
- `src/lib/dailySet.ts`: `DailySet` (word list drawn once per day) and `PracticeRun` (answers + `cleared` = got right eventually). A word only counts as "done" once it is `cleared`.
- **Learning rules are also spread across UI files**:
  - `src/screens/Practice.tsx` (`settle`) decides that only the first answer per sitting is graded, calls `applyGrade`, and handles `alreadyGraded` / warm-up ungraded mode.
  - `src/App.tsx` contains `nextWords`, `startExtra`, `practiseLearningAgain`, and the `warmup` / `scheduled` mode.
- Honest note: the existing code already avoids **grading** the retry (only the first answer per word per sitting goes onto the ladder, and later sittings the same day skip already-graded words). The usability problem is that the **sitting itself** won't end until the missed word is answered right, and the run/report treat "cleared" as done. Flashcard self-ratings do count as graded evidence today.

### 1.3 Session generation and size

- The session size comes from the habit's commitment: Espresso 10 / Ontbijt 20 / Diner 30 words (`habit.ts COMMITMENTS`). On a "return day" (≥ 3 days away) it shrinks to 5 (`RETURN_WARMUP_WORDS`). It is capped at deck size.
- `buildDailySet`: due reviews (leeches first, then most overdue) → new words (no cap beyond size) → top-up of not-yet-due words closest to due. It is drawn once per local day and persisted.
- "Today's goal" = N **distinct words** graded today (across any number of sittings), minus outstanding misses. `startPractice` serves the words still needed. "A few more" = 5-word extra rounds. Once every word has been graded today, extra rounds become ungraded "warm-ups" of the weakest words. The report offers "Go over those again", an ungraded re-drill of missed words.
- Resume: the run is persisted per answer. "Continue" rebuilds the remaining words (outstanding misses first, then the unpractised words of the day's set). The queue position itself is not persisted.

### 1.4 Exercises and answer checking (`Practice.tsx`, `exercises.ts`)

| Kind | Today | Spec |
|---|---|---|
| Flashcard | Front: article chip + Dutch + Dutch example; back: English + English example. The whole card is a `<button>` that toggles the flip, with a "Tap to flip" **hint text** (not a separate button). "Still learning" / "I knew it" are shown on **both faces** and are **graded onto the ladder**. Used for level ≥ 3 words. | Reveal only by tapping the card; buttons only after the flip; exposure only. |
| Multiple choice (`choice`) | **English prompt → 4 Dutch options.** Distractors from the deck, same rough part of speech first, excluding same-gloss words. Needs 3 distractors. | **Dutch word → 5 English options**; needs ≥ 4 other deck words. |
| Typing (`typing`) | English gloss + English example → type Dutch. "Don't know" button. | Active Recall: English + hint (part of speech, article for nouns). Check / "I don't know". |

`checkTyped`: normalises case, accents, punctuation and whitespace, silently strips a leading `de/het/een/'t`, accepts deck synonyms (other deck words with the identical gloss), and gives `typo` for ≤ 1 edit (incl. adjacent swap) on answers of **≥ 5 letters**, 0 edits on shorter ones.

There is no Sentence Completion, Matching or Listening.

### 1.5 Streak, weekly goal, reminders, onboarding, settings

- **Exists** (`src/lib/habit.ts`, `reminders.ts`, `screens/Onboarding.tsx`, `Settings.tsx`, `WeeklyGoal.tsx`):
  - `doneDays[]` (append-only, unioned across devices). A day is done when today's distinct-word goal is reached.
  - `currentStreak` (today not yet done doesn't break it).
  - `weekProgress` Mon–Sun, target 3–7 (default 4).
  - Reminder: an opt-in boolean + `time` (default `08:00`). Uses the browser `Notification` API via `setTimeout` in the open tab, so it only fires while a tab is alive. It is suppressed once today is done, but there is no "nothing eligible" check.
  - Return-day welcome-back, monthly reflection.
- **Onboarding runs before anything else** for a new user: Welcome → commitment → time → plan. It then **seeds a 30-word starter deck** (`src/data/starterWords.ts`) and drops the user straight into a first session.
- Settings already edits commitment (10/20/30), time, days a week, and reminder on/off.

### 1.6 Sentences and audio

- Dictionary example + translation: `src/data/examples.generated.ts` (lazy chunk, index-aligned). 14,131 of 14,211 entries have one.
- Measured just now: the example contains the **headword exactly once** for **11,106 (79 %)**. In **3,017 (21 %)** it appears only inflected (*gaan* → "Ik **ga** nu naar huis", *bloem* → "bloemen", *bier* → "biertje"). 8 contain it more than once. **No field stores the form as it appears in the sentence.**
- `metIn` (the captured sentence) is set **only by "Add from text"**, and it is **Dutch only, with no translation** (deliberately, per `types.ts`). The tapped token's exact form is known at capture time (`active.token.text` in `AddFromText.tsx`) but is **not stored**. Single-word Capture never sets `metIn`.
- Online (Wiktionary) words often have no example at all.
- `src/lib/deinflect.ts` already maps inflected forms → lemma candidates (plurals, verb conjugations, diminutives, separable prefixes). It can be reused to locate the target form in a sentence.
- **No pronunciation audio exists anywhere** in the app or data.
- **There is no structured part-of-speech field.** POS is guessed by `shapeOf` (`english` starts with "to " → verb; `de`/`het` → noun). Online senses sometimes carry a Wiktionary POS in `WordSense.label`.

### 1.7 Tests

- Vitest 2 + jsdom 30. Tests sit next to the code (`*.test.ts`). The engine tests already inject dates (`learningEngine.test.ts`, `dailySet.test.ts`, `habit.test.ts`).
- `src/App.habit.test.tsx` is an integration test of the full habit flow (onboarding → first session → goal → extra → week → return).
- CI (`.github/workflows/ci.yml`): `tsc -b`, `npm test`, dictionary validation.

---

## 2. Field-by-field mapping

Proposed: keep `Word` / `DeckItem` as the single per-word record, and **add** the new fields. The legacy fields are kept in a frozen `legacy` snapshot for rollback (§3).

| Spec field | Current source | New handling |
|---|---|---|
| `learningState` (`new/learning/learned`) | `state` (`new/learning/mature`) | **Reuse `state`**, renaming the value `mature` → `learned`. Migration decides the value (§3). |
| `intervalDays` | `interval` | **Reuse `interval`** (now free-form days, cap 180), no longer derived from a ladder. |
| `ease` | — (removed with the old SM-2) | **New**, default 2.3. |
| `nextReviewAt` | `dueDate` | **Reuse `dueDate`** (keep local-midnight normalisation). |
| `lastReviewedAt` | `lastReviewedAt` | Reuse. Only set by graded answers. |
| `lastGradedDay` | — (derivable from `results`) | **New** (`YYYY-MM-DD` local). |
| `consecutiveCorrect` | `reps` | **Reuse `reps`.** |
| `lapses` | `lapses` (all misses) | Reuse the name. **New semantics:** failures after reaching Learning/Learned. Migration recomputes it conservatively = old `lapses` (an upper bound, still OK for "Tricky"). |
| `consecutiveFailures` | — | **New**, migrated as 0, or the count of trailing `dontKnow`s in `results`. |
| `successfulReviewDays` | — | **New**, migrated from the count of distinct local days with a `know` in `results`. |
| `hasProductionSuccess` | — | **New**, migrated as `false` (the log has no exercise type). |
| `evidenceTier` | `level` (loosely) | **New** 0–3. Migration: 0 if `new`, else 1 (3 if migrated to Learned). |
| `lastExerciseType` | — | **New**, migrated as undefined. |
| (last result was wrong) | `reps === 0 && state !== "new"` | **New** `lastResult` (`correct/almost/wrong/dont_know`) so "Missed last time" is explicit rather than inferred. |
| `level` | ladder level | **Retired** from logic. Kept on the record (frozen) for old clients/sync and the SQL view. |
| `review_events` | `results` (partial) | **New table + local outbox** (§4). `results` keeps being appended for graded answers, because habit, reflection and "New today" read it. |

---

## 3. Migration strategy

**Client data migration** (`storage.ts` → new `migrateToEngineV2(item, results, now)`, pure, in the engine module):

1. Marker: an item with `engineVersion === 2` is returned untouched. This makes it **idempotent**: running it twice changes nothing.
2. Snapshot the old values into `legacy: { level, interval, reps, lapses, state, dueDate }` (never modified again).
3. `state === "new"`, or no `know` in `results` and `reps === 0`, → **New**, tier 0. `dueDate` is kept.
4. Any correct history → **Learning**, tier 1, `interval` = existing interval (uncapped, Q6), `ease` 2.3, `dueDate` kept.
5. **Learned only if** `results` shows `know` on ≥ 3 distinct local days **and** the gap between the last two such days is ≥ 4 days. Then tier 3. The existing `mature`/level 6 alone is **not** enough.
6. `successfulReviewDays`, `consecutiveFailures` and `lastGradedDay` are computed from `results`. No events are backfilled.

The migration is applied at three points: `loadDeck()` (local), `fetchRemoteState()` (remote snapshot before merging), and `mergeState` (defensive: either side may be from an older client). `pickDeckItem` changes to "latest `lastReviewedAt` wins, then the more evidence", because `reps + lapses` no longer orders the states correctly.

**Server (SQL migration `2026100xxxxxxx_learning_engine.sql`):**
- `create table if not exists public.user_state_backup_engine_v2 as select user_id, deck, results, now() as backed_up_at from public.user_state` (once, guarded). This is a server copy of every deck before any v2 client writes.
- `create table if not exists public.review_events (...)` with RLS **select + insert own only, no update/delete policy**. The client generates a uuid `id`, and inserts use `on conflict do nothing` so outbox retries are safe.
- Update the `user_word_progress` view to expose the new fields (it falls back to `level` for rows not yet migrated).

**Rollback:**
- Client: deploy the previous build. The old code reads `level/interval/reps/state/dueDate`, which v2 keeps writing in a compatible form (`state` `learned` → mapped back via `legacy`). A one-line `restoreLegacy()` script/console helper puts `legacy.*` back, if needed.
- Server: `update user_state s set deck = b.deck from user_state_backup_engine_v2 b where ...` (documented SQL), then `drop table review_events` only if the study data is not wanted. The backup table is dropped after the study.

---

## 4. Smallest set of changes

**Phase 1 — engine, config, log, migration (no UI beyond wiring)**
- `src/lib/learningConfig.ts`: every number in one place (multipliers 1.4/1.8/2.3, ease 2.3/±, caps 180 / 3.0 / 1.3, new-word cap 5, Learned thresholds, typo thresholds, MC/Matching minimums, session sizes).
- Rewrite `src/lib/learningEngine.ts` in place (same file, same `Word` type, extended):
  - `gradeWord(word, { result, exerciseType }, now)`: all scheduling rules, the one-graded-per-day guard, tiers, and Learned promotion. Returns `{ word, event }`, and the event has before/after fields.
  - `selectSessionWords(words, { size, kind: "daily" | "missed" }, now)`: priority 1–6, new-word cap, excludes words graded today.
  - `planExercises(words, ctx, rng)`: tier → eligible kinds → filters → variety → fallback chain; it also groups Matching sets and orders the result so the same kind doesn't appear twice in a row.
  - `dueSummary(words, now)`: missed / due / new / per-state counts.
  - `migrateToEngineV2`.
  - Delete `markAsKnown` (unused, and it contradicts "Learned needs spaced evidence") and the unused restudy/next-session helpers.
- `src/lib/answerCheck.ts` (split out of `exercises.ts`): Damerau-Levenshtein with the length thresholds, article right/wrong/missing, diacritics, and the dictionary-form → `almost` rule for Sentence Completion.
- `src/lib/sentenceTarget.ts`: finds the exact target form in a sentence (exact headword match, else a token whose `deinflect` candidates include the headword). Returns `null` when the form occurs 0 or > 1 times or when a separable verb is split.
- `src/lib/reviewEvents.ts`: local append-only outbox (localStorage) + flush to Supabase from `useCloudSync`.
- `exercises.ts`: `advanceQueue` / `REQUEUE_GAP` are used **only** for the ungraded practice round (Q7). Graded sessions walk their word list once.
- `dailySet.ts`: `PracticeRun` keeps `wordIds` + `answers` and gains `sessionId`, `kind`, `plan` (the exercise per word, for exact resume), and `completedAt`. `cleared` is dropped. `DailySet` is retired (kept as a nullable synced column, no longer written).
- Wire `Practice.tsx` / `App.tsx` to call the engine only (no grading rules in screens).
- Tests: everything in the spec's test list at engine level, with a simulated clock.

**Phase 2 — exercises.** Flashcard (one flip, buttons after the flip, exposure), MC reversed to 5 English options, Active Recall hint + "I don't know", Sentence Completion, Matching, Listening (+ Skip), audio setting, and context-sentence feedback after every graded answer.

**Phase 3 — sessions, dashboard, habit.** "Full session" drives `doneDays` (recorded with the completion day). The dashboard shows Missed / Due / New + a per-state count with text labels. Missed-words session, "done for today" empty state, session size taken from the commitment (10/20/30, Q4), the "Go over those again" practice round as exposure-only (Q7), settings questions moved to after the first session, reminder suppressed when nothing is eligible, and Browse/MasteryBar showing New / Learning / Learned (colour + text).

---

## 5. Gaps and conflicts with existing behaviour — decisions needed

These need your call before Phase 1. My recommendation is given for each.

| # | Conflict | Recommendation |
|---|---|---|
| **Q1** | **Web app, not native.** Reminders are browser notifications that only fire while a tab is alive. A true "local notification at that time" needs a native shell (Capacitor) or Web Push + a service worker + a backend sender. | Keep the existing in-tab reminder and implement the spec's timing rules (cancel on full session, skip when nothing is eligible). Treat reliable delivery as out of scope for this work, and say so in the study protocol. |
| **Q2** | **No pronunciation audio exists.** Listening is only eligible "if audio exists". | Use the browser's `speechSynthesis` with an `nl-NL` voice. Audio "exists" when such a voice is available on the device (this varies by device; many Android/iOS devices have one). Otherwise Listening is never selected. The alternative (Wiktionary audio files) adds network fetches and patchy coverage. |
| **Q3** | **Starter deck + onboarding-first** contradict "words enter only through capture" and "no questions before first capture". New users currently get 30 seeded words and four questions up front. | **DECIDED (yes):** Stop seeding the starter deck for new users. The first run lands on the existing empty-deck dashboard ("Add a word"). Move the session size / weekly goal / reminder questions to after the first completed session (with defaults pre-selected and one-tap accept). Keep the Onboarding screen but reorder it. Existing users with starter words keep them. |
| **Q4** | **Commitment (Espresso 10 / Ontbijt 20 / Diner 30) vs session size 10/15/20/25/30.** | **DECIDED:** keep the three commitments as they are. Session size = the commitment's word count (10/20/30). Sizes 15 and 25 are dropped from the spec. |
| **Q5** | **"Day done" = N distinct words (across sittings) vs spec "one full session".** Also, the return-day 5-word warm-up and "A few more" 5-word rounds. | **DECIDED (yes):** Adopt the spec: a day is done when any generated session is fully answered. Keep the return-day warm-up as a 5-word session (finishing it is a full session). Remove the 5-word "extra" rounds; "practise more" generates another normal session, which excludes words graded today. |
| **Q6** | **Migrated Learning words can carry long ladder intervals** (up to 90 days) while not being Learned. The spec says keep the existing interval. | **DECIDED: apply the spec as written.** Keep the existing `interval` and `dueDate` uncapped. |
| **Q7** | **"Go over those again" re-drill and ungraded warm-ups** re-show missed words the same day. | **DECIDED:** keep same-day practice of missed words. The graded session itself never re-tests a word (rule 1). After it, "Go over those again" starts a separate **practice round**: it re-queues a missed word until it's answered correctly, but every answer is logged as `exposure` and changes nothing in scheduling (rule 2). The word is still due the next day (rule 3), so next-day recall stays an honest measure. A practice round doesn't count as a full session for the streak or the weekly goal. |
| **Q8** | **Captured sentence (`metIn`) has no English translation**, but Sentence Completion must show the sentence translation. | Prefer `metIn` when it has an eligible target form, and show the **word's English gloss** as the hint instead of a sentence translation. Fall back to the dictionary example (with `exampleEn`) otherwise. |
| **Q9** | **The exact form isn't stored.** Storing the tapped token at capture is a 1-line change in `AddFromText.tsx`, but capture flows are out of scope. | Don't touch capture. Derive the form with `deinflect` (§4, `sentenceTarget.ts`), which handles the 21 % inflected dictionary examples too. If you'd rather allow the 1-line capture change, it makes `metIn` targets exact. |
| **Q10** | **Typo tolerance on short words.** Spec: distance 1 for ≤ 6 letters, so 3–4-letter words accept 1 edit (*dak* typed for *dag* = `almost`). | Implement as specified, plus one guard: if the typed answer is itself another word in the user's deck or the dictionary, it's `wrong`, not `almost`. |
| **Q11** | **No part-of-speech data** for the Active Recall hint / MC "same part of speech". | Use the existing `shapeOf` heuristic (verb / noun / other) and the Wiktionary label where present. Show the POS hint only when it's known (noun → "noun · het", verb → "verb"). Otherwise show no POS hint. |
| **Q12** | **`review_events` and offline/sync.** The app works offline, and Supabase is optional in builds without env vars. | Use a local outbox flushed when signed in. Events are written with the device's local date. For the study, require a signed-in build (it already is: `locked` gate). |
| **Q13** | **Two devices grading the same word on the same day while offline** can both count as "first graded of the day". | Accept it (rare). The merge keeps the copy with the latest `lastReviewedAt`, and both events stay in the log for analysis. |
| **Q14** | **"Tricky" leech tag** uses all-time `lapses ≥ 4`; the spec redefines `lapses`. | Keep the tag, computed from the new `lapses`. |
| Info | The monthly reflection, welcome-back and real-text coverage aren't in the spec. | Leave untouched. The reflection keeps reading `results`, which is still appended for graded answers (`correct`/`almost` → `know`, `wrong`/`dont_know` → `dontKnow`; exposure and skipped are not written there). |
| Info | The spec says magic-link auth; the app also has password sign-in/recovery. | Out of scope, untouched. |

---

## 6. Things that already match the spec (reused as-is)

- Pure engine module with an injected `now`, and local-midnight due dates (rule 3 is effectively already true for misses: due next local day).
- Only the first answer per word per sitting is graded, and later sittings skip words graded today (the basis for rule 2).
- Weekly goal 3–7 (default 4), Monday–Sunday, `doneDays` unioned across devices, streak logic, reminder time + on/off in Settings.
- Resume mid-session via the per-answer persisted run.
- MC distractors from the user's own deck, same rough POS, never same-gloss.
- Answer normalisation (case, diacritics, whitespace) and adjacent-swap typo handling.
- `deinflect.ts` for locating inflected forms; `tokenizeText.ts` for sentence tokens.

**Stopping here for your approval**, in particular of Q1–Q9.

---

## Phase 1 status — done (2026-10-06)

`tsc -b` clean · `npm test` 253/253 passing · `vite build` OK.

**Deploy order:** apply `supabase/migrations/20261006120000_learning_engine.sql` **before** deploying the app. The server backup must be taken before any v2 client writes a deck.

**Deviations from the spec**
1. **Early-review interval.** The engine uses the actual elapsed days, not `max(elapsed, interval)`. With the max, an early review earns exactly the on-time interval, which contradicts the spec's own intent and its "early review earns a smaller interval" test. Late and on-time reviews are unaffected. (`learningEngine.ts`, `nextInterval`)
2. **Tiny decks.** Per the spec's fallback chain, a New word in a deck of fewer than 5 words gets only a flashcard (exposure), so it can't become Learning until the deck reaches 5. Matching/Listening in Phase 2 won't change that for 1–3 words. Flagged for decision; an option is to allow Active Recall as a fallback before the flashcard.
3. **Phase boundary.** The "full session" day rule (Q5), session size from the commitment (Q4), and the exposure-only practice round (Q7) were wired in Phase 1, not Phase 3. They're inseparable from removing the re-queue: without them a missed word would block the day forever.
4. The spec's `timestamp` column is named `occurred_at` (a reserved word), and `graded` was added so analysis can tell the day's scheduling answer from later exposure.
5. `lastResult` and `listeningSkipped` were added to the word, so "Missed last time" and "next exercise isn't Listening" are explicit fields rather than inferred.

**Not yet (by phase):** Phase 2 adds the new exercises, answer checking, single-flip flashcard and audio setting. Phase 3 adds the dashboard split, empty state copy, starter-deck removal and onboarding move (Q3), reminder suppression, and the New/Learning/Learned labels.

## Phase 2 status — done (2026-10-06)

`tsc -b` clean · `npm test` 294/294 passing · `vite build` OK. Not yet checked by eye in a browser.

**Exercises:** Flashcard (one flip, rate after flipping, exposure), Multiple Choice (Dutch → 5 English), Active Recall (POS hint, "I don't know"), Sentence Completion, Matching, Listening (+ "Can't listen now"). Each is its own component in `src/components/exercises/`; `Practice.tsx` only routes steps. Answer checking is in `lib/answerCheck.ts`; target forms are in `lib/sentenceTarget.ts` (reuses `deinflect`); audio is in `lib/audio.ts`. The "Audio exercises" setting is in Settings and synced with the habit.

**Deviations / decisions**
1. **Continue after every answer.** Correct answers no longer auto-advance after 0.9 s. Every graded answer now ends on its context sentence (spec), and a timed auto-advance wouldn't leave time to read it (and would be a WCAG 2.2.1 timing issue).
2. **Matching shows sentences for missed pairs only.** A grid of 4–5 sentences after every Matching exercise would be heavy; correct pairs are confirmed in place.
3. **Active Recall prompt** shows the English word + hint only. The English example sentence that the old typing prompt showed was dropped, per the spec.
4. **Sentence Completion blank** is as wide as the missing form (a small length hint).
5. **Small decks (from Phase 1, still open):** kept as specced. With fewer than 5 words, New words get only a flashcard.
6. **Speaker icon** (`VolumeUp`) was added to `src/icons` by hand from Material Symbols. It should be re-exported from the Figma icon page.

## Phase 2 follow-up (2026-10-06)

The flashcard was reverted to its pre-Phase-2 interaction at the user's request: rating on both faces, "Still learning" / "I knew it", "Tap to flip" hint. It is still logged as exposure only (rule 4).

## Phase 3 status — done (2026-10-06)

`tsc -b` clean · `npm test` 308/308 passing · `vite build` OK. Not yet checked by eye in a browser.

- **Capture-first first run (Q3).** No starter deck and no questions. A new user starts on the "Add a word" screen with an unconfirmed default habit (`defaultHabit`, `setupDone: false`, `updatedAt: 0`, so synced real preferences always win a merge).
- **Setup after the first full session.** The existing onboarding questions were moved, not deleted (`screens/Onboarding.tsx`). It's one screen with the defaults (Espresso · 4 days · no reminder), one tap "Sounds good", and "Change" to walk through session size → days a week → reminder. A weekly-goal step was added. Existing users count as already set up.
- **Dashboard.** The review queue shows "Missed last time" (starts a Missed-words session), "Due for review" and "New words" (start the Daily session), and New / Learning / Learned totals with text labels. When nothing is eligible: "You're done for today — new words will be ready tomorrow."
- **Labels.** The mastery bar in the deck and lookup reads New / Learning / Learned (colour + text).
- **Reminders.** Off until set. Today's reminder is cancelled by a full session and skipped when nothing is eligible; there are none with an empty deck. Delivery is still the in-tab browser notification (Q1).
- **Copy.** The cue and "See you tomorrow" name a time only when a reminder is set. The weekly goal screen says "words a session".
- `src/data/starterWords.ts` was removed (unused).

**Open:** decks under 5 words (see the recommendation in the Phase 3 hand-off).

## Phase 3 follow-up (2026-10-06)

`tsc -b` clean · `npm test` 307/307 passing · `vite build` OK.

- **Onboarding restored, at the user's request.** It's back at first launch, before anything else (welcome → session size → time → plan), as it was before Phase 3. This overrides the spec's "no questions before the first capture". The post-session setup screen and `setupDone`/`defaultHabit` were removed. The starter deck stays removed (Q3): a new user's plan screen ends on "Add my first word"; a user who already has words starts their first session. The cue ("Your Dutch at 08:00") and "See you tomorrow at …" use the onboarding time again, independent of the reminder toggle. The reminder stays off until turned on in Settings.
- **Decks under 5 words: resolved (option 1).** Multiple Choice tops up its distractors from the first `MC_DICTIONARY_FILL_WORDS` (2000) bundled dictionary entries, same part of speech first, never synonyms, and only when the deck can't supply them itself. A user's very first word can now become Learning in its first session. This is a deliberate exception to the spec's "distractors come from the user's own deck".
