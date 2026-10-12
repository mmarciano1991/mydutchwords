// @vitest-environment jsdom
/* The deck (spec §8): dictionary cards with a ⋮ menu — Edit and Delete one
   sense, keyboard-navigable, closing on Esc and outside taps. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { Browse } from "./Browse";
import { masteryOf } from "../components/MasteryStatus";
import { fixtureWord } from "../lib/dictionary/testDictionary";
import { entriesOfWord } from "../lib/dictionary/snapshot";
import { newDeckItem } from "../lib/storage";
import type { DictionaryEntry } from "../lib/types";
import { button, clickEl, key, mount, typeInto, type Mounted } from "../test/dom";

let m: Mounted | null = null;
afterEach(() => m?.unmount());

const bal = entriesOfWord(fixtureWord("bal"));

function render(entries: DictionaryEntry[], handlers: Partial<Parameters<typeof Browse>[0]> = {}) {
  const words = new Map(entries.map((e) => [e.id, newDeckItem(e.id, new Date())]));
  const props = {
    entries,
    words,
    tricky: new Set<string>(),
    onRemove: vi.fn((id: string) => words.get(id)),
    onRestore: vi.fn(),
    onEdit: vi.fn(),
    onSave: vi.fn(),
    onSavePersonal: vi.fn(),
    ...handlers,
  };
  m = mount(<Browse {...props} />);
  return props;
}

const menuButton = (i = 0) => m!.container.querySelectorAll<HTMLButtonElement>(".more-menu__button")[i];

describe("dictionary_card", () => {
  it("shows article, word, gloss, part of speech and mastery — and the ⋮ is not inside the card's button", () => {
    render(bal.slice(0, 1));
    const card = m!.container.querySelector(".dict-card")!;
    expect(card.querySelector(".dict-card__word")?.textContent).toBe("de bal");
    expect(card.querySelector(".pos-pill")?.textContent).toBe("Noun");
    expect(card.querySelector(".mastery-status")?.textContent).toBe("New");
    expect(card.querySelector(".dict-card__main .more-menu__button")).toBeNull();
    expect(menuButton().getAttribute("aria-label")).toBe("More actions for de bal");
  });

  it("the word and its arrow are one toggle: open, then closed again", () => {
    render(bal.slice(0, 1));
    const card = m!.container.querySelector(".dict-card")!;
    const toggle = card.querySelector<HTMLButtonElement>(".dict-card__main")!;
    expect(toggle.querySelector(".dict-card__word")).not.toBeNull();
    expect(toggle.querySelector(".dict-card__arrow")).not.toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    clickEl(toggle.querySelector(".dict-card__arrow"));
    expect(card.classList.contains("is-open")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(card.querySelector(`#${toggle.getAttribute("aria-controls")}`)).not.toBeNull();
    clickEl(toggle.querySelector(".dict-card__word"));
    expect(card.classList.contains("is-open")).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("learning status", () => {
  it("reads the learning engine's state: New, Learning, Mastering, Mastered", () => {
    expect(masteryOf({ state: "new", evidenceTier: 0 })).toBe("New");
    expect(masteryOf({ state: "learning", evidenceTier: 1 })).toBe("Learning");
    expect(masteryOf({ state: "learning", evidenceTier: 2 })).toBe("Mastering");
    expect(masteryOf({ state: "learned", evidenceTier: 3 })).toBe("Mastered");
  });
});

describe("the ⋮ menu", () => {
  it("opens next to the card, focuses its first action, and closes on Esc back to the button", () => {
    render(bal.slice(0, 1));
    clickEl(menuButton());
    const items = [...m!.container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    expect(items.map((i) => i.textContent)).toEqual(["Edit", "Delete"]);
    expect(document.activeElement).toBe(items[0]);
    key(items[0], "ArrowDown");
    expect(document.activeElement).toBe(items[1]);
    key(items[1], "Escape");
    expect(m!.container.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(menuButton());
  });

  it("closes on a tap outside, and opening it never opens the card", () => {
    render(bal.slice(0, 1));
    clickEl(menuButton());
    expect(m!.container.querySelector(".dict-card")!.classList.contains("is-open")).toBe(false);
    act(() => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    expect(m!.container.querySelector('[role="menu"]')).toBeNull();
  });

  it("Delete removes that sense only, with Undo", () => {
    const props = render(bal);
    clickEl(menuButton(1));
    clickEl(button(m!.container, "Delete"));
    expect(props.onRemove).toHaveBeenCalledTimes(1);
    expect(props.onRemove).toHaveBeenCalledWith(bal[1].id);
    expect(m!.text()).toContain("bal removed from your deck");
    clickEl(button(m!.container, "Undo"));
    expect(props.onRestore).toHaveBeenCalledTimes(1);
  });

  it("Edit opens the edit form and saves to the same sense id", () => {
    const props = render(bal.slice(0, 1));
    clickEl(menuButton());
    clickEl(button(m!.container, "Edit"));
    const translation = m!.container.querySelector<HTMLInputElement>(".wordrow__edit input")!;
    expect(translation.value).toBe(bal[0].english);
    typeInto(translation, "football");
    clickEl(button(m!.container, "Save"));
    expect(props.onEdit).toHaveBeenCalledWith(bal[0].id, expect.objectContaining({ english: "football" }));
  });
});

describe("a deck card with no example", () => {
  it("says the example is coming, rather than borrowing another sense's", () => {
    const noExample = bal.find((e) => !e.snapshot!.examples.length)!;
    render([noExample]);
    clickEl(m!.container.querySelector(".dict-card__main"));
    expect(m!.text()).toContain("Example coming soon");
  });
});
