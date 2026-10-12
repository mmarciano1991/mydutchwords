// @vitest-environment jsdom
/* Spec §10 in the exercises themselves: the synonym half answer, two blanks
   for a split separable verb, Article (de/het) and Verb form — each only for
   a sense whose data supports it. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { TypedExercise } from "./TypedExercise";
import { ArticleExercise } from "./ArticleExercise";
import { VerbFormExercise } from "./VerbFormExercise";
import { completionSentence } from "../../lib/sentenceTarget";
import { hasExerciseData } from "../../lib/exerciseData";
import { entriesOfWord } from "../../lib/dictionary/snapshot";
import { fixtureWord } from "../../lib/dictionary/testDictionary";
import type { DictionaryEntry } from "../../lib/types";
import { button, clickEl, mount, typeInto, type Mounted } from "../../test/dom";

let m: Mounted | null = null;
afterEach(() => m?.unmount());

const first = (form: string, pos?: string) => entriesOfWord(fixtureWord(form)).find((e) => !pos || e.snapshot!.pos === pos)!;

function submit(value: string) {
  const input = m!.container.querySelector<HTMLInputElement>("input")!;
  typeInto(input, value);
  const form = m!.container.querySelector("form")!;
  act(() => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("Active Recall: a verified synonym is a half answer", () => {
  it("“Correct, and the word you’re learning is …” — reported as a synonym, not correct", () => {
    const entry: DictionaryEntry = { ...first("huis", "noun") };
    entry.snapshot = { ...entry.snapshot!, synonyms: ["woning"] };
    const onResult = vi.fn();
    m = mount(<TypedExercise kind="active_recall" entry={entry} synonyms={["woning"]} onResult={onResult} onNext={() => {}} />);
    submit("woning");
    expect(onResult).toHaveBeenCalledWith(entry.id, "synonym");
    expect(m.text()).toContain("Correct, and the word you’re learning is huis.");
  });

  it("the target word itself is simply correct", () => {
    const entry = first("huis", "noun");
    const onResult = vi.fn();
    m = mount(<TypedExercise kind="active_recall" entry={entry} synonyms={["woning"]} onResult={onResult} onNext={() => {}} />);
    submit("huis");
    expect(onResult).toHaveBeenCalledWith(entry.id, "correct");
  });
});

describe("Sentence Completion: two blanks for a split separable verb", () => {
  it("Ik bel je __ … __: both parts typed in order", () => {
    const base = first("opbellen");
    const entry: DictionaryEntry = { ...base, metIn: "Ik bel je morgen op." };
    const completion = completionSentence(entry)!;
    expect(completion.target.parts.map((p) => p.form)).toEqual(["bel", "op"]);
    expect(completion.target.answer).toBe("bel op");
    const onResult = vi.fn();
    m = mount(<TypedExercise kind="sentence_completion" entry={entry} completion={completion} onResult={onResult} onNext={() => {}} />);
    expect(m.container.querySelectorAll(".exercise__gap")).toHaveLength(2);
    submit("bel op");
    expect(onResult).toHaveBeenCalledWith(entry.id, "correct");
  });
});

describe("which exercises a sense's data supports", () => {
  it("Article: a noun with one verified article — never de/het filter", () => {
    expect(hasExerciseData("article", first("zout", "noun"))).toBe(true);
    expect(hasExerciseData("article", first("filter", "noun"))).toBe(false);
    expect(hasExerciseData("article", first("wachten", "verb"))).toBe(false);
  });

  it("Verb form: a verb with its past tense and participle", () => {
    expect(hasExerciseData("verb_form", first("aankomen", "verb"))).toBe(true);
    expect(hasExerciseData("verb_form", first("zout", "noun"))).toBe(false);
  });

  it("Multiple Choice and Active Recall skip a cognate", () => {
    const sauna = { ...first("huis", "noun") };
    sauna.snapshot = { ...sauna.snapshot!, cognate: true };
    expect(hasExerciseData("multiple_choice", sauna)).toBe(false);
    expect(hasExerciseData("active_recall", sauna)).toBe(false);
    expect(hasExerciseData("flashcard", sauna)).toBe(true);
  });

  it("Sentence Completion needs this sense's own example", () => {
    const withExample = entriesOfWord(fixtureWord("bal")).find((e) => e.snapshot!.examples.length)!;
    const without = entriesOfWord(fixtureWord("bal")).find((e) => !e.snapshot!.examples.length)!;
    expect(hasExerciseData("sentence_completion", withExample)).toBe(true);
    expect(hasExerciseData("sentence_completion", without)).toBe(false);
  });
});

describe("Article exercise", () => {
  it("asks de or het, and grades it", () => {
    const entry = first("zout", "noun");
    const onResult = vi.fn();
    m = mount(<ArticleExercise entry={entry} onResult={onResult} onNext={() => {}} />);
    clickEl(button(m.container, "het"));
    clickEl(button(m.container, "Check"));
    expect(onResult).toHaveBeenCalledWith(entry.id, "correct");
  });
});

describe("Verb form exercise", () => {
  it("asks for the past tense, separable parts and all", () => {
    const entry = first("aankomen", "verb");
    const onResult = vi.fn();
    m = mount(<VerbFormExercise entry={entry} random={() => 0} onResult={onResult} onNext={() => {}} />);
    expect(m.text()).toContain("Past tense");
    submit("kwam aan");
    expect(onResult).toHaveBeenCalledWith(entry.id, "correct");
  });
});
