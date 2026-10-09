// @vitest-environment jsdom
/* Each exercise type, rendered and graded through the real Practice screen.
   The screen only reports results (onAnswer); what they do to a word is
   covered by learningEngine.test. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Practice, type StepAnswer } from "./Practice";
import { newWord, type ExerciseType, type PlannedStep } from "../lib/learningEngine";
import { ANSWER_MS } from "../components/exercises/FlashcardExercise";
import { MATCH_RIGHT_MS, MATCH_WRONG_MS } from "../components/exercises/MatchingExercise";
import type { DictionaryEntry, Gender } from "../lib/types";
import type { PriorItems } from "../lib/sessionQueue";
import { REVIEW_RETRY_LIMIT } from "../lib/learningConfig";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function entry(dutch: string, english: string, over: Partial<DictionaryEntry> = {}): DictionaryEntry {
  const gender: Gender = over.gender ?? "none";
  return {
    id: dutch,
    dutch,
    english,
    gender,
    example: "",
    exampleEn: "",
    senses: [{ english, example: "", exampleEn: "", gender }],
    ...over,
  };
}

const POOL = [
  entry("huis", "house", { gender: "het", example: "Het huis is groot.", exampleEn: "The house is big." }),
  entry("doen", "to do", { example: "Hij doet de deur dicht.", exampleEn: "He closes the door." }),
  entry("fiets", "bike", { gender: "de" }),
  entry("werk", "work", { gender: "het" }),
  entry("trein", "train", { gender: "de" }),
  entry("buur", "neighbour", { gender: "de" }),
  entry("huid", "skin", { gender: "de" }),
];
const byDutch = (d: string) => POOL.find((e) => e.dutch === d)!;

let container: HTMLDivElement;
let root: Root;
let answers: StepAnswer[];
let finished: boolean;
let handedOn: string[] | null;
let closedWith: string[] | null;

function render(steps: PlannedStep[], prior?: PriorItems) {
  answers = [];
  finished = false;
  handedOn = null;
  closedWith = null;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const ids = new Set([...steps.flatMap((s) => s.wordIds), ...(prior?.completed ?? []), ...(prior?.review ?? []).map((r) => r.id)]);
  act(() =>
    root.render(
      <Practice
        steps={steps}
        cards={POOL.filter((e) => ids.has(e.id)).map((e) => ({ entry: e, word: newWord(e.id, new Date()) }))}
        prior={prior}
        pool={POOL}
        isKnownWord={(w) => POOL.some((e) => e.dutch === w)}
        onAnswer={(a) => answers.push(a)}
        onFinish={(deferred) => {
          finished = true;
          handedOn = deferred;
        }}
        onClose={(carry) => (closedWith = carry)}
      />
    )
  );
}

const step = (kind: ExerciseType, ...wordIds: string[]): PlannedStep => ({ kind, wordIds, graded: kind !== "flashcard" });
const text = () => container.textContent ?? "";
/** "1/4" from the progress bar. */
const progressNow = () => {
  const bar = container.querySelector('[role="progressbar"]')!;
  return `${bar.getAttribute("aria-valuenow")}/${bar.getAttribute("aria-valuemax")}`;
};
const buttons = (selector = "button") => [...container.querySelectorAll<HTMLButtonElement>(selector)];

