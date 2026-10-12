// @vitest-environment jsdom
/* The four search states (spec §7), with real senses from the fixture:
     A  one sense — "+" adds it in one tap
     B  several — checkboxes; "Save N words", disabled with none selected
     C  everything in the deck — green "In your deck", no action
     D  mixed — green for the saved ones, a control for the rest */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { SenseResults, saveLabel, senseItems, type SenseItem } from "./SenseResults";
import type { LookupResult } from "../lib/dictionary/service";
import { fixtureWord } from "../lib/dictionary/testDictionary";
import type { DictionaryEntry } from "../lib/types";
import { button, clickEl, mount, type Mounted } from "../test/dom";

let m: Mounted | null = null;
afterEach(() => m?.unmount());

function resultFor(form: string): LookupResult {
  return { query: form, matches: [{ word: fixtureWord(form), useIds: null, via: "lemma", matched: form }], compound: null, didYouMean: [] };
}

function render(result: LookupResult, inDeck: Set<string>, onSave = vi.fn()) {
  m = mount(<SenseResults result={result} isInDeck={(i: SenseItem) => inDeck.has(i.snapshot.senseId)} onSave={onSave} />);
  return onSave;
}

const cards = () => [...m!.container.querySelectorAll(".result-card")];

describe("result_card states", () => {
  it("A — one sense: a single “+” adds it in one tap", () => {
    const result = resultFor("zeehond");
    expect(senseItems(result)).toHaveLength(1);
    const onSave = render(result, new Set());
    expect(m!.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    clickEl(m!.container.querySelector('.result-card button[aria-label^="Add "]'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].map((e: DictionaryEntry) => e.dutch)).toEqual(["zeehond"]);
    // Locked after the first tap: no double submission.
    clickEl(m!.container.querySelector('.result-card button[aria-label^="Add "]'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("B — several senses: checkboxes, and Save counts the selection", () => {
    const result = resultFor("bal");
    const items = senseItems(result);
    expect(items.length).toBeGreaterThan(1);
    const onSave = render(result, new Set());
    expect(cards()).toHaveLength(items.length);
    const save = button(m!.container, "Save the words");
    expect(save.disabled).toBe(true);
    const boxes = [...m!.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    act(() => boxes[0].click());
    expect(button(m!.container, "Save 1 word").disabled).toBe(false);
    act(() => boxes[items.length - 1].click());
    clickEl(button(m!.container, "Save 2 words"));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved: DictionaryEntry[] = onSave.mock.calls[0][0];
    expect(saved.map((e) => e.id)).toEqual([items[0].snapshot.senseId, items[items.length - 1].snapshot.senseId]);
    // het bal keeps its own article.
    expect(saved[1].gender).toBe("het");
  });

  it("C — every sense in the deck: green cards, “In your deck”, no action", () => {
    const result = resultFor("bal");
    render(result, new Set(senseItems(result).map((i) => i.snapshot.senseId)));
    expect(cards().every((c) => c.classList.contains("result-card--indeck"))).toBe(true);
    expect(m!.text()).toContain("In your deck");
    // No add control or checkbox anywhere (an explanatory pill is not one).
    expect(m!.container.querySelectorAll('input, .result-card__control:not(.result-card__done)')).toHaveLength(0);
    // Article and word written together: "de bal".
    expect(cards()[0].querySelector(".result-card__word")?.textContent).toBe("de bal");
  });

  it("D — mixed, one sense free: green for the saved ones and “+” for the other", () => {
    const result = resultFor("bal");
    const items = senseItems(result);
    const onSave = render(result, new Set(items.slice(1).map((i) => i.snapshot.senseId)));
    expect(m!.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    clickEl(m!.container.querySelector('.result-card button[aria-label^="Add "]'));
    expect(onSave.mock.calls[0][0][0].id).toBe(items[0].snapshot.senseId);
  });

  it("D — mixed, two or more free: checkboxes only on the free ones", () => {
    const result = resultFor("bal");
    const items = senseItems(result);
    render(result, new Set([items[0].snapshot.senseId]));
    expect(m!.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(items.length - 1);
    expect(cards()[0].classList.contains("result-card--indeck")).toBe(true);
  });

  it("the same sense reached twice is listed once", () => {
    const w = fixtureWord("bal");
    const twice: LookupResult = { query: "bal", matches: [{ word: w, useIds: null, via: "lemma", matched: "bal" }, { word: w, useIds: null, via: "variant", matched: "bal" }], compound: null, didYouMean: [] };
    expect(senseItems(twice)).toHaveLength(senseItems(resultFor("bal")).length);
  });

  it("names the confirm action by count", () => {
    expect([saveLabel(0), saveLabel(1), saveLabel(2)]).toEqual(["Save the words", "Save 1 word", "Save 2 words"]);
  });

  it("shows the part of speech and marks Dutch text as Dutch", () => {
    render(resultFor("zeehond"), new Set());
    expect(m!.container.querySelector(".pos-pill")?.textContent).toBe("Noun");
    expect(m!.container.querySelector(".result-card__word")?.getAttribute("lang")).toBe("nl");
    expect(m!.container.querySelector(".result-card__gloss")?.getAttribute("lang")).toBe("en");
  });

  it("a conjugated verb shows the infinitive, with the grammar explanation", () => {
    const liep: LookupResult = { query: "liep", matches: [{ word: fixtureWord("lopen"), useIds: ["verb"], via: "form", matched: "liep" }], compound: null, didYouMean: [] };
    render(liep, new Set());
    const words = [...m!.container.querySelectorAll(".result-card__word")].map((w) => w.textContent);
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((w) => w === "lopen")).toBe(true);
    expect(m!.container.querySelector(".result-card__grammar")?.textContent).toBe("Past tense of lopen.");
    expect(m!.container.querySelector(".pos-pill")?.textContent).toBe("Verb");
  });

  it("no grammar explanation, and no empty slot, when there is nothing to explain", () => {
    render(resultFor("zeehond"), new Set());
    expect(m!.container.querySelector(".result-card__grammar")).toBeNull();
  });
});
