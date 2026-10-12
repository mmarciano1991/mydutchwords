# Learning engine (v2)

How Woordkast decides **what to ask**, **how to ask it**, and **what an answer does** to a word.

All learning rules live in one pure module, [`src/lib/learningEngine.ts`](../src/lib/learningEngine.ts). Every tunable number is in [`src/lib/learningConfig.ts`](../src/lib/learningConfig.ts). Screens call the engine and contain no learning rules of their own. For the design history and the decisions behind each rule, see [`LEARNING_ENGINE_PLAN.md`](../LEARNING_ENGINE_PLAN.md).

---

## 1. The five rules

| # | Rule | Where it is enforced |
|---|---|---|
| 1 | **A session grades each word once.** A missed word is asked again in the session's review queue, but those re-asks are logged ungraded. | `sessionQueue.ts`, `gradeWord` (`practice: true` on review answers) |
| 2 | **One graded result per word per local calendar day.** Later answers that day are logged, but change nothing. | `gradeWord` (`lastGradedDay !== today`) |
| 3 | **A failed word comes back the next calendar day at the earliest.** | `applyFailure` (`RESET_INTERVAL_DAYS = 1`) |
| 4 | **Flashcards are exposure, not evidence.** | `gradeWord` (`exerciseType !== "flashcard"`) |
| 5 | **Learned needs spaced evidence:** correct answers on ≥ 3 distinct days, at least one of them a production, and an interval of ≥ 7 days. | `applyCorrect` (promotion check) |

One more guard follows from these: a **correct answer on a word that isn't due yet** (pulled forward to fill a session) is not graded. An early **miss** is graded, because it is real evidence.

---

## 2. Architecture

```mermaid
flowchart TB
  subgraph UI["Screens (no learning rules)"]
    Dash["Dashboard<br/>Missed · Due · New"]
    Practice["Practice.tsx<br/>routes steps to exercise components"]
    Report["SessionReport"]
  end

  subgraph App["App.tsx (wiring)"]
    Begin["beginSession()"]
    Handle["handleAnswer()"]
  end

  subgraph Engine["learningEngine.ts (pure, takes `now`)"]
    Select["selectSessionWords()<br/>selectReplayWords()"]
    Plan["planExercises()"]
    Grade["gradeWord()"]
    Summary["dueSummary()"]
    Migrate["migrateWords()"]
  end

  Queue["sessionQueue.ts<br/>main queue + review queue"]
  Check["answerCheck.ts<br/>typed-answer verdicts"]
  Target["sentenceTarget.ts<br/>target form in a sentence"]
  Config["learningConfig.ts<br/>every number"]

  subgraph Persist["Persistence"]
    Deck[("deck<br/>per-word state")]
    Results[("results<br/>compact know/dontKnow log")]
    Run[("PracticeRun<br/>dailySet.ts")]
    Outbox[("review event outbox<br/>localStorage")]
  end

  subgraph Cloud["Supabase"]
    UserState[("user_state<br/>JSONB snapshot")]
    Events[("review_events<br/>append-only")]
  end

  Dash --> Summary
  Dash --> Begin
  Begin --> Select --> Plan --> Queue --> Practice
  Practice -- "typed answers" --> Check
  Practice -- "onAnswer" --> Handle --> Grade
  Plan -. uses .-> Target
  Engine -. reads .-> Config
  Queue -. reads .-> Config

  Grade --> Deck
  Grade --> Results
  Handle --> Run
  Grade -- "event" --> Outbox

  Deck & Results & Run --> UserState
  Outbox -- "flushReviewEvents()" --> Events
  UserState -- "on load / merge" --> Migrate --> Deck
  Practice --> Report
```

**Source of truth.** The per-word state in the deck is the operational truth. `review_events` is an audit and research log: it is never read back to change a word.

---

## 3. The word record

Every word carries its own learning state (`Word` in `learningEngine.ts`).

