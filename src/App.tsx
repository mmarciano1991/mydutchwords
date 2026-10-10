import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { DeckItem, DictionaryEntry, PracticeResult } from "./lib/types";
import {
  addCustomEntry,
  editEntry,
  pinSenseEntries,
  resolveEntry,
  setCustomEntries,
  useCustomEntriesVersion,
} from "./lib/wordSources";
import { useToday } from "./lib/useToday";
import {
  isInDeck,
  loadDeck,
  loadHabit,
  loadOwner,
  loadResults,
  loadRun,
  newDeckItem,
  saveDeck,
  saveHabit,
  saveResults,
  saveRun,
} from "./lib/storage";
import {
  dueSummary,
  gradeWord,
  isLeech,
  planExercises,
  selectReplayWords,
  reviewsDueBy,
  selectSessionWords,
  toGrade,
  type ExerciseContext,
  type ExerciseType,
  type PlannedStep,
  type SessionKind,
} from "./lib/learningEngine";
import {
  dayKey,
  deferWords,
  isFullSession,
  priorItems,
  pruneRun,
  recordAnswer,
  remainingSteps,
  runAnswerFor,
  runProgress,
  startRun,
  type PracticeRun,
  type RunKind,
} from "./lib/dailySet";
import type { PriorItems } from "./lib/sessionQueue";
import {
  backfillDoneDays,
  commitmentOf,
  currentStreak,
  cueLine,
  isReturning,
  newHabit,
  reflectionDue,
  followOnSectionSize,
  sessionSizeFor,
  todayProgress,
  tomorrowAt,
  weekProgress,
  wordsPractisedOn,
  type Commitment,
  type HabitTime,
  type HabitState,
} from "./lib/habit";
import { appendReviewEvent, flushReviewEvents, newSessionId } from "./lib/reviewEvents";
import { completionSentence } from "./lib/sentenceTarget";
import { dutchAudioAvailable, onVoicesChanged } from "./lib/audio";
import { DICTIONARY, findEntry } from "./data/dictionary";
import { MC_DICTIONARY_FILL_WORDS } from "./lib/learningConfig";
import { buildReflection, hasSomethingToShow } from "./lib/reflection";
import { useDailyReminder } from "./lib/reminders";
import { loadExamples, onExamplesLoaded } from "./data/examples";
import { expandOriginFrom, type ExpandOrigin } from "./lib/expandOrigin";
import { useAuth } from "./lib/useAuth";
import { useCloudSync } from "./lib/useCloudSync";
import { signOut } from "./lib/auth";
import type { AppState } from "./lib/cloudState";
import { Dashboard } from "./screens/Dashboard";
import { Browse } from "./screens/Browse";
import { Practice, type PracticeCard, type StepAnswer } from "./screens/Practice";
import { SessionReport, type SittingKind } from "./screens/SessionReport";
import { Onboarding } from "./screens/Onboarding";
import { Reflection } from "./screens/Reflection";
import { WeeklyGoal } from "./screens/WeeklyGoal";
import { WelcomeBack } from "./components/WelcomeBack";
import { Capture } from "./screens/Capture";
import { AddChoice } from "./screens/AddChoice";
import { AddFromText } from "./screens/AddFromText";
import { Settings, type HabitPrefs } from "./screens/Settings";
import { Auth } from "./screens/Auth";
import { NewPassword } from "./screens/NewPassword";
import { Welcome } from "./screens/Welcome";
import { TabBar, type Tab } from "./components/TabBar";

type Route = Tab | "practice" | "report" | "reflection" | "week" | "add-choice" | "capture" | "add-from-text";

const FOCUSED: Route[] = ["practice", "report", "reflection", "week", "add-choice", "capture", "add-from-text"];

/* How long to wait for a signed-in user's remote habit before showing
   onboarding anyway. A failed pull stops the wait at once (offline); this
   only bounds a request that neither lands nor fails. Kept generous:
   showing onboarding to a returning user on a slow connection would have
   them set up a habit they already have. */
const HYDRATION_GRACE_MS = 15_000;

/** Exercise types the practice screen can show. */
const SUPPORTED_EXERCISES: ReadonlySet<ExerciseType> = new Set<ExerciseType>([
  "flashcard",
  "multiple_choice",
  "matching",
  "listening",
  "sentence_completion",
  "active_recall",
]);

