// @vitest-environment jsdom
/* The Add-a-word combobox (spec §6): keyboard, Esc, stale responses, the
   empty field, offline. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { WordSearch, type SearchPick } from "./WordSearch";
import { setDictionarySource } from "../lib/dictionary/service";
import { fixtureSource } from "../lib/dictionary/testDictionary";
import type { DictionarySource } from "../lib/dictionary/source";
import { flush, key, mount, typeInto, type Mounted } from "../test/dom";
import { act } from "react";

let m: Mounted | null = null;
let picks: SearchPick[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  picks = [];
  try {
    localStorage.clear();
  } catch {
    /* no storage in this environment */
  }
});
afterEach(() => {
  m?.unmount();
  vi.useRealTimers();
});

function Harness() {
  const [value, setValue] = useState("");
  return <WordSearch value={value} onChange={setValue} onPick={(p) => picks.push(p)} inDeckWordIds={new Set(["lopen"])} />;
}

const input = () => m!.container.querySelector<HTMLInputElement>('input[role="combobox"]')!;
const options = () => [...m!.container.querySelectorAll('[role="option"]')];

async function typeAndWait(value: string) {
  typeInto(input(), value);
  await act(async () => {
    vi.advanceTimersByTime(250);
  });
  await flush();
}

describe("autocomplete", () => {
  beforeEach(() => setDictionarySource(fixtureSource()));

  it("is a combobox wired to its listbox, with autocorrect and spellcheck off", () => {
    m = mount(<Harness />);
    const el = input();
    expect(el.getAttribute("aria-autocomplete")).toBe("list");
    expect(el.getAttribute("aria-controls")).toBe(m.container.querySelector('[role="listbox"]')!.id);
    expect(el.getAttribute("autocorrect")).toBe("off");
    expect(el.getAttribute("autocapitalize")).toBe("off");
    expect(el.getAttribute("spellcheck")).toBe("false");
    expect(el.getAttribute("lang")).toBe("nl");
  });

  it("waits for two letters", async () => {
    m = mount(<Harness />);
    await typeAndWait("b");
    expect(options()).toHaveLength(0);
  });

  it("liep → lopen first, with the typed form shown and “In your deck”", async () => {
    m = mount(<Harness />);
    await typeAndWait("liep");
    const first = options()[0];
    expect(first.textContent).toContain("lopen");
    expect(first.textContent).toContain("liep");
    expect(first.textContent).toContain("In your deck");
  });

  it("highlights the typed prefix in bold and underline, not colour alone", async () => {
    m = mount(<Harness />);
    await typeAndWait("belastin");
    const mark = options()[0].querySelector(".suggest__match");
    expect(mark?.textContent).toBe("belastin");
  });

  it("↑ ↓ move the active option, Enter picks it, focus stays in the input", async () => {
    m = mount(<Harness />);
    await typeAndWait("belasting");
    key(input(), "ArrowDown");
    const active = input().getAttribute("aria-activedescendant")!;
    expect(m.container.querySelector(`#${CSS.escape(active)}`)?.getAttribute("aria-selected")).toBe("true");
    key(input(), "ArrowDown");
    key(input(), "ArrowUp");
    expect(input().getAttribute("aria-activedescendant")).toBe(active);
    key(input(), "Enter");
    expect(picks[0].form).toBe("belasting");
  });

  it("Esc closes the list without clearing the text", async () => {
    m = mount(<Harness />);
    await typeAndWait("huur");
    expect(input().getAttribute("aria-expanded")).toBe("true");
    key(input(), "Escape");
    expect(input().getAttribute("aria-expanded")).toBe("false");
    expect(input().value).toBe("huur");
  });

  it("Enter with nothing highlighted looks up what was typed", async () => {
    m = mount(<Harness />);
    await typeAndWait("huurtoeslagaanvraag");
    key(input(), "Escape");
    key(input(), "Enter");
    expect(picks[0].form).toBe("huurtoeslagaanvraag");
  });

  it("offers “Did you mean…?” only when nothing matches", async () => {
    m = mount(<Harness />);
    await typeAndWait("klijn");
    expect(m.text()).toContain("Did you mean…?");
    expect(options().some((o) => o.textContent?.includes("klein"))).toBe(true);
  });

  it("announces the result count", async () => {
    m = mount(<Harness />);
    await typeAndWait("belasting");
    expect(m.container.querySelector('[role="status"]')?.textContent).toMatch(/\d+ suggestions/);
  });
});

describe("request lifecycle", () => {
  it("a slow, older response never replaces a newer one", async () => {
    const real = fixtureSource();
    const resolvers: (() => void)[] = [];
    const slow: DictionarySource = {
      ...real,
      suggest: (k, limit, signal) =>
        new Promise((resolve) => {
          // "hu" answers late; "huur" answers at once.
          const run = () => real.suggest(k, limit, signal).then(resolve);
          if (k === "hu") resolvers.push(run);
          else void run();
        }),
    };
    setDictionarySource(slow);
    m = mount(<Harness />);
    await typeAndWait("hu");
    await typeAndWait("huur");
    const shown = options().map((o) => o.textContent);
    resolvers.forEach((r) => r());
    await flush();
    expect(options().map((o) => o.textContent)).toEqual(shown);
    expect(shown[0]).toContain("huur");
  });

  it("an error keeps the field usable and offers Try again", async () => {
    const failing: DictionarySource = { ...fixtureSource(), suggest: () => Promise.reject(new Error("down")) };
    setDictionarySource(failing);
    m = mount(<Harness />);
    await typeAndWait("huur");
    expect(m.text()).toContain("Try again");
    setDictionarySource(fixtureSource());
    act(() => [...m!.container.querySelectorAll("button")].find((b) => b.textContent === "Try again")!.click());
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await flush();
    expect(options().length).toBeGreaterThan(0);
  });

  it("offline, searches the saved words and says so", async () => {
    setDictionarySource(fixtureSource());
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const saved = [{ id: "s_x", dutch: "huis", english: "house", gender: "het" as const, example: "", exampleEn: "", senses: [] }];
    function Offline() {
      const [value, setValue] = useState("");
      return <WordSearch value={value} onChange={setValue} onPick={() => {}} inDeckWordIds={new Set()} saved={saved} />;
    }
    m = mount(<Offline />);
    await typeAndWait("hui");
    expect(m.text()).toContain("You’re offline. Searching your saved words.");
    expect(options()[0].textContent).toContain("huis");
    online.mockRestore();
  });
});