| Field | Meaning |
|---|---|
| `state` | `new` · `learning` · `learned` (the only states a learner sees) |
| `interval` | Days from the last graded review to the next. 0 while New. Capped at 180. |
| `ease` | Starts at 2.3, range 1.3–3.0. Scales the interval. |
| `dueDate` | Next review, always a **local midnight**. |
| `lastReviewedAt` / `lastGradedDay` | Time and local day of the last **graded** answer. |
| `reps` | Correct graded answers in a row. |
| `consecutiveFailures` | Failed graded answers in a row. |
| `lapses` | Failures after reaching Learning or Learned. ≥ 4 shows the **"Tricky"** tag. |
| `successfulReviewDays` | Distinct days with a correct graded answer. |
| `hasProductionSuccess` | Ever correct on Active Recall or Sentence Completion. |
| `evidenceTier` | 0–3, internal. Decides which exercises the word gets (§6). |
| `lastExerciseType` / `lastResult` | For variety, and for "Missed last time". |
| `listeningSkipped` | The last Listening was skipped, so the next exercise is not Listening. |
| `level` | Legacy 0–6, derived only for old readers (mastery bar, SQL view). Never used for decisions. |

---

## 4. Life of a word

```mermaid
stateDiagram-v2
  direction LR
  [*] --> New: captured

  New --> New: wrong / don't know<br/>(due tomorrow, tier 0)
  New --> Learning: first correct graded answer<br/>(interval 1 day)

  Learning --> Learning: correct<br/>(interval grows)
  Learning --> Learning: miss<br/>(interval 1, tier −1, lapse +1)
  Learning --> Learned: correct AND<br/>≥3 success days AND<br/>production success AND<br/>interval ≥ 7 days
  Learning --> New: 3rd miss in a row<br/>(reintroduced with a flashcard)

  Learned --> Learned: correct<br/>(interval grows, cap 180)
  Learned --> Learning: miss<br/>(interval 1, tier −1, lapse +1)
  Learned --> New: 3rd miss in a row
```

When a word drops back, its earlier evidence (`successfulReviewDays`, `hasProductionSuccess`) is **kept**, so it needs fewer days to be promoted again.

---

## 5. What one answer does: `gradeWord`

```mermaid
flowchart TD
  A["Answer: exerciseType + result"] --> P{"Practice round<br/>or review re-ask?"}
  P -- yes --> L["Logged, not graded"]
  P -- no --> F{"Flashcard?"}
  F -- yes --> L
  F -- no --> R{"Result is correct /<br/>almost / wrong / don't know?"}
  R -- "skipped (Listening)" --> S["Set listeningSkipped = true<br/>Logged, not graded"]
  R -- "exposure" --> L
  R -- yes --> D{"Already graded<br/>today?"}
  D -- yes --> L
  D -- no --> E{"Correct, but word<br/>not new and not due yet?"}
  E -- yes --> L
  E -- no --> G{"Correct or almost?"}
  G -- yes --> C["applyCorrect()"]
  G -- no --> W["applyFailure()"]
  C & W --> U["Stamp lastReviewedAt, lastGradedDay,<br/>lastExerciseType, lastResult;<br/>clear listeningSkipped"]
  U --> OUT["Return { word, event, graded: true }"]
  L & S --> OUT2["Return { word (unchanged), event, graded: false }"]
```

Every answer produces a **review event**, graded or not. Only graded answers are also appended to the compact `results` log (`correct`/`almost` → `know`, `wrong`/`dont_know` → `dontKnow`), which the habit, the reflection and "New today" read.

### 5.1 Correct answers: interval growth

Each exercise gives a kind of evidence, and stronger evidence earns a longer gap:

| Evidence | Exercises | Multiplier |
|---|---|---|
| Recognition | Multiple Choice, Matching, Listening, **and any "almost"** | × 1.4 |
| Contextual | Sentence Completion | × 1.8 |
| Production | Active Recall | × 2.3 |

```
elapsed  = calendar days since the last graded review (actual, not scheduled)
raw      = round(elapsed × multiplier × ease / 2.3)
interval = min(180, max(previous interval + 1, raw))
dueDate  = local midnight, `interval` days from today
```