function click(label: string | HTMLElement) {
  const el =
    typeof label === "string"
      ? buttons().find((b) => b.textContent?.trim() === label || b.getAttribute("aria-label") === label)
      : label;
  if (!el) throw new Error(`no button "${label}" in: ${text()}`);
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

/** Selects an option, then checks it in the answer panel. */
function choose(option: HTMLButtonElement) {
  click(option);
  click("Check");
}

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("Flashcard", () => {
  it("flips on tap and can be rated on either face — logged as exposure only", () => {
    render([step("flashcard", "huis"), step("multiple_choice", "huis")]);
    // Rateable straight away, before turning the card.
    expect(text()).toContain("I knew it");
    click(container.querySelector<HTMLElement>(".flashcard")!);
    expect(container.querySelector(".flashcard__inner.is-flipped")).not.toBeNull();
    click("I knew it");
    // The card holds its result, then flies off, before the next exercise comes in.
    act(() => vi.advanceTimersByTime(ANSWER_MS));
    expect(answers).toEqual([expect.objectContaining({ wordId: "huis", exerciseType: "flashcard", result: "exposure", final: false })]);
    // On to the word's own exercise.
    expect(container.querySelectorAll(".answer-option")).toHaveLength(4);
  });
});

describe("Multiple Choice", () => {
  it("shows the Dutch word and four English options; a miss shows the answer and its sentence, then moves on", () => {
    render([step("multiple_choice", "huis"), step("active_recall", "fiets")]);
    expect(container.querySelector(".exercise__word")?.textContent).toBe("huis");
    const options = buttons(".answer-option");
    expect(options).toHaveLength(4);
    // Nothing to check until an option is selected; selecting grades nothing.
    expect(buttons().find((b) => b.textContent === "Check")!.disabled).toBe(true);
    click(options.find((b) => b.textContent !== "house")!);
    expect(answers).toHaveLength(0);
    click("Check");
    expect(answers[0]).toMatchObject({ wordId: "huis", exerciseType: "multiple_choice", result: "wrong", final: true });
    expect(text()).toContain("Not quite, the answer is house");
    expect(container.querySelector(".answer-panel .context-sentence__target")?.textContent).toBe("huis");
    expect(text()).toContain("It’ll come back in a moment.");
    click("Got it");
    // On with the main queue; the miss waits for review.
    expect(container.querySelector(".exercise__word")?.textContent).toBe("bike");
  });

  it("grades the right option correct", () => {
    render([step("multiple_choice", "huis")]);
    choose(buttons(".answer-option").find((b) => b.textContent === "house")!);
    expect(answers[0].result).toBe("correct");
    expect(text()).toContain("Correct");
    click("Continue");
    expect(finished).toBe(true);
  });

  it("\"I do not know\" shows the answer and is logged as dont_know", () => {
    render([step("multiple_choice", "huis")]);
    click("I do not know");
    expect(answers[0].result).toBe("dont_know");
    expect(text()).toContain("the answer is house");
    click("Got it");
    // Not mastered: it comes back for review.
    expect(finished).toBe(false);
    expect(container.querySelector(".exercise__word")?.textContent).toBe("huis");
    expect(progressNow()).toBe("0/1");
  });
});

describe("Active Recall", () => {
  it("shows the translation with the article it takes", () => {
    render([step("active_recall", "huis")]);
    expect(container.querySelector(".exercise__word")?.textContent).toBe("house");
    // A noun shows the article its Dutch answer takes, as the chip.
    expect(container.querySelector(".exercise__prompt .chip")?.textContent).toBe("het");
  });

  it("accepts a wrong article, and says which is right", () => {
    render([step("active_recall", "huis")]);
    type("de huis");
    expect(answers[0].result).toBe("correct");
    expect(text()).toContain("Correct — it’s het huis");
  });

  it("grades a typo as almost", () => {
    render([step("active_recall", "fiets")]);
    type("fiest");
    expect(answers[0].result).toBe("almost");
    expect(text()).toContain("Almost — it’s spelled de fiets");
  });

  it("\"I don't know\" reveals the answer and is logged as dont_know", () => {
    render([step("active_recall", "huis")]);
    click("I do not know");
    expect(answers[0].result).toBe("dont_know");
    expect(text()).toContain("The answer is het huis");
  });
});

describe("Sentence Completion", () => {
  it("blanks the form used in the sentence, with the translation below", () => {
    render([step("sentence_completion", "doen")]);
    expect(container.querySelector(".exercise__sentence")?.textContent).not.toContain("doet");
    expect(text()).toContain("He closes the door.");
  });

  it("accepts the exact form", () => {
    render([step("sentence_completion", "doen")]);
    type("doet");
    expect(answers[0]).toMatchObject({ exerciseType: "sentence_completion", result: "correct" });
  });

  it("marks the dictionary form almost: right word, wrong form", () => {
    render([step("sentence_completion", "doen")]);
    type("doen");
    expect(answers[0].result).toBe("almost");
    expect(text()).toContain("Right word — in this sentence it’s doet");
  });

  it("is asked as Active Recall when the word has no usable sentence", () => {
    render([step("sentence_completion", "fiets")]);
    expect(container.querySelector(".exercise__prompt .chip")?.textContent).toBe("de");
    type("fiets");
    expect(answers[0].exerciseType).toBe("active_recall");
  });
});

describe("Listening", () => {
  it("offers four Dutch words, similar-looking first", () => {
    render([step("listening", "huis")]);
    const options = buttons(".answer-option").map((b) => b.textContent);
    expect(options).toHaveLength(4);
    expect(options).toContain("huis");
    expect(options).toContain("huid");
  });

  it("\"I can’t listen now\" isn't a mistake or progress: the word is asked another way at once", () => {
    render([step("listening", "huis"), step("active_recall", "fiets")]);
    click("I can’t listen now");
    expect(answers[0]).toMatchObject({ exerciseType: "listening", result: "skipped", final: true, review: false });
    expect(progressNow()).toBe("0/2");
    // The same word, as Multiple Choice — no audio.
    expect(container.querySelector(".exercise__word")?.textContent).toBe("huis");
    choose(buttons(".answer-option").find((b) => b.textContent === "house")!);
    expect(answers[1]).toMatchObject({ wordId: "huis", exerciseType: "multiple_choice", result: "correct", final: true, review: false });
    expect(progressNow()).toBe("1/2");
    click("Continue");
    expect(container.querySelector(".exercise__word")?.textContent).toBe("bike");
  });
});

describe("Matching", () => {
  const ids = ["huis", "fiets", "werk", "trein"];
  const nl = (d: string) => buttons(".match-option").find((b) => b.textContent === d && b.lang === "nl")!;
  const en = (d: string) => buttons(".match-option").find((b) => b.textContent === byDutch(d).english && b.lang === "en")!;
  /** A pair is checked as soon as its second word is tapped. */
  function pair(a: HTMLButtonElement, b: HTMLButtonElement) {
    click(a);
    click(b);
  }
  const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it("selects a first word and waits for one from the other column", () => {
    render([step("matching", ...ids)]);
    expect(buttons().some((b) => b.textContent === "Check")).toBe(false);
    click(nl("huis"));
    expect(nl("huis").className).toContain("is-selected");
    click(nl("fiets")); // same column: the selection moves, nothing is checked
    expect(nl("huis").className).not.toContain("is-selected");
    expect(nl("fiets").className).toContain("is-selected");
    click(nl("fiets")); // tapped again: unselected
    expect(nl("fiets").className).not.toContain("is-selected");
    expect(answers).toEqual([]);
  });

  it("a right pair flashes green on the tiles alone, then stays done and disabled", () => {
    render([step("matching", ...ids)]);
    pair(en("huis"), nl("huis"));
    expect(nl("huis").className).toContain("is-right");
    expect(en("huis").className).toContain("is-right");
    expect(container.querySelector(".answer-panel--correct")).toBeNull();
    expect(text()).toContain("I do not know");
    expect(nl("huis").disabled && en("huis").disabled).toBe(true);
    expect(answers).toMatchObject([{ wordId: "huis", result: "correct" }]);
    wait(MATCH_RIGHT_MS);
    expect(nl("huis").className).toContain("is-matched");
    expect(container.querySelector(".answer-panel--correct")).toBeNull();
    click(nl("huis")); // disabled: no effect
    expect(nl("huis").className).not.toContain("is-selected");
  });

  it("a wrong pair flashes red on the tiles alone, then resets both words — finished pairs untouched", () => {
    render([step("matching", ...ids)]);
    pair(nl("werk"), en("werk"));
    pair(nl("huis"), en("fiets"));
    expect(nl("huis").className).toContain("is-wrong");
    expect(en("fiets").className).toContain("is-wrong");
    expect(container.querySelector(".answer-panel--wrong")).toBeNull();
    expect(text()).toContain("I do not know");
    wait(MATCH_WRONG_MS);
    for (const b of [nl("huis"), en("fiets")]) {
      expect(b.className).not.toMatch(/is-(wrong|selected)/);
      expect(b.disabled).toBe(false);
    }
    expect(nl("werk").className).toContain("is-matched");
    expect(nl("werk").disabled).toBe(true);
    pair(nl("huis"), en("huis")); // free to try again
    expect(nl("huis").className).toContain("is-right");
  });

  it("a tap during a verdict ends it at once and counts as a fresh selection", () => {
    render([step("matching", ...ids)]);
    pair(nl("huis"), en("fiets"));
    click(nl("fiets"));
    expect(nl("huis").className).not.toContain("is-wrong");
    expect(nl("fiets").className).toContain("is-selected");
    click(en("fiets"));
    expect(nl("fiets").className).toContain("is-right");
  });

  it("grades each word: correct only when matched right the first time", () => {
    render([step("matching", ...ids)]);
    pair(nl("huis"), en("fiets")); // wrong pair — counts against "huis"
    for (const d of ids) pair(nl(d), en(d));
    const results = Object.fromEntries(answers.map((a) => [a.wordId, a.result]));
    expect(results).toEqual({ huis: "wrong", fiets: "correct", werk: "correct", trein: "correct" });
    expect(answers.every((a) => a.exerciseType === "matching" && a.final)).toBe(true);
    expect(progressNow()).toBe("3/4");
    click("Continue");
    // The missed word comes back on its own, as Multiple Choice.
    expect(finished).toBe(false);
    expect(container.querySelector(".exercise__word")?.textContent).toBe("huis");
    expect(buttons(".answer-option")).toHaveLength(4);
  });

  it("completes in any order and column, with Correct and Continue only at the end", () => {
    render([step("matching", ...ids)]);
    pair(en("trein"), nl("trein"));
    pair(nl("fiets"), en("fiets"));
    pair(en("huis"), nl("huis"));
    wait(MATCH_RIGHT_MS);
    expect(buttons().some((b) => b.textContent === "Continue")).toBe(false);
    pair(nl("werk"), en("werk"));
    wait(MATCH_RIGHT_MS);
    expect(container.querySelector(".answer-panel--correct")?.textContent).toContain("Correct");
    expect(buttons(".match-option").every((b) => b.disabled && b.className.includes("is-matched"))).toBe(true);
    expect(answers.map((a) => a.result)).toEqual(["correct", "correct", "correct", "correct"]);
    click("Continue");
    expect(finished).toBe(true);
  });

  it("\"I do not know\" reveals the open pairs and logs them as dont_know", () => {
    render([step("matching", ...ids)]);
    pair(nl("huis"), en("huis"));
    click("I do not know");
    const results = Object.fromEntries(answers.map((a) => [a.wordId, a.result]));
    expect(results).toEqual({ huis: "correct", fiets: "dont_know", werk: "dont_know", trein: "dont_know" });
    expect(progressNow()).toBe("1/4");
    click("Got it");
    expect(finished).toBe(false);
    expect(container.querySelector(".exercise__word")?.textContent).toBe("fiets");
  });
});

describe("review queue", () => {
  const word = () => container.querySelector(".exercise__word")?.textContent;
  const pick = (english: string, right: boolean) =>
    choose(buttons(".answer-option").find((b) => (b.textContent === english) === right)!);

  it("asks the misses again after the main queue, ungraded, and counts them once right", () => {
    render([step("multiple_choice", "huis"), step("multiple_choice", "fiets")]);
    pick("house", false);
    click("Got it");
    pick("bike", true);
    expect(progressNow()).toBe("1/2");
    click("Continue");
    expect(word()).toBe("huis");
    pick("house", true);
    expect(answers[2]).toMatchObject({ wordId: "huis", result: "correct", final: true, review: true });
    expect(progressNow()).toBe("2/2");
    click("Continue");
    expect(finished).toBe(true);
    expect(handedOn).toEqual([]);
  });

  it(`hands a word on to the next session after ${REVIEW_RETRY_LIMIT} more misses — no endless loop`, () => {
    render([step("multiple_choice", "huis")]);
    for (let i = 0; i < REVIEW_RETRY_LIMIT; i++) {
      pick("house", false);
      expect(text()).toContain("It’ll come back in a moment.");
      click("Got it");
      expect(word()).toBe("huis");
    }
    pick("house", false);
    expect(text()).toContain("It’ll come back next session.");
    click("Got it");
    expect(finished).toBe(true);
    expect(handedOn).toEqual(["huis"]);
    expect(answers.filter((a) => a.review)).toHaveLength(REVIEW_RETRY_LIMIT);
  });

  it("leaving part-way hands on the words still waiting for review", () => {
    render([step("multiple_choice", "huis"), step("multiple_choice", "fiets")]);
    pick("house", false);
    click("Got it");
    click("Close practice");
    expect(closedWith).toEqual(["huis"]);
  });

  it("a resumed session counts its mastered words and reviews its misses", () => {
    render([step("multiple_choice", "fiets")], {
      completed: ["werk"],
      review: [{ id: "huis", kind: "matching", misses: 1 }],
    });
    expect(progressNow()).toBe("1/3");
    pick("bike", true);
    click("Continue");
    expect(word()).toBe("huis");
    pick("house", true);
    expect(progressNow()).toBe("3/3");
  });
});

describe("progress bar", () => {
  it("counts words mastered, not steps answered — an intro flashcard is no progress", () => {
    render([step("flashcard", "huis"), step("multiple_choice", "huis"), step("active_recall", "fiets")]);
    expect(progressNow()).toBe("0/2");
    click("I knew it");
    act(() => vi.advanceTimersByTime(ANSWER_MS));
    expect(progressNow()).toBe("0/2");
    choose(buttons(".answer-option").find((b) => b.textContent === "house")!);
    expect(progressNow()).toBe("1/2");
    click("Continue");
    click("I do not know");
    expect(progressNow()).toBe("1/2");
  });
});
