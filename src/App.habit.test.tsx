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
import { newDeckItem } from "./lib/storage";
import { dayKey } from "./lib/dailySet";
import { newHabit, type HabitState } from "./lib/habit";
import { ADVANCE_AFTER_CORRECT_MS } from "./screens/Practice";

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

/** The word being asked: ids are `wN`, glossed `wN-en` by the mock above. */
function currentId(): string | null {
  const prompt = container.querySelector(".exercise__word")?.textContent;
  if (prompt) return prompt.replace(/-en$/, "");
  return container.querySelector(".flashcard__face--front .flashcard__word")?.textContent ?? null;
}

/** Answers whatever exercise is on screen, right or wrong, and moves on. */
function respond(id: string, right: boolean) {
  const options = [...container.querySelectorAll<HTMLButtonElement>(".answer-option")];
  const input = container.querySelector<HTMLInputElement>(".answer-bar__input");
  if (options.length > 0) {
    const target = options.find((b) => (b.textContent === id) === right)!;
    act(() => target.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  } else if (input) {
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, right ? id : "zzz");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => input.form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  } else {
    click(right ? "I knew it" : "Still learning");
    return;
  }
  // A miss waits for Continue; a right answer moves on by itself.
  const next = container.querySelector<HTMLButtonElement>(".exercise__actions .btn--primary");
  if (next) click("Continue");
  else act(() => vi.advanceTimersByTime(ADVANCE_AFTER_CORRECT_MS));
}

function inPractice(): boolean {
  return container.querySelector('[aria-label="Close practice"]') !== null;
}

/** Answers `count` words, all correct unless listed in `missed` (by the
 *  order they're first asked). A missed word comes back later in the same
 *  sitting, and is then answered correctly — the sitting only ends once
 *  every word in it is right. Stops at the first new word past `count`. */
function answer(count: number, missed: number[] = []) {
  const seen = new Map<string, number>();
  while (inPractice()) {
    const id = currentId()!;
    if (seen.has(id)) {
      respond(id, true);
      continue;
    }
    if (seen.size === count) break;
    seen.set(id, seen.size);
    respond(id, !missed.includes(seen.get(id)!));
  }
}

