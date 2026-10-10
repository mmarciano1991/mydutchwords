// @vitest-environment jsdom
/* Onboarding's first-words steps, with the real dictionary lookup: a new
   user adds three words one screen at a time, or takes three starters. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Onboarding } from "./Onboarding";
import { findEntry, RICH_COUNT, indexOfEntry } from "../data/dictionary";
import { STARTER_POOLS, pickStarterWords } from "../lib/starterWords";
import type { DictionaryEntry } from "../lib/types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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

function click(label: string) {
  const el = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(label));
  if (!el) throw new Error(`no button "${label}" in: ${text()}`);
  act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

async function search(value: string) {
  const input = container.querySelector<HTMLInputElement>('input[aria-label^="Search a Dutch word"]')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
  });
}

function renderNewUser(onComplete: (c: unknown, words: DictionaryEntry[]) => void) {
  act(() => root.render(<Onboarding existingUser={false} onComplete={onComplete} />));
  click("Let’s start");
  click("Espresso");
  click("Continue");
  click("Continue"); // time, pre-filled
  click("Continue"); // plan
}

describe("onboarding: first words", () => {
  it("adds three typed words one screen at a time, then completes with them", async () => {
    const onComplete = vi.fn();
    renderNewUser(onComplete);
    click("Add 3 words I’ve met");
    click("Continue");

    for (const [i, word] of ["brief", "trein", "fiets"].entries()) {
      expect(text()).toContain(`Word ${i + 1} of 3`);
      await search(word);
      click("Add to deck");
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
    const [choice, words] = onComplete.mock.calls[0];
    expect(choice).toMatchObject({ commitment: "espresso" });
    expect(words.map((w: DictionaryEntry) => w.dutch)).toEqual(["brief", "trein", "fiets"]);
  });

  it("confirms each word and lets Back undo the last one", async () => {
    renderNewUser(vi.fn());
    click("Add 3 words I’ve met");
    click("Continue");
    await search("brief");
    click("Add to deck");
    expect(text()).toContain("Word 2 of 3");
    expect(text()).toContain("brief added · 2 to go");
    act(() =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Back"]')!.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      )
    );
    expect(text()).toContain("Word 1 of 3");
  });

  it("can fill the remaining words with starters", async () => {
    const onComplete = vi.fn();
    renderNewUser(onComplete);
    click("Add 3 words I’ve met");
    click("Continue");
    await search("fiets");
    click("Add to deck");
    click("Fill the rest with starter words");
    const words: DictionaryEntry[] = onComplete.mock.calls[0][1];
    expect(words).toHaveLength(3);
    expect(words[0].dutch).toBe("fiets");
    expect(new Set(words.map((w) => w.id)).size).toBe(3);
  });

  it("completes with the three starter words shown", () => {
    const onComplete = vi.fn();
    renderNewUser(onComplete);
    click("Give me 3 to start");
    click("Continue");
    const shown = [...container.querySelectorAll(".starter-list__word")].map((el) => el.textContent);
    click("Start with these 3");
    const words: DictionaryEntry[] = onComplete.mock.calls[0][1];
    // Each row reads "<article> <word>"; the words match, in order.
    expect(words).toHaveLength(3);
    words.forEach((w, i) => expect(shown[i]?.endsWith(w.dutch)).toBe(true));
  });
});

describe("starter words", () => {
  it("are all curated dictionary words, with an example sentence", () => {
    for (const id of STARTER_POOLS.flat()) {
      expect(findEntry(id), id).toBeDefined();
      expect(indexOfEntry(id)! < RICH_COUNT, id).toBe(true);
    }
  });

  it("picks one word from each pool, avoiding ones already shown", () => {
    const first = pickStarterWords(() => 0);
    expect(first).toEqual(STARTER_POOLS.map((p) => p[0]));
    const next = pickStarterWords(() => 0, new Set(first));
    expect(next.some((id) => first.includes(id))).toBe(false);
  });
});
