// @vitest-environment jsdom
/* Onboarding's first-words steps, with the real dictionary (the pipeline
   fixture): a new user adds three words one screen at a time, or takes
   three starters. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Onboarding } from "./Onboarding";
import { STARTER_POOLS, pickStarterWords } from "../lib/starterWords";
import { fixtureWord, useFixtureDictionary } from "../lib/dictionary/testDictionary";
import type { DictionaryEntry } from "../lib/types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  useFixtureDictionary();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const text = () => container.textContent ?? "";

async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(1000);
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

async function click(label: string) {
  const el = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(label) || b.getAttribute("aria-label")?.startsWith(label));
  if (!el) throw new Error(`no button "${label}" in: ${text()}`);
  act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await settle();
}

/** Types a word and presses Enter: looked up exactly as typed. */
async function search(value: string) {
  const input = container.querySelector<HTMLInputElement>('input[aria-label^="Search a Dutch word"]')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
  act(() => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await settle();
}

/** Adds the word's first meaning: "+" for one, a checkbox + Save for several. */
async function addFirstMeaning() {
  const plus = container.querySelector<HTMLButtonElement>('.result-card button[aria-label^="Add "]');
  if (plus) {
    act(() => plus.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  } else {
    const box = container.querySelector<HTMLInputElement>('.result-card input[type="checkbox"]')!;
    act(() => box.click());
    await click("Save 1 word");
  }
  await settle();
}

async function renderNewUser(onComplete: (c: unknown, words: DictionaryEntry[]) => void) {
  act(() => root.render(<Onboarding existingUser={false} onComplete={onComplete} />));
  await click("Let’s start");
  await click("Espresso");
  await click("Continue");
  await click("Continue"); // time, pre-filled
  await click("Continue"); // plan
}

describe("onboarding: first words", () => {
  it("adds three typed words one screen at a time, then completes with them", async () => {
    const onComplete = vi.fn();
    await renderNewUser(onComplete);
    await click("Add 3 words I’ve met");
    await click("Continue");

    for (const [i, word] of ["brief", "trein", "fiets"].entries()) {
      expect(text()).toContain(`Word ${i + 1} of 3`);
      await search(word);
      await addFirstMeaning();
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
    const [choice, words] = onComplete.mock.calls[0];
    expect(choice).toMatchObject({ commitment: "espresso" });
    expect(words.map((w: DictionaryEntry) => w.dutch)).toEqual(["brief", "trein", "fiets"]);
    // Every word is a dictionary sense, with its snapshot.
    for (const w of words) expect(w.id).toMatch(/^s_/);
  });

  it("confirms each word and lets Back undo the last one", async () => {
    await renderNewUser(vi.fn());
    await click("Add 3 words I’ve met");
    await click("Continue");
    await search("brief");
    await addFirstMeaning();
    expect(text()).toContain("Word 2 of 3");
    expect(text()).toContain("brief added · 2 to go");
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(text()).toContain("Word 1 of 3");
  });

  it("can fill the remaining words with starters", async () => {
    const onComplete = vi.fn();
    await renderNewUser(onComplete);
    await click("Add 3 words I’ve met");
    await click("Continue");
    await search("fiets");
    await addFirstMeaning();
    await click("Fill the rest with starter words");
    const words: DictionaryEntry[] = onComplete.mock.calls[0][1];
    expect(words).toHaveLength(3);
    expect(words[0].dutch).toBe("fiets");
    expect(new Set(words.map((w) => w.id)).size).toBe(3);
  });

  it("completes with the three starter words shown", async () => {
    const onComplete = vi.fn();
    await renderNewUser(onComplete);
    await click("Give me 3 to start");
    await click("Continue");
    const shown = [...container.querySelectorAll(".starter-list__word")].map((el) => el.textContent);
    await click("Start with these 3");
    const words: DictionaryEntry[] = onComplete.mock.calls[0][1];
    expect(words).toHaveLength(3);
    words.forEach((w, i) => expect(shown[i]?.endsWith(w.dutch)).toBe(true));
  });
});

describe("starter words", () => {
  it("are all dictionary words with a published meaning", () => {
    for (const form of STARTER_POOLS.flat()) {
      const w = fixtureWord(form);
      expect(w.uses[0].senses.length, form).toBeGreaterThan(0);
    }
  });

  it("picks one word from each pool, avoiding ones already shown", () => {
    const first = pickStarterWords(() => 0);
    expect(first).toEqual(STARTER_POOLS.map((p) => p[0]));
    const next = pickStarterWords(() => 0, new Set(first));
    expect(next.some((id) => first.includes(id))).toBe(false);
  });
});