/** "3/5" from the practice screen's top bar. */
function practiceCounter(): string {
  return container.querySelector(".topbar span")?.textContent ?? "";
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
  // Only the timers: a right answer advances on a timeout. Date stays real.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("1. onboarding: the 5-minute promise", () => {
  function onboard(size: string, time?: string) {
    click("Let’s start");
    click(size);
    click("Continue");
    if (time) setTime(time);
    click("Continue");
  }

  it("is shown to a new user, and ends inside the first session", () => {
    render();
    expect(screenText()).toContain("A little Dutch, every day");
    onboard("Espresso");
    // Pre-filled, so a new user can go straight through.
    expect(screenText()).toContain("Every day at 08:00, I learn 10 Dutch words.");
    click("Start my first 10 words");
    // Straight into practice — no dashboard detour, no words to add first.
    expect(practiceCounter()).toBe("0/10");
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

  it("gives a new user a starter deck so the first session can happen", () => {
    render();
    onboard("Espresso", "07:45");
    click("Start my first 10 words");
    expect(JSON.parse(localStorage.getItem("woordkast.deck")!)).toHaveLength(30);
    answer(10);
    expect(screenText()).toContain("Done for today!");
    expect(screenText()).toContain("See you tomorrow at 07:45");
  });

  it("speaks to an existing user as a change of rhythm, without adding words", () => {
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
    expect(practiceCounter()).toBe("0/20");
    expect(JSON.parse(localStorage.getItem("woordkast.deck")!)).toHaveLength(20);
  });

  it("is not shown again once done", () => {
    render();
    onboard("Espresso", "12:30");
    click("Start my first 10 words");
    reload();
    expect(screenText()).not.toContain("How much Dutch fits your day?");
    expect(container.querySelector(".practice-card")).not.toBeNull();
  });
});

describe("2. the daily goal", () => {
  beforeEach(() => {
    seedNewDeck(30);
    seedHabit();
  });

  it("asks for exactly the commitment, with the cue", () => {
    render();
    expect(cardText()).toContain("10 words");
    expect(cardText()).toContain("~5 min");
    expect(cardText()).toContain("Your Dutch at 08:00");
  });

  it("is done at the goal, and the day is recorded", () => {
    render();
    click("Start");
    expect(practiceCounter()).toBe("0/10");
    answer(10, [1]);
    expect(onResultPage()).toBe(true);
    expect(screenText()).toContain("Done for today!");
    expect(storedHabit().doneDays).toContain(today());
    click("Done");
    expect(cardText()).toContain("Done for today");
  });

  it("brings a missed word back later in the sitting, and ends once all are right", () => {
    render();
    click("Start");
    answer(10, [0, 1, 2, 3, 4]);
    expect(screenText()).toContain("Done for today!");
  });

  it("brings a miss back only after other words, not straight away", () => {
    render();
    click("Start");
    const first = currentId()!;
    respond(first, false);
    const order = [currentId()];
    respond(order[0]!, true);
    order.push(currentId());
    respond(order[1]!, true);
    order.push(currentId());
    respond(order[2]!, true);
    expect(order).not.toContain(first);
    expect(currentId()).toBe(first);
  });

  it("doesn't count a missed word toward the day until it's right", () => {
    render();
    click("Start");
    const missed = currentId()!;
    respond(missed, false);
    expect(practiceCounter()).toBe("0/10");
    click("Close practice");
    // Nothing is done yet: the card is still the day's start.
    expect(cardText()).toContain("10 words");
    expect(cardText()).not.toContain("to go");
    click("Start");
    expect(practiceCounter()).toBe("0/10");
    // The word left missed leads the next sitting.
    expect(currentId()).toBe(missed);
    answer(10);
    expect(screenText()).toContain("Done for today!");
  });

  it("offers four options for a new word, and lets a typed one be skipped", () => {
    render();
    click("Start");
    expect(container.querySelectorAll(".answer-option")).toHaveLength(4);
    const missed = currentId()!;
    respond(missed, false);
    // Three other words, then the miss again — now to be typed.
    for (let i = 0; i < 3; i++) respond(currentId()!, true);
    expect(currentId()).toBe(missed);
    expect(container.querySelector(".answer-bar__input")).not.toBeNull();
    click("Don’t know");
    expect(screenText()).toContain(`It’s ${missed}`);
    click("Continue");
    expect(practiceCounter()).toBe("3/10");
  });

  it("classifies anything past the goal as extra, and the goal stays put", () => {
    render();
    click("Start");
    answer(10);
    click("A few more, just for fun");
    expect(practiceCounter()).toBe("0/5");
    answer(5);
    expect(screenText()).toContain("Extra ✓");
    expect(screenText()).toContain("tomorrow is still just 10 words");
    click("Done");
    expect(cardText()).toContain("+5 extra today");
    expect(cardText()).toContain("Today’s 10 words are done");
  });

  it("keeps offering more once every word is practised, as an ungraded review", () => {
    seedNewDeck(15);
    render();
    click("Start");
    answer(10);
    click("A few more, just for fun");
    answer(5);
    click("Done");
    // All 15 words have had their graded answer today — still more on offer.
    click("A few more, just for fun");
    expect(practiceCounter()).toBe("0/5");
    expect(screenText()).toContain("does not change your schedule");
    answer(5);
    expect(screenText()).toContain("A few more, just for fun");
    click("Done");
    expect(cardText()).toContain("+5 extra today");
  });

  it("ends the report on Done, with more practice only as a quiet link", () => {
    render();
    click("Start");
    answer(10);
    const primary = container.querySelector(".report-actions .btn--primary");
    expect(primary?.textContent).toBe("Done");
  });

  it("resumes the words still needed after leaving part-way", () => {
    render();
    click("Start");
    answer(2);
    click("Close practice");
    expect(cardText()).toContain("8 words to go");
    click("Continue");
    expect(practiceCounter()).toBe("0/8");
    answer(8);
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

  it("re-drills missed words without counting them as new practice", () => {
    render();
    click("Start");
    answer(10, [0, 1]);
    click("Go over those 2 again");
    answer(2);
    expect(screenText()).toContain("your schedule didn’t change");
  });

  it("sizes the day to a bigger commitment", () => {
    seedHabit({ commitment: "diner" });
    render();
    expect(cardText()).toContain("30 words");
    expect(cardText()).toContain("~15 min");
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

  it("redraws today's set when the commitment changes before practising", () => {
    render();
    click("Settings");
    click("Ontbijt");
    click("Home");
    click("Start");
    expect(practiceCounter()).toBe("0/20");
  });
});