- Using the **actual** elapsed days means an early review earns little and a late one earns more. The `interval + 1` floor guarantees growth.
- A **New** word's first correct answer skips the formula: it becomes Learning with interval 1.
- Ease rises by +0.05 only on a fully correct **production** answer. Other correct answers leave it alone.
- `evidenceTier` goes up by one when the exercise's own tier (recognition = 1, context/production = 2) is at least the word's current tier. Max 3.

### 5.2 Failed answers

| | Wrong | I don't know |
|---|---|---|
| Ease | −0.20 | −0.10 (an honest miss) |
| Due | tomorrow (local midnight) | tomorrow |
| `reps` | 0 | 0 |

Then, depending on the word:

- **New** → stays New, tier 0, back tomorrow with its flashcard intro.
- **3rd failure in a row** → back to New, tier 0, lapse +1.
- **Otherwise** → Learning, interval 1, tier −1 (minimum 1), lapse +1.

### 5.3 Worked example

A word answered correctly on every visit:

| Day | Tier before | Exercise | Calculation | State after | Interval | Next due |
|---|---|---|---|---|---|---|
| 1 | 0 | Flashcard intro, then Multiple Choice ✔ | first correct | Learning | 1 | day 2 |
| 2 | 1 | Multiple Choice ✔ | 1 × 1.4 = 1 → floor 2 | Learning | 2 | day 4 |
| 4 | 2 | Active Recall ✔ | 2 × 2.3 = 4.6 → 5 · ease 2.35 | Learning (interval < 7) | 5 | day 9 |
| 9 | 3 | Active Recall ✔ | 5 × 2.3 × 2.35/2.3 ≈ 11.75 → 12 | **Learned** (4 days, production, ≥ 7) | 12 | day 21 |

So the fastest path to Learned takes **4 separate days across about 9 calendar days**.

---

## 6. Which exercise a word gets: `planExercises`

### 6.1 Evidence tiers

```mermaid
flowchart LR
  T0["Tier 0<br/>never graded"] -->|"flashcard intro +"| REC
  T1["Tier 1<br/>recognition proven"] --> REC
  T2["Tier 2<br/>context proven"] --> PROD
  T3["Tier 3<br/>production proven"] --> PROD3

  REC["Multiple Choice<br/>Matching<br/>Listening"]
  PROD["Sentence Completion<br/>Active Recall"]
  PROD3["Active Recall (75%)<br/>Sentence Completion (25%)"]
```

Right after a miss, the word is asked one tier lower (`exerciseTierFor`).

### 6.2 Choosing for one word

```mermaid
flowchart TD
  W["Word"] --> T["Tier = evidenceTier<br/>(−1 if last answer was a miss)"]
  T --> C["Candidates = exercises for that tier"]
  C --> E["Keep only the eligible ones"]
  E --> Z{"Any left?"}
  Z -- no --> MC{"Multiple Choice<br/>eligible?"}
  MC -- yes --> M["Multiple Choice"]
  MC -- no --> FC["Flashcard only<br/>(exposure, ungraded)"]
  Z -- yes --> V["Prefer a different kind<br/>than lastExerciseType"]
  V --> T3{"Tier 3 and Active<br/>Recall available?"}
  T3 -- yes --> AR["75% Active Recall,<br/>else the other"]
  T3 -- no --> RND["Random among them"]
```

**Eligibility:**

| Exercise | Needs |
|---|---|
| Multiple Choice | 3 other deck words for distractors. A smaller deck tops up from the first 2,000 dictionary entries (same part of speech first, never synonyms). |
| Matching | A grid of 4–5 words |
| Listening | Audio setting on, audio for the word, and not skipped last time |
| Sentence Completion | A sentence where the target form appears exactly once (`sentenceTarget.ts`) |
| Active Recall | Always |

### 6.3 Building the session plan

