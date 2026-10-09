// @vitest-environment jsdom
/* End-to-end cover for the habit loop, driven through the real App:
   onboarding → first session → goal done → extra → the week → coming back →
   the monthly reflection → changing the plan in Settings.

   These states are only reachable by actually playing the app — the pure
   habit/dailySet tests can't catch a mis-wiring between the log, the goal,
   the recorded days and the screens. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import { ANSWER_MS } from "./components/exercises/FlashcardExercise";
import { newDeckItem } from "./lib/storage";
import type { DeckItem } from "./lib/types";
import { dayKey } from "./lib/dailySet";
import { newHabit, type HabitState } from "./lib/habit";

// The dictionary chunk is irrelevant here and pulls in ~1MB of examples.
vi.mock("./data/examples", () => ({
  loadExamples: () => Promise.resolve(),
  onExamplesLoaded: () => () => {},
}));

// Resolve every id to a minimal entry so the queue isn't silently emptied.
vi.mock("./lib/wordSources", () => ({
  resolveEntry: (id: string) => ({ id, dutch: id, english: `${id}-en`, gender: null }),
  addCustomEntry: () => {},
  editEntry: () => {},
  getCustomEntries: () => [],
  setCustomEntries: () => {},
  useCustomEntriesVersion: () => 0,
  pinSenseEntries: () => {},
  entriesGlossed: () => [],
  parseSenseKey: (id: string) => ({ baseId: id, index: 0 }),
}));

/* jsdom 30 under vitest 2 ships no localStorage, and the app persists
   through it — so the suite supplies a minimal in-memory one. */
function installLocalStorage() {
  let store = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return store.size;
    },
    clear: () => {
      store = new Map();
    },
    getItem: (k) => store.get(k) ?? null,
    key: (i) => [...store.keys()][i] ?? null,
    removeItem: (k) => void store.delete(k),
    setItem: (k, v) => void store.set(k, String(v)),
  };
  Object.defineProperty(globalThis, "localStorage", { value: shim, configurable: true });
}
installLocalStorage();

// react-dom 18 gates act() on this flag.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// TabBar measures itself with one; jsdom has no layout, so a no-op is enough.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

// The tab bar checks reduced-motion when switching tabs; jsdom has no matchMedia.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

let container: HTMLDivElement;
let root: Root;

function render() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<App />);
  });
}

/** The practice card's copy, collapsed to one string for easy assertions. */
function cardText(): string {
  return container.querySelector(".practice-card")?.textContent ?? "";
}

/** Whole-screen text — used to assert which screen is showing. */
/** The dashboard topbar counters, read from their accessible labels. */
function counter(kind: "week" | "streak"): string {
  return container.querySelector(`.insights__counter--${kind}`)?.getAttribute("aria-label") ?? "";
}

function screenText(): string {
  return container.textContent ?? "";
}

/** True while the result screen is up. */
function onResultPage(): boolean {
  return container.querySelector(".report-actions") !== null;
}

