// @vitest-environment jsdom
/* What a session sounds like, through the real Practice screen: each answer
   makes its sound exactly once, the session's end makes its own only when
   it really ends, and every exercise says its Dutch word at the right
   moment — never two at once. The sound and speech modules are stand-ins
   that record what they were asked to do. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DictionaryEntry, Gender } from "../lib/types";
import { newWord, type ExerciseType, type PlannedStep } from "../lib/learningEngine";

const log = vi.hoisted(() => ({ sounds: [] as string[], spoken: [] as string[], stops: 0 }));

vi.mock("../lib/sfx", () => ({
  playSound: (name: string) => log.sounds.push(name),
  SOUND_MS: { correct: 380, wrong: 480, complete: 1500 },
  soundEffectsMuted: () => false,
  setSoundEffectsMuted: () => {},
}));
vi.mock("../lib/audio", () => ({
  speakDutch: (text: string) => {
    log.spoken.push(text);
    return true;
  },
  stopDutch: () => void log.stops++,
  preloadDutch: () => Promise.resolve(null),
}));

const { Practice } = await import("./Practice");
const { ANSWER_MS } = await import("../components/exercises/FlashcardExercise");

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function entry(dutch: string, english: string, over: Partial<DictionaryEntry> = {}): DictionaryEntry {
  const gender: Gender = over.gender ?? "none";
  return { id: dutch, dutch, english, gender, example: "", exampleEn: "", senses: [{ english, example: "", exampleEn: "", gender }], ...over };
}

const POOL = [
  entry("huis", "house", { gender: "het" }),
  entry("doen", "to do", { example: "Hij doet de deur dicht.", exampleEn: "He closes the door." }),
  entry("fiets", "bike", { gender: "de" }),
  entry("werk", "work", { gender: "het" }),
  entry("trein", "train", { gender: "de" }),
  entry("buur", "neighbour", { gender: "de" }),
];

let container: HTMLDivElement;
let root: Root;
let finished: boolean;
let closed: boolean;

function render(steps: PlannedStep[]) {
  finished = false;
  closed = false;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const ids = new Set(steps.flatMap((s) => s.wordIds));
  act(() =>
    root.render(
      <Practice
        steps={steps}
        cards={POOL.filter((e) => ids.has(e.id)).map((e) => ({ entry: e, word: newWord(e.id, new Date()) }))}
        pool={POOL}
        isKnownWord={(w) => POOL.some((e) => e.dutch === w)}
        onAnswer={() => {}}
        onFinish={() => (finished = true)}
        onClose={() => (closed = true)}
      />
    )
  );
}

const step = (kind: ExerciseType, ...wordIds: string[]): PlannedStep => ({ kind, wordIds, graded: kind !== "flashcard" });
const buttons = (selector = "button") => [...container.querySelectorAll<HTMLButtonElement>(selector)];
function click(label: string | HTMLElement) {
  const el = typeof label === "string" ? buttons().find((b) => b.textContent?.trim() === label || b.getAttribute("aria-label") === label) : label;
  if (!el) throw new Error(`no button "${label}" in: ${container.textContent}`);
  act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
function type(value: string) {
  const input = container.querySelector<HTMLInputElement>(".answer-bar__input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => input.form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}
const option = (text: string) => buttons(".answer-option").find((b) => b.textContent === text)!;
const notOption = (text: string) => buttons(".answer-option").find((b) => b.textContent !== text)!;

beforeEach(() => {
  vi.useFakeTimers();
  log.sounds = [];
  log.spoken = [];
  log.stops = 0;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("answer sounds", () => {
  it("a right choice chimes once; Continue on the last word plays the session's end", () => {
    render([step("multiple_choice", "huis")]);
    click(option("house"));
    expect(log.sounds).toEqual([]); // selecting isn't answering
    click("Check");
    expect(log.sounds).toEqual(["correct"]);
    click("Continue");
    expect(finished).toBe(true);
    expect(log.sounds).toEqual(["correct", "complete"]);
  });

  it("a wrong choice sounds once — and the end waits until the re-ask is right", () => {
    render([step("multiple_choice", "huis")]);
    click(notOption("house"));
    click("Check");
    expect(log.sounds).toEqual(["wrong"]);
    click("Got it");
    expect(finished).toBe(false);
    expect(log.sounds).toEqual(["wrong"]);
    click(option("house"));
    click("Check");
    click("Continue");
    expect(finished).toBe(true);
    expect(log.sounds).toEqual(["wrong", "correct", "complete"]);
  });

  it("\"I do not know\" makes no sound — not knowing isn't a mistake", () => {
    render([step("multiple_choice", "huis"), step("multiple_choice", "fiets")]);
    click("I do not know");
    expect(log.sounds).toEqual([]);
  });

  it("typed answers: right, almost and wrong each sound once", () => {
    render([step("active_recall", "huis"), step("active_recall", "fiets"), step("active_recall", "trein")]);
    type("huis");
    click("Continue");
    type("fiest"); // a typo: almost
    click("Continue");
    type("zzz");
    expect(log.sounds).toEqual(["correct", "correct", "wrong"]);
  });

  it("a flashcard rating makes no answer sound", () => {
    render([step("flashcard", "huis"), step("multiple_choice", "huis")]);
    click("I knew it");
    act(() => vi.advanceTimersByTime(ANSWER_MS));
    expect(log.sounds).toEqual([]);
  });

  it("leaving a session part-way never plays the end", () => {
    render([step("multiple_choice", "huis"), step("multiple_choice", "fiets")]);
    click(option("house"));
    click("Check");
    click("Continue");
    click("Close practice");
    expect(closed).toBe(true);
    expect(log.sounds).toEqual(["correct"]);
  });
});

describe("Matching sounds", () => {
  const ids = ["huis", "fiets", "werk", "trein"];
  const nl = (d: string) => buttons(".match-option").find((b) => b.lang === "nl" && b.textContent === d)!;
  const en = (d: string) => buttons(".match-option").find((b) => b.lang === "en" && b.textContent === POOL.find((e) => e.dutch === d)!.english)!;

  it("each pair sounds once — a late right pair still sounds right", () => {
    render([step("matching", ...ids)]);
    click(en("fiets"));
    click(nl("huis")); // wrong pair
    expect(log.sounds).toEqual(["wrong"]);
    click(nl("huis"));
    click(en("huis")); // right now — graded "wrong" for the miss, but it IS right
    expect(log.sounds).toEqual(["wrong", "correct"]);
    for (const d of ["fiets", "werk", "trein"]) {
      click(nl(d));
      click(en(d));
    }
    expect(log.sounds).toEqual(["wrong", "correct", "correct", "correct", "correct"]);
    click("Continue");
    // "huis" was missed, so it's asked again: the session isn't over yet.
    expect(finished).toBe(false);
    expect(log.sounds).not.toContain("complete");
  });

  it("a clean grid ends the session with one end sound", () => {
    render([step("matching", ...ids)]);
    for (const d of ids) {
      click(nl(d));
      click(en(d));
    }
    click("Continue");
    expect(finished).toBe(true);
    expect(log.sounds).toEqual(["correct", "correct", "correct", "correct", "complete"]);
  });

  it("revealing the pairs is silent", () => {
    render([step("matching", ...ids)]);
    click(nl("huis"));
    click(en("fiets"));
    log.sounds = [];
    click("I do not know");
    expect(log.sounds).toEqual([]);
  });
});

describe("spoken words", () => {
  it("Flashcard, Multiple Choice and Listening say the word as they appear", () => {
    render([step("flashcard", "huis"), step("multiple_choice", "fiets")]);
    expect(log.spoken).toEqual(["huis"]);
    click("I knew it");
    act(() => vi.advanceTimersByTime(ANSWER_MS));
    expect(log.spoken).toEqual(["huis", "fiets"]);
  });

  it("Listening's Play again says it again", () => {
    render([step("listening", "huis")]);
    expect(log.spoken).toEqual(["huis"]);
    click(container.querySelector<HTMLElement>(".listen-button")!);
    expect(log.spoken).toEqual(["huis", "huis"]);
  });

  it("Active Recall and Sentence Completion keep quiet until answered, then say the answer", () => {
    render([step("active_recall", "huis"), step("sentence_completion", "doen")]);
    expect(log.spoken).toEqual([]);
    type("huis");
    expect(log.spoken).toEqual(["het huis"]);
    click("Continue");
    expect(log.spoken).toEqual(["het huis"]);
    type("doet");
    expect(log.spoken).toEqual(["het huis", "doet"]);
  });

  it("Matching says a Dutch word when its tile is tapped", () => {
    render([step("matching", "huis", "fiets", "werk", "trein")]);
    expect(log.spoken).toEqual([]);
    click(buttons(".match-option").find((b) => b.lang === "nl" && b.textContent === "werk")!);
    click(buttons(".match-option").find((b) => b.lang === "en" && b.textContent === "bike")!);
    expect(log.spoken).toEqual(["werk"]);
  });

  it("an exercise's word stops when it leaves the screen", () => {
    render([step("multiple_choice", "huis"), step("multiple_choice", "fiets")]);
    const before = log.stops;
    click(option("house"));
    click("Check");
    click("Continue");
    expect(log.stops).toBeGreaterThan(before);
    expect(log.spoken).toEqual(["huis", "fiets"]);
  });
});
