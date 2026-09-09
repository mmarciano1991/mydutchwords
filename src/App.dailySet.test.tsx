// @vitest-environment jsdom
/* End-to-end cover for the daily-set practice loop, driven through the real
   App: draw a set, answer some of it, and check the dashboard card reports
   the status the design calls for (Figma 304:1118).

   This exists because the states are only reachable by actually playing the
   app — the pure dailySet tests can't catch a mis-wiring between the log,
   the set and the card. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "./App";
import { newDeckItem } from "./lib/storage";

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
function screenText(): string {
  return container.textContent ?? "";
}

/** True while the result screen is up (it is the only screen with StatCards). */
function onResultPage(): boolean {
  return screenText().includes("Back to dashboard");
}

/** The result screen's two counters, [knew it, to review]. */
function resultCounts(): string[] {
  return [...container.querySelectorAll(".stat-card__value")].map((n) => n.textContent ?? "");
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

/** Answers `count` cards, all correct unless listed in `missed` (by index). */
function answer(count: number, missed: number[] = []) {
  for (let i = 0; i < count; i++) {
    click(missed.includes(i) ? "Still learning" : "I knew it");
  }
}

/** Writes a deck of `count` brand-new words to storage. */
function seedNewDeck(count: number) {
  const deck = Array.from({ length: count }, (_, i) => newDeckItem(`w${i}`, new Date()));
  localStorage.setItem("woordkast.deck", JSON.stringify(deck));
}

/** A returning user's deck: every word already practised and scheduled days
 *  out, so nothing is due and nothing is new. */
function seedPractisedDeck(count: number) {
  const deck = Array.from({ length: count }, (_, i) => ({
    ...newDeckItem(`w${i}`, new Date()),
    level: 3,
    interval: 7,
    reps: 3,
    state: "learning" as const,
    dueDate: new Date(Date.now() + (i + 2) * 86_400_000).toISOString(),
    lastReviewedAt: new Date().toISOString(),
  }));
  localStorage.setItem("woordkast.deck", JSON.stringify(deck));
}

beforeEach(() => {
  localStorage.clear();
  // 20 brand-new words, so a full set of 16 can be drawn with room to spare.
  seedNewDeck(20);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("1. the result page is the mandatory last step", () => {
  it("is reached after a perfect sitting", () => {
    render();
    click("Start practice");
    answer(16);
    expect(onResultPage()).toBe(true);
    expect(screenText()).toContain("Helemaal goed!");
  });

  it("is reached after an all-wrong sitting", () => {
    render();
    click("Start practice");
    answer(16, [...Array(16).keys()]);
    expect(onResultPage()).toBe(true);
    expect(resultCounts()).toEqual(["0", "16"]);
  });

  it("is reached after a mixed sitting", () => {
    render();
    click("Start practice");
    answer(16, [1, 4, 7]);
    expect(onResultPage()).toBe(true);
    expect(resultCounts()).toEqual(["13", "3"]);
  });

  it("is reached after a re-drill, not just the first sitting", () => {
    render();
    click("Start practice");
    answer(16, [0, 1]);
    click("Back to dashboard");
    click("Practise these 2 again");
    answer(2);
    expect(onResultPage()).toBe(true);
  });

  it("does not fall through to the dashboard on its own", () => {
    render();
    click("Start practice");
    answer(16);
    // Still on the result page: nothing navigated past it.
    expect(container.querySelector(".practice-card")).toBeNull();
  });

  it("returns to the dashboard only when the user leaves it", () => {
    render();
    click("Start practice");
    answer(16);
    click("Back to dashboard");
    expect(onResultPage()).toBe(false);
    expect(cardText()).toContain("Mooi gedaan!");
  });

  // Abandoning is not completing, so it must NOT stop at the result page.
  it("is skipped when the user abandons part-way", () => {
    render();
    click("Start practice");
    answer(3);
    click("Close practice");
    expect(onResultPage()).toBe(false);
    expect(cardText()).toContain("13 words to go");
  });
});

describe("2. the practice card reports the real sitting", () => {
  it("never started → ready", () => {
    render();
    expect(cardText()).toContain("16 words are ready for you.");
    expect(cardText()).toContain("Start practice");
  });

  it("start → stop halfway → in progress with real progress", () => {
    render();
    click("Start practice");
    answer(6);
    click("Close practice");
    expect(cardText()).toContain("Pick up where you left off.");
    expect(cardText()).toContain("10 words to go");
  });

  it("a wrong answer still counts as answered, so progress advances", () => {
    render();
    click("Start practice");
    answer(4, [0, 1, 2, 3]);
    click("Close practice");
    expect(cardText()).toContain("12 words to go");
  });

  it("all wrong → the card shows nothing known", () => {
    render();
    click("Start practice");
    answer(16, [...Array(16).keys()]);
    click("Back to dashboard");
    const values = [...container.querySelectorAll(".learning-dash__value")].map((n) => n.textContent);
    expect(values).toEqual(["0", "16"]);
    expect(cardText()).toContain("Practise these 16 again");
  });

  it("all correct → the card shows everything known", () => {
    render();
    click("Start practice");
    answer(16);
    click("Back to dashboard");
    const values = [...container.querySelectorAll(".learning-dash__value")].map((n) => n.textContent);
    expect(values).toEqual(["16", "0"]);
    // Nothing to re-drill, so that action is gone; the whole set is still offered.
    expect(cardText()).not.toContain("Practise these");
    expect(cardText()).toContain("Practise all 16 again");
  });

  it("mostly wrong → the card reports it as such", () => {
    render();
    click("Start practice");
    answer(16, [...Array(14).keys()]);
    click("Back to dashboard");
    const values = [...container.querySelectorAll(".learning-dash__value")].map((n) => n.textContent);
    expect(values).toEqual(["2", "14"]);
  });

  // The reported symptom: a finished set kept its old, better result after a
  // re-drill went badly, so words the user had just missed still read as known.
  it("a re-drill that goes badly replaces the earlier good result", () => {
    render();
    click("Start practice");
    answer(16);
    click("Back to dashboard");
    expect(
      [...container.querySelectorAll(".learning-dash__value")].map((n) => n.textContent)
    ).toEqual(["16", "0"]);

    click("Practise all 16 again");
    answer(16, [...Array(16).keys()]);
    click("Back to dashboard");
    expect(
      [...container.querySelectorAll(".learning-dash__value")].map((n) => n.textContent)
    ).toEqual(["0", "16"]);
  });

  it("a re-drill that goes well is credited", () => {
    render();
    click("Start practice");
    answer(16, [0, 1, 2, 3]);
    click("Back to dashboard");
    click("Practise these 4 again");
    answer(4);
    click("Back to dashboard");
    expect(
      [...container.querySelectorAll(".learning-dash__value")].map((n) => n.textContent)
    ).toEqual(["4", "0"]);
  });

  it("starting a new sitting resets the card out of its old result", () => {
    render();
    click("Start practice");
    answer(16, [0]);
    click("Back to dashboard");
    expect(cardText()).toContain("Mooi gedaan!");

    click("Practise all 16 again");
    answer(1);
    click("Close practice");
    // Fresh run: not the old result, and not "done".
    expect(cardText()).not.toContain("Mooi gedaan!");
    expect(cardText()).toContain("15 words to go");
  });

  it("resuming continues the same sitting rather than restarting it", () => {
    render();
    click("Start practice");
    answer(6);
    click("Close practice");
    click("Continue");
    answer(10);
    click("Back to dashboard");
    expect(cardText()).toContain("Mooi gedaan!");
    expect(
      [...container.querySelectorAll(".learning-dash__value")].map((n) => n.textContent)
    ).toEqual(["16", "0"]);
  });
});

describe("3. state survives a reload", () => {
  function reload() {
    act(() => root.unmount());
    container.remove();
    render();
  }

  it("keeps an in-progress sitting", () => {
    render();
    click("Start practice");
    answer(4, [0]);
    click("Close practice");
    reload();
    expect(cardText()).toContain("12 words to go");
  });

  it("keeps a completed result", () => {
    render();
    click("Start practice");
    answer(16, [3, 4]);
    click("Back to dashboard");
    reload();
    expect(cardText()).toContain("Mooi gedaan!");
    expect(
      [...container.querySelectorAll(".learning-dash__value")].map((n) => n.textContent)
    ).toEqual(["14", "2"]);
  });

  it("resumes correctly after a reload mid-sitting", () => {
    render();
    click("Start practice");
    answer(4);
    click("Close practice");
    reload();
    click("Continue");
    answer(12);
    expect(onResultPage()).toBe(true);
    expect(resultCounts()).toEqual(["16", "0"]);
  });
});

/* Regression: a deck whose reviews all fall next week used to draw an *empty*
   set, so the dashboard sat on the caught-up card and the practice states
   were unreachable for any established user. */
describe("4. an established deck with nothing due still gets a full day", () => {
  beforeEach(() => {
    localStorage.clear();
    seedPractisedDeck(40);
  });

  it("draws a full set rather than showing the caught-up card", () => {
    render();
    expect(cardText()).toContain("16 words are ready for you.");
  });

  it("runs the whole flow through the result page", () => {
    render();
    click("Start practice");
    answer(5);
    click("Close practice");
    expect(cardText()).toContain("11 words to go");

    click("Continue");
    answer(11, [0, 1]);
    expect(onResultPage()).toBe(true);
    click("Back to dashboard");
    expect(
      [...container.querySelectorAll(".learning-dash__value")].map((n) => n.textContent)
    ).toEqual(["14", "2"]);
  });
});