function click(text: string) {
  const button = [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.includes(text) || b.getAttribute("aria-label") === text
  );
  if (!button) throw new Error(`no button matching "${text}" in:\n${container.textContent}`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Sets the habit time field, the way a picker does: React tracks the
 *  value through the native setter, then sees the input event. */
function setTime(value: string) {
  const input = container.querySelector<HTMLInputElement>('input[type="time"]');
  if (!input) throw new Error(`no time field in:\n${container.textContent}`);
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** The Dutch words on a Matching grid still to pair, top to bottom. */
function matchingIds(): string[] {
  return [...container.querySelectorAll<HTMLButtonElement>('.match-option[lang="nl"]:not(:disabled)')].map((b) => b.textContent!);
}

/** Past an answered exercise's panel: Continue when right, Got it when not. */
function dismissPanel() {
  click(container.querySelector(".answer-panel__continue")!.textContent!);
}

/** Pairs every word on a Matching grid — each pair is checked as it's made —
 *  then Continues. A word that should be missed is first paired with a
 *  wrong translation. */
function respondMatching(isRight: (id: string) => boolean) {
  const tapButton = (side: "nl" | "en", text: string) => {
    const b = [...container.querySelectorAll<HTMLButtonElement>(`.match-option[lang="${side}"]:not(:disabled)`)].find((x) => x.textContent === text)!;
    act(() => b.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  };
  for (const id of matchingIds()) {
    if (!isRight(id)) {
      const wrong = [...container.querySelectorAll<HTMLButtonElement>('.match-option[lang="en"]:not(:disabled)')].find((b) => b.textContent !== `${id}-en`);
      if (wrong) {
        tapButton("nl", id);
        tapButton("en", wrong.textContent!);
      }
    }
    tapButton("nl", id);
    tapButton("en", `${id}-en`);
  }
  dismissPanel();
}

/** The word being asked: ids are `wN`, glossed `wN-en` by the mock above. */
function currentId(): string | null {
  const grid = matchingIds();
  if (grid.length > 0) return grid[0];
  const prompt = container.querySelector(".exercise__word")?.textContent;
  if (prompt) return prompt.replace(/-en$/, "");
  return container.querySelector(".flashcard__face--front .flashcard__word")?.textContent ?? null;
}

/** Answers whatever exercise is on screen, right or wrong, and moves on.
 *  Multiple choice offers English options ("wN-en"). Every answered
 *  exercise except a flashcard ends on its answer panel. */
function respond(id: string, right: boolean) {
  const options = [...container.querySelectorAll<HTMLButtonElement>(".answer-option")];
  const input = container.querySelector<HTMLInputElement>(".answer-bar__input");
  if (options.length > 0) {
    const isAnswer = (b: HTMLButtonElement) => b.textContent === `${id}-en` || b.textContent === id;
    const target = options.find((b) => isAnswer(b) === right)!;
    act(() => target.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    click("Check");
  } else if (input) {
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, right ? id : "zzz");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => input.form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  } else {
    click(right ? "I knew it" : "Still learning");
    act(() => vi.advanceTimersByTime(ANSWER_MS));
    return;
  }
  dismissPanel();
}


function inPractice(): boolean {
  return container.querySelector('[aria-label="Close practice"]') !== null;
}

/** Answers `count` words of a session, all correct unless listed in
 *  `missed` (by the order they're first asked). A missed word is missed on
 *  its own exercise, then answered right when it comes back for review —
 *  or, with `keepMissing`, missed every time. A new word's flashcard intro
 *  and its exercise are the same word asked twice in a row. Stops at the
 *  first word past `count`. Returns the ids in the order they were first
 *  asked. */
function answer(count: number, missed: number[] = [], { keepMissing = false } = {}): string[] {
  const seen = new Map<string, number>();
  const missedOnce = new Set<string>();
  const right = (id: string) => !missed.includes(seen.get(id)!) || (missedOnce.has(id) && !keepMissing);
  while (inPractice()) {
    const grid = matchingIds();
    if (grid.length > 0) {
      if (seen.size >= count && grid.some((id) => !seen.has(id))) break;
      for (const id of grid) if (!seen.has(id)) seen.set(id, seen.size);
      const wrong = grid.filter((id) => !right(id));
      respondMatching(right);
      wrong.forEach((id) => missedOnce.add(id));
      continue;
    }
    const id = currentId()!;
    if (!seen.has(id)) {
      if (seen.size >= count) break;
      seen.set(id, seen.size);
    }
    const flashcard = container.querySelector(".flashcard") !== null;
    const r = right(id);
    respond(id, r);
    // An intro flashcard is no exercise: the miss is still to come.
    if (!r && !flashcard) missedOnce.add(id);
  }
  return [...seen.keys()];
}

/** "3/5" from the practice screen's progress bar. */
function practiceCounter(): string {
  const bar = container.querySelector('.appbar--progress [role="progressbar"]');
  return bar ? `${bar.getAttribute("aria-valuenow")}/${bar.getAttribute("aria-valuemax")}` : "";
}

function reload() {
  act(() => root.unmount());
  container.remove();
  render();
}

const DAY = 86_400_000;

/** Writes a deck of `count` brand-new words to storage. */
function seedNewDeck(count: number) {
  const deck = Array.from({ length: count }, (_, i) => newDeckItem(`w${i}`, new Date(Date.now() - i)));
  localStorage.setItem("woordkast.deck", JSON.stringify(deck));
}

/** Writes a deck of `count` Learning words, all recognised yesterday and due
 *  today — each is asked once, as a multiple choice. */
function seedDueDeck(count: number) {
  const yesterday = new Date(Date.now() - DAY);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const deck = Array.from({ length: count }, (_, i) => ({
    ...newDeckItem(`w${i}`, new Date(Date.now() - 10 * DAY - i)),
    state: "learning",
    interval: 1,
    level: 1,
    reps: 1,
    evidenceTier: 1,
    successfulReviewDays: 1,
    lastResult: "correct",
    lastReviewedAt: yesterday.toISOString(),
    lastGradedDay: dayKey(yesterday),
    dueDate: midnight.toISOString(),
  }));
  localStorage.setItem("woordkast.deck", JSON.stringify(deck));
}

function storedWord(id: string): DeckItem {
  return JSON.parse(localStorage.getItem("woordkast.deck") ?? "[]").find((d: DeckItem) => d.id === id);
}

function seedHabit(over: Partial<HabitState> = {}) {
  const habit = { ...newHabit({ commitment: "espresso", time: "08:00" }, new Date()), ...over };
  localStorage.setItem("woordkast.habit", JSON.stringify(habit));
}

function storedHabit(): HabitState {
  return JSON.parse(localStorage.getItem("woordkast.habit") ?? "null");
}

function seedResults(rows: { entryId: string; grade: "know" | "dontKnow"; timestamp: number }[]) {
  localStorage.setItem("woordkast.results", JSON.stringify(rows));
}

const today = () => dayKey(new Date());

beforeEach(() => {
  localStorage.clear();
  // Only the timers. Date stays real.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  // A fixed random source makes the engine's exercise choice and order
  // deterministic: with Matching, Listening (no Dutch voice in jsdom) and
  // Sentence Completion (the mocked words have no sentences) out of reach or
  // ranked later, every recognition exercise here is Multiple Choice.
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("1. onboarding: the 5-minute promise", () => {
  function onboard(size: string, time?: string) {
    click("Let’s start");
    click(size);
    click("Continue");
    if (time) setTime(time);
    click("Continue");
  }

  it("is shown to a new user first, before anything else", () => {
    render();
    expect(screenText()).toContain("A little Dutch, every day");
    expect(container.querySelector(".practice-card")).toBeNull();
  });

  it("offers all three sizes, framed as no wrong answer", () => {
    render();
    click("Let’s start");
    expect(screenText()).toContain("How much Dutch fits your day?");
    expect(screenText()).toContain("10 words · ~5 min");
    expect(screenText()).toContain("20 words · ~10 min");
    expect(screenText()).toContain("30 words · ~15 min");
    expect(screenText()).toContain("no right answer");
  });

  it("ends a new user on adding their first word — no starter deck", () => {
    render();
    onboard("Espresso");
    // Pre-filled, so a new user can go straight through.
    expect(screenText()).toContain("Every day at 08:00, I learn 10 Dutch words.");
    click("Add my first word");
    expect(JSON.parse(localStorage.getItem("woordkast.deck") ?? "[]")).toHaveLength(0);
    expect(storedHabit()).toMatchObject({ commitment: "espresso", time: "08:00" });
    expect(screenText()).not.toContain("How much Dutch fits your day?");
  });

  it("speaks to an existing user as a change of rhythm, and starts their first session", () => {
    seedNewDeck(20);
    render();
    expect(screenText()).toContain("A gentler rhythm");
    click("Set my rhythm");
    click("Ontbijt");
    click("Continue");
    setTime("21:30");
    click("Continue");
    expect(screenText()).toContain("Every day at 21:30, I learn 20 Dutch words.");
    click("Start my first 20 words");
    // All-new words: capped at five a session.
    expect(practiceCounter()).toBe("0/5");
    expect(JSON.parse(localStorage.getItem("woordkast.deck")!)).toHaveLength(20);
  });

  it("is not shown again once done", () => {
    seedNewDeck(5);
    render();
    click("Set my rhythm");
    click("Espresso");
    click("Continue");
    click("Continue");
    click("Start my first 10 words");
    answer(5);
    expect(screenText()).toContain("Done for today!");
    expect(screenText()).toContain("See you tomorrow at 08:00");
    reload();
    expect(screenText()).not.toContain("How much Dutch fits your day?");
    expect(container.querySelector(".practice-card")).not.toBeNull();
  });
});

describe("2. the daily session", () => {
  beforeEach(() => {
    seedDueDeck(30);
    seedHabit();
  });

  it("asks for the commitment's size, with the cue", () => {
    render();
    expect(cardText()).toContain("10 words");
    expect(cardText()).toContain("~5 min");
    expect(cardText()).toContain("Your Dutch at 08:00");
  });

  it("is done once every word is answered — misses included — and the day is recorded", () => {
    render();
    click("Start");
    expect(practiceCounter()).toBe("0/10");
    answer(10, [1, 4]);
    expect(onResultPage()).toBe(true);
    expect(screenText()).toContain("Done for today!");
    expect(storedHabit().doneDays).toEqual([today()]);
    click("Done");
    expect(cardText()).toContain("Today’s session is complete!");
  });

  it("asks a missed word again once the other words are done, and grades only its first answer", () => {
    render();
    click("Start");
    const asked: string[] = [];
    while (inPractice()) {
      const grid = matchingIds();
      if (grid.length > 0) {
        asked.push(...grid);
        respondMatching(() => asked.length > 3);
        continue;
      }
      const id = currentId()!;
      asked.push(id);
      respond(id, asked.length > 3);
    }
    // Every word once, then the first one's review.
    expect(asked).toHaveLength(11);
    expect(new Set(asked.slice(0, 10)).size).toBe(10);
    expect(asked[10]).toBe(asked[0]);
    // The review answer was right, but the word keeps its failed first answer.
    expect(storedWord(asked[0]).lastResult).not.toBe("correct");
  });

  it("shows the answer to a miss, and says it comes back", () => {
    render();
    click("Start");
    const id = currentId()!;
    const wrong = [...container.querySelectorAll<HTMLButtonElement>(".answer-option")].find((b) => b.textContent !== `${id}-en`)!;
    act(() => wrong.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    click("Check");
    expect(screenText()).toContain("Not quite");
    expect(screenText()).toContain("It’ll come back in a moment.");
    expect(container.querySelector(".answer-option.is-answer")?.textContent).toContain(`${id}-en`);
  });

  it("schedules a missed word for tomorrow, not later today", () => {
    render();
    click("Start");
    const [missed] = answer(10, [0]);
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(storedWord(missed).dueDate).toBe(tomorrow.toISOString());
    // A second session today doesn't bring it back.
    click("A few more, just for fun");
    const second = answer(10);
    expect(second).not.toContain(missed);
  });

  it("hands a word missed past the retry limit on to the next session, without regrading it", () => {
    render();
    click("Start");
    const [missed] = answer(10, [0], { keepMissing: true });
    expect(onResultPage()).toBe(true);
    const graded = storedWord(missed);
    click("A few more, just for fun");
    const second = answer(11);
    expect(second).toContain(missed);
    expect(storedWord(missed).dueDate).toBe(graded.dueDate);
    expect(storedWord(missed).lastResult).toBe(graded.lastResult);
  });

  it("the progress bar counts words mastered, not answers given", () => {
    render();
    click("Start");
    answer(1, [0]);
    // The first word was missed (and the second is on screen, unanswered).
    expect(practiceCounter()).toBe("0/10");
  });

  it("offers more sessions, which add nothing to the day or the streak", () => {
    render();
    click("Start");
    answer(10);
    click("A few more, just for fun");
    expect(practiceCounter()).toBe("0/10");
    answer(10);
    expect(screenText()).toContain("Extra ✓");
    expect(screenText()).toContain("tomorrow is still just 10 words");
    click("Done");
    expect(storedHabit().doneDays).toEqual([today()]);
    expect(counter("streak")).toBe("1 day streak");
  });

  it("says plainly when nothing is left to practise today", () => {
    seedDueDeck(10);
    render();
    click("Start");
    answer(10);
    expect(screenText()).not.toContain("A few more, just for fun");
    click("Done");
    expect(cardText()).toContain("Today’s session is complete!");
    expect(cardText()).not.toContain("A few more");
  });

  it("ends the report on Done, with more practice only as a quiet link", () => {
    render();
    click("Start");
    answer(10);
    const primary = container.querySelector(".report-actions .btn--primary");
    expect(primary?.textContent).toBe("Done");
  });

  it("an incomplete session doesn't complete the day; Continue resumes the rest", () => {
    render();
    click("Start");
    answer(2);
    // A Matching grid answers several words in one step.
    const done = Number(practiceCounter().split("/")[0]);
    expect(done).toBeGreaterThanOrEqual(2);
    click("Close practice");
    expect(cardText()).toContain(`${10 - done} words to go`);
    expect(storedHabit().doneDays).toEqual([]);
    click("Continue");
    // The bar counts on from those already answered, not from zero.
    expect(practiceCounter()).toBe(`${done}/10`);
    answer(10 - done);
    expect(screenText()).toContain("Done for today!");
  });

  it("keeps part-done progress across a reload", () => {
    render();
    click("Start");
    answer(9);
    click("Close practice");
    reload();
    expect(cardText()).toContain("1 word to go");
  });

  it("lets missed words be practised again — ungraded, until they're right", () => {
    render();
    click("Start");
    const asked = answer(10, [0, 1]);
    const before = storedWord(asked[0]);
    click("Go over those 2 again");
    // Miss the first one again: in a practice round it comes back.
    const first = currentId()!;
    respond(first, false);
    const order: string[] = [];
    while (inPractice()) {
      const id = currentId()!;
      order.push(id);
      respond(id, true);
    }
    expect(order).toContain(first);
    expect(screenText()).toContain("your schedule didn’t change");
    expect(storedWord(asked[0])).toEqual(before);
  });

  it("sizes the session to a bigger commitment", () => {
    seedDueDeck(40);
    seedHabit({ commitment: "diner" });
    render();
    expect(cardText()).toContain("30 words");
    expect(cardText()).toContain("~15 min");
  });
});

describe("2b. new words", () => {
  beforeEach(() => {
    seedNewDeck(30);
    seedHabit();
  });

  it("are capped at five a session, each introduced with a flashcard first", () => {
    render();
    click("Start");
    expect(practiceCounter()).toBe("0/5");
    expect(container.querySelector(".flashcard")).not.toBeNull();
  });

  it("aren't graded by the flashcard — only by the exercise after it", () => {
    render();
    click("Start");
    const id = currentId()!;
    click("I knew it");
    act(() => vi.advanceTimersByTime(ANSWER_MS));
    expect(storedWord(id).state).toBe("new");
    answer(5);
    expect(storedWord(id).state).toBe("learning");
  });
});

describe("2b'. a deck of one", () => {
  it("can still be recognised — and become Learning — in its first session", () => {
    seedNewDeck(1);
    seedHabit();
    render();
    click("Start");
    click("I knew it");
    act(() => vi.advanceTimersByTime(ANSWER_MS));
    // Three distractors topped up from the dictionary.
    expect(container.querySelectorAll(".answer-option")).toHaveLength(4);
    respond("w0", true);
    expect(storedWord("w0").state).toBe("learning");
    expect(screenText()).toContain("Done for today!");
  });
});

describe("2c. the dashboard's word counts", () => {
  /** A deck with 2 words missed last time, 3 due, and 4 new. */
  function seedMixedDeck() {
    const yesterday = new Date(Date.now() - DAY);
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const learning = (id: string, lastResult: string) => ({
      ...newDeckItem(id, new Date(Date.now() - 10 * DAY)),
      state: "learning",
      interval: 1,
      level: 1,
      evidenceTier: 1,
      successfulReviewDays: 1,
      lastResult,
      lastReviewedAt: yesterday.toISOString(),
      lastGradedDay: dayKey(yesterday),
      dueDate: midnight.toISOString(),
    });
    const deck = [
      learning("m0", "wrong"),
      learning("m1", "dont_know"),
      learning("d0", "correct"),
      learning("d1", "correct"),
      learning("d2", "correct"),
      ...["n0", "n1", "n2", "n3"].map((id, i) => newDeckItem(id, new Date(Date.now() - i))),
    ];
    localStorage.setItem("woordkast.deck", JSON.stringify(deck));
  }

  beforeEach(() => seedHabit());

  it("counts words per state", () => {
    seedMixedDeck();
    render();
    const pills = [...container.querySelectorAll(".insights__pill")].map((p) => p.textContent);
    expect(pills).toEqual(["4New", "5Learning", "0Learned"]);
  });

  it("says plainly when nothing is left to practise today", () => {
    seedDueDeck(3);
    const graded = JSON.parse(localStorage.getItem("woordkast.deck")!).map((w: DeckItem) => ({
      ...w,
      lastGradedDay: today(),
      lastReviewedAt: new Date().toISOString(),
    }));
    localStorage.setItem("woordkast.deck", JSON.stringify(graded));
    render();
    expect(cardText()).toContain("You’re done for today — new words will be ready tomorrow.");
    // The only thing on offer is going over words again, ungraded.
    expect(container.querySelector(".practice-card button")?.textContent).toBe("Practise again");
  });

  it("lets the user practise the same words again, as often as they like, without touching the schedule", () => {
    seedDueDeck(3);
    const graded = JSON.parse(localStorage.getItem("woordkast.deck")!).map((w: DeckItem) => ({
      ...w,
      lastGradedDay: today(),
      lastReviewedAt: new Date().toISOString(),
    }));
    localStorage.setItem("woordkast.deck", JSON.stringify(graded));
    const before = localStorage.getItem("woordkast.deck");
    render();
    click("Practise again");
    click("Close practice");
    click("Practise again");
    expect(localStorage.getItem("woordkast.deck")).toBe(before);
  });
});

describe("3. weekly consistency and streak", () => {
  beforeEach(() => {
    seedNewDeck(30);
    seedHabit();
  });

  it("counts the week's days and the streak on the dashboard", () => {
    render();
    expect(counter("week")).toBe("0 days done this week");
    expect(counter("streak")).toBe("0 day streak");
    click("Start");
    answer(10);
    click("Done");
    expect(counter("week")).toBe("1 day done this week");
    expect(counter("streak")).toBe("1 day streak");
  });

  it("keeps past days done after switching to a bigger commitment", () => {
    render();
    click("Start");
    answer(10);
    click("Done");
    click("Settings");
    click("Diner");
    expect(storedHabit().commitment).toBe("diner");
    expect(storedHabit().doneDays).toContain(today());
    click("Home");
    expect(counter("week")).toBe("1 day done this week");
  });
});

describe("4. coming back", () => {
  beforeEach(() => {
    seedNewDeck(30);
    seedHabit({ commitment: "ontbijt" });
    seedResults([{ entryId: "w0", grade: "know", timestamp: Date.now() - 6 * DAY }]);
  });

  it("welcomes a returning user warmly, without counting the days away", () => {
    render();
    const dialog = container.querySelector("[role=dialog]");
    expect(dialog?.textContent).toContain("Welcome back");
    expect(dialog?.textContent).toContain("Your words waited for you.");
    expect(dialog?.textContent).not.toMatch(/\d+ days?|missed|away|streak/i);
  });

  it("is one tap into a 5-word warm-up that completes the day", () => {
    render();
    click("Let’s go");
    expect(practiceCounter()).toBe("0/5");
    answer(5);
    // A 20-word commitment, but on a return day the warm-up is the day.
    expect(screenText()).toContain("Done for today!");
  });

  it("is shown once a day, even when dismissed", () => {
    render();
    click("Not now");
    expect(container.querySelector("[role=dialog]")).toBeNull();
    reload();
    expect(container.querySelector("[role=dialog]")).toBeNull();
    expect(cardText()).toContain("5 words");
  });

  it("closes on Escape, as Not now does", () => {
    render();
    const dialog = container.querySelector("[role=dialog]")!;
    act(() => {
      dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(container.querySelector("[role=dialog]")).toBeNull();
  });

  it("keeps Tab inside the popup", () => {
    render();
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("[role=dialog] button")];
    buttons[buttons.length - 1].focus();
    act(() => {
      container.querySelector("[role=dialog]")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("isn't shown after a short gap", () => {
    seedResults([{ entryId: "w0", grade: "know", timestamp: Date.now() - DAY }]);
    render();
    expect(container.querySelector("[role=dialog]")).toBeNull();
  });
});

describe("5. the monthly then vs now", () => {
  beforeEach(() => {
    seedNewDeck(30);
    const started = dayKey(new Date(Date.now() - 31 * DAY));
    seedHabit({ startedAt: started });
    seedResults(
      ["w20", "w21", "w22", "w23"].map((entryId, i) => ({
        entryId,
        grade: "know" as const,
        timestamp: Date.now() - (10 + i) * DAY,
      }))
    );
  });

  it("is offered right after the goal, and names the words learned", () => {
    render();
    // Not before the day is done — it never stands between the user and practice.
    expect(screenText()).not.toContain("Then vs now");
    click("Start");
    answer(10);
    click("See your month in Dutch");
    expect(screenText()).toContain("30 days ago you didn’t know these words.");
    expect(screenText()).toContain("w20");
    expect(screenText()).not.toMatch(/XP|points/);
    click("See you tomorrow");
    expect(storedHabit().lastReflection).toBe(today());
    expect(container.querySelector(".practice-card")).not.toBeNull();
  });

  it("can be put off, and isn't offered again once seen", () => {
    render();
    click("Start");
    answer(10);
    click("See your month in Dutch");
    click("See you tomorrow");
    click("A few more, just for fun");
    answer(10);
    expect(screenText()).not.toContain("See your month in Dutch");
  });
});

describe("6. settings", () => {
  beforeEach(() => {
    seedNewDeck(30);
    seedHabit();
  });

  it("lets every onboarding choice be changed", () => {
    render();
    click("Settings");
    expect(screenText()).toContain("Your daily Dutch");
    setTime("21:30");
    click("6");
    expect(storedHabit()).toMatchObject({ time: "21:30", weeklyTarget: 6 });
    expect(screenText()).toContain("never resets your progress");
    click("Home");
    expect(cardText()).toContain("🌙 Your Dutch at 21:30");
  });

  it("sizes the next session to a changed commitment", () => {
    seedDueDeck(30);
    render();
    click("Settings");
    click("Ontbijt");
    click("Home");
    click("Start");
    expect(practiceCounter()).toBe("0/20");
  });
});

describe("7. the deck", () => {
  beforeEach(() => {
    seedHabit();
  });

  it("puts a removed word back, progress and all, on Undo", () => {
    const practised = { ...newDeckItem("w0", new Date()), level: 4, reps: 4, state: "learning" as const };
    localStorage.setItem("woordkast.deck", JSON.stringify([practised, newDeckItem("w1", new Date(Date.now() - 1))]));
    render();
    click("Deck");
    click("Remove w0 from deck");
    expect(screenText()).toContain("w0 removed from your deck");
    expect(JSON.parse(localStorage.getItem("woordkast.deck")!).map((d: { id: string }) => d.id)).toEqual(["w1"]);

    click("Undo");
    const deck = JSON.parse(localStorage.getItem("woordkast.deck")!);
    expect(deck.map((d: { id: string }) => d.id)).toEqual(["w0", "w1"]);
    expect(deck[0]).toMatchObject({ level: 4, reps: 4 });
  });

  it("keeps the settings time field editable through a half-typed value", () => {
    seedNewDeck(5);
    render();
    click("Settings");
    setTime("");
    expect(container.querySelector<HTMLInputElement>('input[type="time"]')!.value).toBe("");
    setTime("19:15");
    expect(storedHabit().time).toBe("19:15");
  });
});