1. Choose an exercise per word (above).
2. **Matching grid:** if fewer than 4 words drew Matching, convert enough Multiple Choice words that can match to reach 4 (preferring words whose last exercise wasn't Matching). Group into grids of 4–5; leftovers choose again without Matching.
3. **Units:** each tier-0 word gets an ungraded flashcard intro directly in front of its graded exercise. A Matching grid gets the intros of all its new words in front of it.
4. **Order:** shuffle the units, then greedily avoid two steps of the same kind in a row.

---

## 7. Which words a session asks: `selectSessionWords`

```mermaid
flowchart TD
  POOL["Deck minus words graded today"] --> P1
  P1["1 · Missed last time, now due<br/>(oldest due first)"] --> P2
  P2["2 · Learning, overdue<br/>(most overdue first)"] --> P3
  P3["3 · Learning, due today"] --> P4
  P4["4 · Learned, due"] --> P5
  P5["5 · New words, oldest captured first<br/>max 5 per session (missed New words count too)"] --> Q{"Session full?"}
  Q -- no --> P6["6 · Not yet due, closest to due first<br/>(a correct answer on these is not graded)"]
  Q -- yes --> OUT["Session words"]
  P6 --> OUT
  OUT --> CARRY["+ words deferred by the last session"]
  CARRY --> PLAN["planExercises()"]
```

- **Session size** = the habit commitment: Espresso **10** · Ontbijt **20** · Diner **30**. On a return day (after time away) it is a **5-word warm-up**.
- A **Missed** session (from "Missed last time" on the dashboard) is priority 1 only.
- When nothing is eligible, the dashboard says *"You're done for today"*. The user can still start a **practice round** (`selectReplayWords`: today's missed words, then today's others, then the rest of the deck). It is fully ungraded.

---

## 8. Inside a session: the queue

[`sessionQueue.ts`](../src/lib/sessionQueue.ts) runs the planned steps, then re-asks missed words.

```mermaid
stateDiagram-v2
  direction LR
  [*] --> awaiting
  awaiting --> completed: correct (graded)
  awaiting --> review: miss (graded)
  review --> completed: correct (re-ask, ungraded)
  review --> review: miss #2 (re-ask, ungraded)
  review --> deferred: miss #3<br/>(REVIEW_RETRY_LIMIT = 2 retries)
  completed --> [*]
  deferred --> [*]: handed to the next session
```

```mermaid
sequenceDiagram
  participant U as Learner
  participant P as Practice.tsx
  participant Q as sessionQueue
  participant A as App.handleAnswer
  participant E as gradeWord

  P->>Q: createQueue(plan)
  loop main queue, then review queue
    Q-->>P: current step
    U->>P: answers
    P->>A: onAnswer(wordId, type, result, final, review)
    A->>E: gradeWord(word, {practice: review})
    E-->>A: { word, event, graded }
    A->>A: save word · append event to outbox<br/>· append results if graded · record run answer
    P->>Q: answer(pass / miss) or skip()
    U->>P: Continue (after the context sentence)
    P->>Q: next()
  end
  Q-->>P: current = null
  P->>A: onFinish(carryOver)
  A->>A: run.deferred = carryOver → Report
```

- **Progress** = completed words ÷ all words. Retries can't inflate it, and it never goes down.
- A missed **Matching** word comes back as Multiple Choice. A **skipped Listening** word is asked straight away as Multiple Choice; the skip says nothing about knowing it.
- Leaving part-way keeps every answer so far. **Continue** resumes the exact remaining steps from the saved plan. Words still waiting for review are deferred to the next session.

---

## 9. Answer checking (typed answers)

[`answerCheck.ts`](../src/lib/answerCheck.ts) is used by Active Recall and Sentence Completion.

```mermaid
flowchart TD
  IN["Typed answer"] --> N["Trim · lower-case · collapse spaces"]
  N --> ART["Strip an optional leading article<br/>(wrong article still counts, right one shown)"]
  ART --> X{"Matches answer or a<br/>same-meaning deck word?<br/>(diacritics ignored)"}
  X -- yes --> OK["correct<br/>(spelling shown if accents differ)"]
  X -- no --> DF{"Sentence Completion and<br/>dictionary form typed?"}
  DF -- yes --> AL["almost"]
  DF -- no --> OW{"Typed text is another<br/>real Dutch word?"}
  OW -- yes --> WR["wrong"]
  OW -- no --> TY{"Damerau-Levenshtein<br/>≤ 1 (≤ 6 letters)<br/>≤ 2 (longer)?"}
  TY -- yes --> AL
  TY -- no --> WR
```

"Almost" is graded as correct, but only with the **recognition** multiplier (× 1.4) and no ease gain.

---

## 10. Days, streaks and the habit

```mermaid
flowchart LR
  S["Daily or Missed session"] --> FULL{"Every word in it<br/>has an answer?"}
  FULL -- yes --> DONE["doneDays += local day<br/>the session was finished"]
  DONE --> STREAK["Streak"]
  DONE --> WEEK["Weekly goal (3–7 days, Mon–Sun)"]
  DONE --> REM["Today's reminder cancelled"]
  PR["Practice round"] -. never counts .-> FULL
```

- A day is done when **one full session** is answered. Right, wrong, almost and "I don't know" all count.
- More sessions the same day are allowed while words are still eligible. They never re-ask a word graded today.

---

## 11. Storage, sync and the review log

```mermaid
flowchart LR
  subgraph Device
    LS[("localStorage<br/>deck · results · run · habit")]
    OB[("Outbox<br/>review events")]
  end
  subgraph Supabase
    US[("user_state<br/>one JSONB row per user")]
    RE[("review_events<br/>RLS: select + insert own only")]
  end
  LS <-- "useCloudSync<br/>(merge on load, flush on change / tab hidden)" --> US
  OB -- "flushReviewEvents()<br/>batches of 200, on conflict do nothing" --> RE
```

- **Offline-first.** Everything is written locally first, then synced when signed in.
- **Merging two devices:** per word, the copy with the latest `lastReviewedAt` wins, then the one with more evidence. `results` and `doneDays` are unioned. Runs are not blended: the newer day wins.
- **Review events** get a device-generated UUID, so retried flushes never duplicate rows. Each event is stamped with the user signed in at the time, and only that user's events are uploaded. Rows are never edited or deleted.

`review_events` columns: `id`, `user_id`, `word_id`, `session_id`, `occurred_at`, `local_date`, `exercise_type`, `result`, `graded`, `response_time_ms`, `state_before`, `state_after`, `interval_before`, `interval_after`, `received_at`.

---

## 12. Migration from v1

`migrateWords` runs on every local load and on every remote snapshot before it is merged. It is **idempotent**: a word with `engineVersion === 2` is returned untouched.

```mermaid
flowchart TD
  OLD["v1 word + its results history"] --> V{"engineVersion = 2?"}
  V -- yes --> KEEP["Unchanged"]
  V -- no --> SNAP["Freeze old values in `legacy`"]
  SNAP --> H{"Any correct history?"}
  H -- no --> NEW["New · tier 0"]
  H -- yes --> L3{"Correct on ≥ 3 distinct days<br/>AND last two ≥ 4 days apart?"}
  L3 -- yes --> LEARNED["Learned · tier 3"]
  L3 -- no --> LEARNING["Learning · tier 1<br/>interval and due date kept"]
```

The old "mature" state alone is never enough for Learned, because old correct answers may come from same-session re-showing. **Rollback:** `restoreLegacy()` puts the frozen values back on the client, and the server keeps a pre-v2 copy of every deck in `research.user_state_backup_engine_v2`.

---

## 13. Tuning reference

All values are in [`learningConfig.ts`](../src/lib/learningConfig.ts).

| Setting | Value |
|---|---|
| Initial / min / max ease | 2.3 / 1.3 / 3.0 |
| Ease gain (correct production) | +0.05 |
| Ease penalty: wrong / don't know | −0.20 / −0.10 |
| Multipliers: recognition / contextual / production | 1.4 / 1.8 / 2.3 |
| Max interval | 180 days |
| Reset interval (after a miss, first success) | 1 day |
| Learned: success days / min interval | 3 / 7 days |
| Failures in a row before reset to New | 3 |
| New words per session | 5 |
| Multiple Choice options | 4 |
| Dictionary fill for small decks | first 2,000 entries |
| Matching grid | 4–5 words |
| Listening options | 4 |
| Tier 3 Active Recall share | 75 % |
| Typo tolerance | 1 edit (≤ 6 letters), 2 edits (longer) |
| Review retries before deferring | 2 |
| Leech ("Tricky") threshold | 4 lapses |
