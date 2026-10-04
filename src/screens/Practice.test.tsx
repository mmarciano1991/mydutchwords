// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { FLASHCARD_GRADE_LOCK_MS, Practice, type PracticeCard } from "./Practice";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Practice", () => {
  it("offers a way out instead of crashing when there is nothing to ask", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onClose = vi.fn();
    act(() => root.render(<Practice queue={[]} onFinish={() => {}} onClose={onClose} />));

    expect(container.textContent).toContain("no words to practise");
    act(() => container.querySelector<HTMLButtonElement>("button[aria-label='Close practice']")!.click());
    expect(onClose).toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("doesn't let a double-tap grade the next flashcard unseen", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // Well up the ladder, so each word is asked as a flashcard.
    const card = (id: string): PracticeCard => ({
      entry: { id, dutch: id, english: `${id}-en`, gender: "none", example: "", exampleEn: "", senses: [] },
      word: { id, level: 4, interval: 14, reps: 4, lapses: 0, state: "learning", lastReviewedAt: null, dueDate: new Date(0).toISOString() },
    });
    const container = document.createElement("div");
    const root = createRoot(container);
    const onAnswer = vi.fn();
    act(() =>
      root.render(<Practice queue={[card("a"), card("b")]} onAnswer={onAnswer} onFinish={() => {}} onClose={() => {}} />)
    );
    const knewIt = () => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("I knew it"))!;

    act(() => knewIt().click());
    act(() => knewIt().click()); // the second tap of a double-tap
    expect(onAnswer.mock.calls.map(([id]) => id)).toEqual(["a"]);

    act(() => vi.advanceTimersByTime(FLASHCARD_GRADE_LOCK_MS));
    act(() => knewIt().click());
    expect(onAnswer.mock.calls.map(([id]) => id)).toEqual(["a", "b"]);
    act(() => root.unmount());
    vi.useRealTimers();
  });
});