/** Joins deck words back to their dictionary content for display. */
function toPracticeCards(words: DeckItem[]): PracticeCard[] {
  return words
    .map((word) => {
      const entry = resolveEntry(word.id);
      return entry ? ({ entry, word } as PracticeCard) : null;
    })
    .filter((c): c is PracticeCard => c !== null);
}

export default function App() {
  const [deck, setDeck] = useState<DeckItem[]>(() => loadDeck());
  const [results, setResults] = useState<PracticeResult[]>(() => loadResults());
  // The daily commitment, cue, weekly target and days done. Null until the
  // user has been through onboarding (here or on another device).
  const [habit, setHabit] = useState<HabitState | null>(() => loadHabit());
  // Grading reads the word's state at the moment of the answer, which may
  // be newer than the last render's `deck` when answers come quickly.
  const deckRef = useRef(deck);
  deckRef.current = deck;
  // What the user actually did, in their current or most recent sitting.
  // The dashboard's practice card reads this and nothing else.
  const [run, setRun] = useState<PracticeRun | null>(() => loadRun());
  const runRef = useRef(run);
  runRef.current = run;
  const [route, setRoute] = useState<Route>("dashboard");

  // Access gate flow (Figma 228:1789): a signed-out visitor lands on the
  // Welcome choice screen first, then Auth in whichever mode they picked.
  // Signing out skips straight back to "signin" (see handleSignOut) rather
  // than replaying Welcome.
  const [authStep, setAuthStep] = useState<"welcome" | "auth">("welcome");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  // Where the Add-a-word screen should expand from (Material's container
  // transform). Null when it was opened some other way — then it just appears.
  const [expandFrom, setExpandFrom] = useState<ExpandOrigin | null>(null);

  const [steps, setSteps] = useState<PlannedStep[]>([]);
  const [cards, setCards] = useState<PracticeCard[]>([]);
  // Words the run already settled before this sitting — a resumed session
  // starts with them mastered or back in review, not from zero.
  const [prior, setPrior] = useState<PriorItems>({});
  // Bumped per begun session so Practice remounts with fresh internal state
  // (its queue/outcomes are seeded from props on mount).
  const [sessionId, setSessionId] = useState(0);
  // What the sitting on screen is for — the report words itself by it.
  const [sittingKind, setSittingKind] = useState<SittingKind>("goal");

  useEffect(() => saveDeck(deck), [deck]);
  useEffect(() => saveResults(results), [results]);
  useEffect(() => saveRun(run), [run]);
  useEffect(() => saveHabit(habit), [habit]);

  // Example sentences are a separate chunk (they're most of the dictionary's
  // weight and none of what the first screen needs). Fetch them as soon as
  // the app is interactive, and re-render when they land so anything already
  // on screen picks up its sentence.
  const [examplesVersion, setExamplesVersion] = useState(0);
  useEffect(() => {
    const unsubscribe = onExamplesLoaded(() => setExamplesVersion((v) => v + 1));
    void loadExamples();
    return unsubscribe;
  }, []);

  // Bumped whenever a word's saved content changes without the deck itself
  // changing (editEntry) — deckEntries otherwise has no reason to recompute,
  // since neither `deck` (ladder state) nor `examplesVersion` moved.
  const [customWordsVersion, setCustomWordsVersion] = useState(0);

  // ── Accounts + cloud sync (optional; no-ops when Supabase isn't configured) ──
  const { user, configured, ready, recovering, clearRecovery } = useAuth();

  // Hard access gate (Figma 228:1789): signed-out visitors can't reach any
  // part of the app — no offline browsing, no "continue without an
  // account" skip. Only takes effect when Supabase is configured; an
  // unconfigured build has no accounts to gate behind, so it stays fully
  // offline as before.
  const locked = configured && !user;
  // Stamped on every review event, so each is uploaded only for its own user.
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  // Applies a merged remote+local snapshot after login (custom words are set
  // by the sync hook before this runs).
  const { today } = useToday();

  const applyMerged = useCallback((state: AppState) => {
    setDeck(state.deck);
    setResults(state.results);
    setRun(state.run);
    setHabit(state.habit ?? null);
  }, []);

  const { hydrated, hydrationFailed, flush } = useCloudSync({
    userId: user?.id ?? null,
    deck,
    results,
    run,
    habit,
    applyMerged,
  });

  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    if (hydrated) return;
    const t = window.setTimeout(() => setGraceOver(true), HYDRATION_GRACE_MS);
    return () => window.clearTimeout(t);
  }, [hydrated]);

  // Whenever the gate (re)closes — sign-out, or a session expiring — drop
  // back to the dashboard so the next sign-in doesn't resume a stale
  // mid-flow screen (e.g. a cleared practice queue).
  useEffect(() => {
    if (locked) setRoute("dashboard");
  }, [locked]);

  /** Signs out, wiping this device's copy. Resolves false — and does nothing
   *  — when the latest progress couldn't be saved first, unless `force`d:
   *  the wipe would otherwise destroy the only copy of it. */
  async function handleSignOut({ force = false } = {}): Promise<boolean> {
    // Must happen while still authenticated — RLS needs auth.uid() = user_id.
    const saved = await flush();
    if (!saved && !force) return false;
    if (user) await flushReviewEvents(user.id);
    await signOut();
    // Start the local session clean so the next account doesn't inherit this
    // deck.
    setDeck([]);
    setResults([]);
    setRun(null);
    setHabit(null);
    setCustomEntries([]);
    // Straight back to log-in, not Welcome — this visitor already knows
    // the app, and has an account by definition.
    setAuthMode("signin");
    setAuthStep("auth");
    return true;
  }

  // Resolve the deck (newest first) into full dictionary entries. Recomputed
  // when the examples chunk lands (rows pick up their sentence) or a word's
  // content is edited in place (customWordsVersion).
  const deckEntries = useMemo(
    () => deck.map((d) => resolveEntry(d.id)).filter((e): e is DictionaryEntry => Boolean(e)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deck, examplesVersion, customWordsVersion]
  );
  const deckIds = useMemo(() => new Set(deck.map((d) => d.id)), [deck]);

  // The deck words that can actually be shown — what every count and draw
  // works from. A word whose entry no longer resolves (a headword since
  // dropped from the dictionary) keeps its place in the deck, in case it
  // comes back, but can't be asked: counting it would leave the day's goal
  // forever one word out of reach.
  const customEntriesVersion = useCustomEntriesVersion();
  const activeDeck = useMemo(
    () => deck.filter((d) => resolveEntry(d.id) !== undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deck, customWordsVersion, customEntriesVersion]
  );

  // Secondary meanings are keyed by their position in a word's sense list,
  // which a dictionary update can shift — so each one in the deck keeps its
  // own copy of the meaning that was saved.
  useEffect(() => pinSenseEntries(deck.map((d) => d.id)), [deck]);

  // Whether this device can speak Dutch — voices often load after start-up.
  const [dutchAudio, setDutchAudio] = useState(() => dutchAudioAvailable());
  useEffect(() => onVoicesChanged(() => setDutchAudio(dutchAudioAvailable())), []);

  /** Corrects a saved translation — same override mechanism the sense picker
   *  uses, offered generally rather than only where a second sense exists. */
  function editDeckWord(id: string, edit: { english: string; example: string; exampleEn: string }) {
    editEntry(id, edit);
    setCustomWordsVersion((v) => v + 1);
  }

  // Legacy 0–6 level per deck word (derived from the learning state), drives
  // the mastery bars in Browse.
  const levels = useMemo(() => new Map(deck.map((d) => [d.id, d.level])), [deck]);

  // Leech words (4+ lapses) — tagged "Tricky" in lists, prioritized in sessions.
  const tricky = useMemo(() => new Set(deck.filter(isLeech).map((d) => d.id)), [deck]);

  // Words per state, for the dashboard.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const queue = useMemo(() => dueSummary(activeDeck, new Date()), [activeDeck, route]);

  const activeTab: Tab = useMemo(() => {
    if (route === "browse" || route === "settings") return route;
    return "dashboard";
  }, [route]);

  /** The + button and the empty dashboard's CTA both open the fork between
   *  the two ways in (AddChoice), not the search field directly — the
   *  reading route was previously only findable from inside Capture. */
  function openAdd(origin: HTMLElement) {
    setExpandFrom(expandOriginFrom(origin));
    setRoute("add-choice");
  }

  /** Takes a word out of the deck, handing back what was removed — its
   *  progress included — so the deck screen can offer an undo. */
  function removeWord(entryId: string): DeckItem | undefined {
    const removed = deck.find((d) => d.id === entryId);
    setDeck((prev) => prev.filter((d) => d.id !== entryId));
    return removed;
  }

  /** Puts a removed word back exactly as it was — never over a copy that
   *  was added again in the meantime. */
  function restoreWord(item: DeckItem) {
    setDeck((prev) =>
      isInDeck(prev, item.id) ? prev : [...prev, item].sort((a, b) => b.dateAdded - a.dateAdded)
    );
  }

  /** Save from the capture flow. Words from the online lookup aren't in the
   *  bundled dictionary, so they're persisted as custom entries first.
   *
   *  Deliberately does not navigate: the capture screen confirms the save
   *  itself and clears for the next word. Landing on the deck after every
   *  add cost four taps per word on a task that asks for three. */
  function saveCapturedWord(entry: DictionaryEntry) {
    addCustomEntry(entry);
    setDeck((prev) =>
      isInDeck(prev, entry.id) ? prev : [newDeckItem(entry.id, new Date()), ...prev]
    );
  }

  // Today — kept current while the app stays open (a timer past midnight,
  // and a re-check when the tab comes back).

  // Words per session: the commitment (10/20/30), or the warm-up on a
  // return day.
  const sessionSize = sessionSizeFor(habit, today);

  // Distinct words graded today (a word answered twice counts once).
  const practisedToday = useMemo(() => wordsPractisedOn(results, today), [results, today]);

  // A word removed from the deck must not leave the run stuck one word
  // short of finishing.
  useEffect(() => {
    if (!run) return;
    const inDeck = new Set(activeDeck.map((d) => d.id));
    const pruned = pruneRun(run, (id) => inDeck.has(id));
    if (pruned !== run) setRun(pruned);
  }, [activeDeck, run]);

  // What the user actually did in the session on screen (or the last one).
  const progress = useMemo(() => runProgress(run, today), [run, today]);
  // A graded session started today and not finished — "Continue" resumes it.
  const resumable =
    run !== null && run.kind !== "practice" && run.date === today && progress.status === "progress" && Boolean(run.plan);

  // ── Today ──
  // A day is done once one full session has been completed — recorded on
  // the local day the session was finished. Sections past that one are
  // counted separately (by the session report) and never add a day.
  const doneToday = habit?.doneDays.includes(today) ?? false;

  // Size of the next section: today's goal size for the first, the full
  // commitment size once the day is done (also on a return day).
  const nextSectionSize = doneToday ? followOnSectionSize(habit) : sessionSize;

  // The words the next session would ask, by the engine's priorities —
  // empty once every word has had its graded answer today and no New words
  // are left.
  const nextSessionWords = useMemo(
    () => selectSessionWords(activeDeck, new Date(), { size: nextSectionSize }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDeck, nextSectionSize, today]
  );

  // Reviews already waiting tomorrow — shown before another section, since
  // every New word met today is due again tomorrow.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tomorrowReviews = useMemo(() => reviewsDueBy(activeDeck, new Date(), 1), [activeDeck, today]);
  const goal = resumable ? progress.total : Math.max(1, nextSessionWords.length || sessionSize);
  const todayProg = useMemo(() => {
    const p = todayProgress(goal, resumable ? progress.answered : 0, doneToday);
    // Practised today past the first full session — shown as "+N extra".
    return { ...p, extra: doneToday ? Math.max(0, practisedToday.length - sessionSize) : 0 };
  }, [goal, resumable, progress.answered, doneToday, practisedToday.length, sessionSize]);

  useEffect(() => {
    if (!habit || !run || !isFullSession(run)) return;
    const day = dayKey(new Date(run.completedAt!));
    if (habit.doneDays.includes(day)) return;
    setHabit({ ...habit, doneDays: [...habit.doneDays, day].sort() });
  }, [habit, run]);

  const week = useMemo(
    () => weekProgress(habit?.doneDays ?? [], habit?.weeklyTarget ?? 4, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [habit?.doneDays, habit?.weeklyTarget, today]
  );

  const streak = useMemo(
    () => currentStreak(habit?.doneDays ?? [], new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [habit?.doneDays, today]
  );

  useDailyReminder(habit, { done: todayProg.done, eligible: nextSessionWords.length > 0, hasWords: activeDeck.length > 0 });

  // More practice is on offer while any word is still eligible today.
  const canExtra = nextSessionWords.length > 0;
  // Past that, the user can always go over words again — as often as they
  // like — in an ungraded round that leaves the schedule alone.
  const canReplay = activeDeck.length > 0;

  // Words met for the very first time today, by name — what the report
  // shows as today's gain.
  const newToday = useMemo(() => {
    const first = new Map<string, number>();
    for (const r of results) {
      const t = first.get(r.entryId);
      if (t === undefined || r.timestamp < t) first.set(r.entryId, r.timestamp);
    }
    const names = [...first]
      .filter(([, t]) => dayKey(new Date(t)) === today)
      .map(([id]) => resolveEntry(id)?.dutch)
      .filter((w): w is string => Boolean(w));
    return [...new Set(names)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, today, examplesVersion]);

  // ── Monthly "then vs now" ──
  // Only built when due — it walks the whole log.
  const reflection = useMemo(() => {
    if (!habit || !reflectionDue(habit, new Date())) return null;
    const r = buildReflection(results, new Date(), (id) => resolveEntry(id)?.dutch);
    return hasSomethingToShow(r) ? r : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habit?.lastReflection, habit?.startedAt, results, today]);

  /** What the engine needs to know to pick exercises. */
  function exerciseContext(deckSize: number): ExerciseContext {
    return {
      deckSize,
      supported: SUPPORTED_EXERCISES,
      audioEnabled: habit?.audioExercises ?? true,
      // One device-wide Dutch voice speaks every word.
      hasAudio: () => dutchAudio,
      hasSentence: (id) => {
        const entry = resolveEntry(id);
        return entry ? completionSentence(entry) !== null : false;
      },
      fillChoices: choiceFiller.length > 0,
    };
  }

  // Tops up Multiple Choice distractors while the deck is too small to
  // supply them, so a learner's first words can be recognised from day one.
  const choiceFiller = useMemo(() => DICTIONARY.slice(0, MC_DICTIONARY_FILL_WORDS), []);

  // A typed answer that is itself another real Dutch word is never accepted
  // as a typo of the right one.
  const deckDutch = useMemo(() => new Set(deckEntries.map((e) => e.dutch.toLowerCase())), [deckEntries]);
  const isKnownWord = useCallback(
    (word: string) => deckDutch.has(word.toLowerCase()) || Boolean(findEntry(word.toLowerCase())),
    [deckDutch]
  );

  /** Puts a session on screen. Every session is a fresh run, so its report
   *  shows what just happened and nothing older. */
  function showSession(words: DeckItem[], plan: PlannedStep[], run: PracticeRun, sitting: SittingKind) {
    setRun(run);
    setCards(toPracticeCards(words));
    setSteps(plan);
    setPrior(priorItems(run));
    setSessionId((s) => s + 1);
    setSittingKind(sitting);
    setRoute("practice");
  }

  /** Starts a session of `words`, planned by the engine — together with any
   *  words the last session handed on. */
  function beginSession(selected: DeckItem[], kind: RunKind, sitting: SittingKind, from: DeckItem[] = activeDeck) {
    const chosen = new Set(selected.map((w) => w.id));
    const carried = (run?.deferred ?? [])
      .filter((id) => !chosen.has(id))
      .map((id) => from.find((d) => d.id === id))
      .filter((w): w is DeckItem => Boolean(w));
    const words = [...selected, ...carried];
    if (words.length === 0) return;
    const plan = planExercises(words, exerciseContext(from.length), Math.random);
    const fresh = startRun(
      words.map((w) => w.id),
      new Date(),
      { sessionId: newSessionId(), kind, plan }
    );
    showSession(words, plan, fresh, sitting);
  }

  /** A new graded session, selected by the engine. */
  function beginSelected(kind: SessionKind, sitting: SittingKind, size = sessionSize, from: DeckItem[] = activeDeck) {
    beginSession(selectSessionWords(from, new Date(), { size, kind }), kind, sitting, from);
  }

  /** Starts today's session — or resumes the one left part-way. */
  function startPractice() {
    if (resumable && run) {
      const byId = new Map(activeDeck.map((d) => [d.id, d]));
      const words = run.wordIds.map((id) => byId.get(id)).filter((w): w is DeckItem => Boolean(w));
      showSession(words, remainingSteps(run), run, "goal");
      return;
    }
    if (doneToday) beginSelected("daily", "extra", nextSectionSize);
    else beginSelected("daily", "goal");
  }

  /** Another session, past the day's first. It never repeats a word graded
   *  today, so it only exists while something is still eligible. */
  function startExtra() {
    beginSelected("daily", "extra", followOnSectionSize(habit));
  }

  /** Free practice once nothing is left to grade today: repeats today's
   *  words (missed first), then others. Ungraded, so it can be done again
   *  and again without touching the schedule or the day's goal. */
  function startReplay() {
    beginSession(selectReplayWords(deck, new Date(), sessionSize), "practice", "warmup");
  }

  /** Goes over the words just missed — an ungraded practice round: misses
   *  come back for review, and nothing is rescheduled. */
  function practiseLearningAgain() {
    const byId = new Map(activeDeck.map((d) => [d.id, d]));
    const words = progress.learningIds.map((id) => byId.get(id)).filter((w): w is DeckItem => Boolean(w));
    beginSession(words, "practice", "warmup");
  }

  // ── Coming back ──
  // One warm popup after time away. Opening it (either button) makes today
  // a return day, whose session is the 5-word warm-up — so coming back is
  // finished in one small step.
  const showWelcomeBack =
    route === "dashboard" &&
    habit !== null &&
    activeDeck.length > 0 &&
    practisedToday.length === 0 &&
    isReturning(habit, results, new Date());

  function welcomeBack(start: boolean) {
    if (!habit) return;
    const next = { ...habit, welcomedOn: today };
    setHabit(next);
    if (start) beginSelected("daily", "goal", sessionSizeFor(next, today));
  }

  // ── Onboarding ──
  function completeOnboarding(choice: { commitment: Commitment; time: HabitTime }, firstWords: DictionaryEntry[] = []) {
    const now = new Date();
    const words = commitmentOf(choice.commitment).words;

    // An existing learner's recent practice shows on their first week.
    const next = newHabit(choice, now);
    next.doneDays = backfillDoneDays(results, words);
    setHabit(next);

    // A new learner's first three words — typed in onboarding, or the
    // starters they asked for. Added now, and passed to the session
    // directly, since the deck state hasn't updated yet in this call.
    const fresh: DeckItem[] = [];
    for (const entry of firstWords) {
      if (isInDeck(activeDeck, entry.id) || fresh.some((d) => d.id === entry.id)) continue;
      addCustomEntry(entry);
      fresh.push(newDeckItem(entry.id, now));
    }
    if (fresh.length > 0) setDeck((prev) => [...fresh.filter((f) => !isInDeck(prev, f.id)), ...prev]);
    const from = [...fresh, ...activeDeck];

    // With words saved, the first session starts now; without, onboarding
    // ends on adding the first one.
    if (from.length > 0) beginSelected("daily", "goal", words, from);
    else {
      setExpandFrom(null);
      setRoute("add-choice");
    }
  }

  function changeHabit(prefs: Partial<HabitPrefs>) {
    setHabit((prev) => (prev ? { ...prev, ...prefs, updatedAt: Date.now() } : prev));
  }

  function finishReflection() {
    setHabit((prev) => (prev ? { ...prev, lastReflection: today } : prev));
    setRoute("dashboard");
  }

  /** One answer, the moment it's given: the engine decides what it does to
   *  the word, and the result is persisted — the word's state, the compact
   *  log (graded answers only), the review event, and the run. A session
   *  abandoned half-way keeps everything answered up to that point. */
  const handleAnswer = useCallback(
    (answer: StepAnswer) => {
      const current = deckRef.current.find((d) => d.id === answer.wordId);
      if (!current) return;
      const now = new Date();
      const session = runRef.current;
      const { word, event, graded } = gradeWord(
        current,
        {
          exerciseType: answer.exerciseType,
          result: answer.result,
          responseTimeMs: answer.responseTimeMs,
          sessionId: session?.sessionId ?? null,
          // A review re-ask is never evidence (one graded answer per session).
          practice: session?.kind === "practice" || answer.review,
        },
        now
      );
      if (word !== current) {
        const updated: DeckItem = { ...word, dateAdded: current.dateAdded };
        deckRef.current = deckRef.current.map((d) => (d.id === updated.id ? updated : d));
        setDeck(deckRef.current);
      }
      appendReviewEvent(event, userIdRef.current);
      const grade = graded ? toGrade(answer.result) : null;
      if (grade) setResults((prev) => [...prev, { entryId: answer.wordId, grade, timestamp: now.getTime() }]);
      // The word's own first answer is its answer in the run. A skip leaves
      // it pending: it's asked another way next.
      if (answer.final && !answer.review && answer.result !== "skipped") {
        setRun((prev) => (prev ? recordAnswer(prev, answer.wordId, runAnswerFor(answer.result), now) : prev));
      }
    },
    []
  );

  /** Finishing a session ALWAYS lands on the result screen — it is the last
   *  step of the flow, and only the user leaving it returns them home. */
  function finishPractice(deferred: string[]) {
    setRun((prev) => (prev ? deferWords(prev, deferred) : prev));
    setRoute("report");
  }

  /** Leaving part-way is not finishing: every answer given so far is
   *  already logged, so the card reports the goal as part-done and
   *  "Continue" picks up the words still needed. Words still waiting for
   *  review are handed on, in case the session isn't resumed. */
  function closePractice(carryOver: string[]) {
    setRun((prev) => (prev ? deferWords(prev, carryOver) : prev));
    setRoute("dashboard");
  }

  // Recovery renders in place of the app, so it gets no navigation either —
  // the session is signed in, which would otherwise leave the tab bar showing
  // under a screen that isn't part of the app.
  // Onboarding has to wait for a signed-in user's remote habit (they may
  // have set it up on another device) — up to the grace period.
  const needsOnboarding = !locked && !recovering && habit === null;
  const waitingForHabit = needsOnboarding && !hydrated && !hydrationFailed && !graceOver;

  // Local data last synced with a different account is about to be replaced
  // by this one's (see useCloudSync) — not to be shown to them meanwhile.
  const owner = loadOwner();
  const foreignLocal = user !== null && !hydrated && owner !== null && owner !== user.id;

  const showTabs = !locked && !recovering && !needsOnboarding && !FOCUSED.includes(route);

  return (
    <div className="app-shell">
      <div className={showTabs ? "phone phone--tabs" : "phone"}>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {configured && !ready ? null : recovering ? (
            // A recovery link signs the user in, so this has to take
            // precedence over the normal signed-in app — otherwise the
            // password they came to change never gets changed.
            <NewPassword onDone={clearRecovery} />
          ) : locked ? (
            // The boot splash (main.tsx) covers this in practice — Supabase's
            // local-storage session read resolves well within its hold time.
            authStep === "welcome" ? (
              <Welcome
                onCreateAccount={() => {
                  setAuthMode("signup");
                  setAuthStep("auth");
                }}
                onLogIn={() => {
                  setAuthMode("signin");
                  setAuthStep("auth");
                }}
              />
            ) : (
              <Auth initialMode={authMode} onBack={() => setAuthStep("welcome")} />
            )
          ) : waitingForHabit || foreignLocal ? (
            <div className="screen center-col gutter" role="status">
              <p className="muted">Loading your words…</p>
            </div>
          ) : needsOnboarding ? (
            <Onboarding
              existingUser={deck.length > 0 || results.length > 0}
              deckIds={deckIds}
              levels={levels}
              onComplete={completeOnboarding}
            />
          ) : (
            <>
              {route === "dashboard" && (
                <Dashboard
                  deckCount={deckEntries.length}
                  counts={queue.counts}
                  today={todayProg}
                  inProgress={resumable}
                  week={week}
                  streak={streak}
                  cue={habit ? cueLine(habit) : ""}
                  tomorrow={tomorrowAt(habit)}
                  canExtra={canExtra}
                  extraWords={nextSessionWords.length}
                  canReplay={canReplay}
                  onPractice={startPractice}
                  onExtra={startExtra}
                  onReplay={startReplay}
                  onAddWord={openAdd}
                  onOpenWeek={() => setRoute("week")}
                />
              )}

              {route === "week" && habit && (
                <WeeklyGoal
                  week={week}
                  habit={habit}
                  onBack={() => setRoute("dashboard")}
                  onEdit={() => setRoute("settings")}
                />
              )}

              {route === "browse" && (
                <Browse
                  entries={deckEntries}
                  levels={levels}
                  tricky={tricky}
                  deckIds={deckIds}
                  onRemove={removeWord}
                  onRestore={restoreWord}
                  onEdit={editDeckWord}
                  onSave={saveCapturedWord}
                />
              )}

              {route === "settings" && (
                <Settings
                  deckCount={deck.length}
                  configured={configured}
                  email={user?.email ?? null}
                  habit={habit}
                  dutchAudio={dutchAudio}
                  onHabitChange={changeHabit}
                  onSignOut={handleSignOut}
                />
              )}

              {route === "practice" && (
                <Practice
                  key={sessionId}
                  steps={steps}
                  cards={cards}
                  prior={prior}
                  pool={deckEntries}
                  choiceFiller={choiceFiller}
                  isKnownWord={isKnownWord}
                  onAnswer={handleAnswer}
                  onFinish={finishPractice}
                  onClose={closePractice}
                />
              )}

              {route === "report" && (
                <SessionReport
                  knownIds={progress.knownIds}
                  learningIds={progress.learningIds}
                  deck={deck}
                  kind={sittingKind}
                  today={todayProg}
                  week={week}
                  newToday={sittingKind === "warmup" ? [] : newToday}
                  tomorrow={tomorrowAt(habit)}
                  reflectionReady={reflection !== null && todayProg.done && sittingKind === "goal"}
                  canExtra={canExtra}
                  nextSectionWords={selectSessionWords(activeDeck, new Date(), { size: followOnSectionSize(habit) }).length}
                  tomorrowReviews={tomorrowReviews}
                  canReplay={canReplay}
                  onReviewMissed={practiseLearningAgain}
                  onExtra={startExtra}
                  onReplay={startReplay}
                  onReflection={() => setRoute("reflection")}
                  onDone={() => setRoute("dashboard")}
                />
              )}

              {route === "reflection" && reflection && (
                <Reflection reflection={reflection} onDone={finishReflection} />
              )}

              {/* The container transform belongs to whichever screen the +
                  button actually opens — now the chooser, not Capture. The
                  two screens it leads to are reached from within the flow,
                  so they just appear. */}
              {route === "add-choice" && (
                <div
                  className={expandFrom ? "screen-expand" : undefined}
                  style={
                    expandFrom
                      ? ({
                          "--expand-x": `${expandFrom.x}px`,
                          "--expand-y": `${expandFrom.y}px`,
                          "--expand-r": `${expandFrom.r}px`,
                        } as CSSProperties)
                      : undefined
                  }
                >
                  <AddChoice
                    onSingleWord={() => setRoute("capture")}
                    onFullSentence={() => setRoute("add-from-text")}
                    onBack={() => setRoute("dashboard")}
                  />
                </div>
              )}

              {route === "capture" && (
                <Capture
                  deckIds={deckIds}
                  levels={levels}
                  onSave={saveCapturedWord}
                  onUndo={(entryId) => setDeck((prev) => prev.filter((d) => d.id !== entryId))}
                  onViewDeck={() => setRoute("browse")}
                  onBack={() => setRoute("add-choice")}
                />
              )}

              {route === "add-from-text" && (
                <AddFromText
                  deckIds={deckIds}
                  levels={levels}
                  onSave={saveCapturedWord}
                  onBack={() => setRoute("add-choice")}
                />
              )}
            </>
          )}
        </div>

        {showTabs && (
          <TabBar active={activeTab} onChange={(t) => setRoute(t)} onAddWord={openAdd} />
        )}

        {showTabs && showWelcomeBack && (
          <WelcomeBack
            words={sessionSizeFor({ ...habit!, welcomedOn: today }, today)}
            onStart={() => welcomeBack(true)}
            onDismiss={() => welcomeBack(false)}
          />
        )}
      </div>
    </div>
  );
}
