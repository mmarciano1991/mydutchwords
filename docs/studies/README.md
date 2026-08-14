# Synthetic walkthrough studies

One study per build. Before a build goes in front of real participants, a
synthetic first-time user attempts the core tasks against it and reports where
the task script stops matching the app.

These runs do **not** measure usability. They check that the script and the
happy path are logically coherent — that every task has a path, that no step
assumes a screen or an account the flow never established, and that no label
means two things. Real friction is measured with real people.

## Index

| Run | Build | Date | Verdict |
| --- | --- | --- | --- |
| [01](./run-01-ba49d8e.md) | `ba49d8e` | 2026-08-13 | T1 completes with heavy friction · T2 has no path · T3 loops at the exit |
| [02](./run-02-c5b3d62.md) | `c5b3d62` | 2026-08-13 | Entry and practice copy repaired · T2 still has no path · T3 still loops at the exit |
| [03](./run-03-43a1fdd.md) | `43a1fdd` | 2026-08-13 | T3 completable in every direction · account dead-ends closed · T2 still has no path · T1 blocked on words, not buttons |
| [04](./run-04-795d03e.md) | `795d03e` | 2026-08-13 | First run on the deployed build, image capture out of scope · T2 walked as a typed task: 3 of 7 letter words wrong, one with a confirming example |
| [05](./run-05-f4f6ecd.md) | `f4f6ecd` | 2026-08-14 | First run with a real article (T1) and Google-account scenarios · every run-04 wrong-sense finding closed · new bug found inside 3b: `sloten`/`beken` deinflect to the wrong real word with full confidence |

Findings are the runs' job; deciding what to do about them is not.
[`docs/recommendations.md`](../recommendations.md) holds the proposed
solutions, grounded in what comparable apps do — a living document, revised as
items ship, unlike the runs.

## The convention

**A run is frozen once written.** It records what the app did on one build, so
it stays evidence. When a finding is later fixed, the fix is noted in the
run's "Fixed since this run" appendix — the finding itself is never edited
away. A run whose findings are silently updated stops being a record of
anything.

**A new build gets a new run.** Copy `template.md` to
`run-NN-<short-sha>.md`, walk the tasks again, and add a row above. Each run
carries a *Since the last run* section, because the useful signal after run 01
is the delta: did the fix land, and what is now the worst thing.

**Name runs by build, not by date.** Two runs can share a day; they can't
share a commit.

**Don't renumber.** Run 01 stays run 01 even after the app has moved on.

## Terminology

The client's own study plan calls the first real-participant session **Study
2**. These synthetic passes are therefore numbered **runs**, not studies, so
the two never collide in conversation. Run 01 preceded Study 2; further runs
sit between builds.

## Standing protocol

The parts below are *living* — carry them into each new run and revise them as
the app changes. Everything inside an individual run file is frozen.

### Persona

An expat living in the Netherlands, actively learning Dutch as a second
language. Not a formal student — motivated by wanting to feel less lost in
daily life (reading signs, letters, conversations). Moderate smartphone
fluency, no familiarity with this app, no account.

The run is performed in character, one task at a time, stating what is
expected before each action and what actually happened after it. The
participant is deliberately **not** charitable: wherever a moderately patient
but busy person would hesitate or give up, the run says so and says why.

### Out of scope for every run

Not gaps to be re-reported each time — decisions. A run that flags one of
these is wasting the reader's attention:

- **Capture from an image** — camera, gallery picker, OCR. Deferred as a
  product decision (`README.md`), so task 2 is a **typed** capture task from a
  real letter or sign: the artefact still comes from the participant's life,
  the words are still the ones a letter produces, and only the input method
  changes. Revisit only if capture-from-image ships.
- Audio pronunciation, tags, sharing, and browsing the full bundled
  dictionary — all deferred for the same reason.

### What each step is checked against

- **Dead-end** — no next action, or the flow loops back with nothing gained.
- **Missing screen or step** — the task assumes something (a permission, an
  account, a saved word) that was never established.
- **Ambiguous wording** — a label that can reasonably be read two ways.
- **Assumed prior knowledge** — an icon, a gesture, or a term a first-time
  user has no way to know.

Each step is rated ✅ completed cleanly, ⚠️ completed with friction, or
❌ dead-end / could not complete.

### Current task script

The script is revised by each run and inherited by the next. The version in
force is the "Revised task script" section of the **most recent** run — start
there, not from run 01.

Two things every version of it must carry:

- **Woordkast is a web page, not an installed app.** Participants open a URL
  in their phone browser; there is nothing in an app store and nothing to
  install. A script that calls it "the app" without handing over the URL has
  skipped a step the participant cannot guess. (They may add it to their home
  screen if they like — optional, and not part of any task.)
- **The account is made before task 1**, in the facilitator pre-step,
  including any email confirmation. Otherwise the first task measures
  sign-up.

### Out of scope, every run

No completion rate, no timing, no usability or satisfaction judgement. Those
require participants.

## Running one

The app description each run opens with is reconstructed from the source at
that build, so a run stays readable years later without checking out the
commit. Rebuild it rather than copying the previous one forward — a stale
description is worse than none, because it hides exactly the drift a new run
exists to catch.

Screens live in `src/screens/`, navigation in `src/components/TabBar.tsx`, the
scheduler in `src/lib/learningEngine.ts`, and lookup behaviour in
`src/lib/wordSources.ts` and `src/lib/wiktionary.ts`. To see the account gate,
the app needs a Supabase config — any non-empty `VITE_SUPABASE_URL` and key in
a local `.env` renders the Welcome and Auth screens (sign-in itself will fail,
which is fine for reading labels).
