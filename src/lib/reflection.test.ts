import { describe, expect, it } from "vitest";
import { buildReflection, hasSomethingToShow } from "./reflection";
import type { PracticeResult } from "./types";

const NOW = new Date(2026, 9, 31, 12);
const daysAgo = (n: number) => NOW.getTime() - n * 86_400_000;
const r = (entryId: string, ago: number, grade: "know" | "dontKnow" = "know"): PracticeResult => ({
  entryId,
  grade,
  timestamp: daysAgo(ago),
});
const name = (id: string) => id.replace(/#\d+$/, "");

describe("then vs now", () => {
  it("names the words known now that weren't known 30 days ago, in the order met", () => {
    const results = [r("huis", 40), r("aanslag#1", 20, "dontKnow"), r("aanslag#1", 10), r("bezwaar", 5), r("termijn", 3, "dontKnow")];
    const ref = buildReflection(results, NOW, name);
    expect(ref.learned).toEqual(["aanslag", "bezwaar"]);
    // termijn is still being learned — not claimed.
    expect(ref.learned).not.toContain("termijn");
  });

  it("counts older words that are still holding", () => {
    const results = [r("huis", 40), r("deur", 40), r("deur", 2, "dontKnow")];
    expect(buildReflection(results, NOW, name).retained).toBe(1);
  });

  it("measures a real letter then against now", () => {
    const admin = ["aanslag#1", "bedrag", "termijn", "betalen", "datum", "bezwaar", "formulier", "brief", "belasting"];
    const results = admin.map((id) => r(id, 10));
    const ref = buildReflection(results, NOW, name);
    expect(ref.text).not.toBeNull();
    expect(ref.text!.name).toBe("a belastingbrief");
    expect(ref.text!.then).toBe(0);
    expect(ref.text!.now).toBeGreaterThan(20);
    // The passage marks the words now known, inflected forms included.
    const known = ref.text!.tokens.filter((t) => t.knownNow).map((t) => t.text.toLowerCase());
    expect(known).toContain("aanslag");
    expect(known).toContain("bedrag");
  });

  it("has nothing to show for a quiet month", () => {
    const ref = buildReflection([r("huis", 40)], NOW, name);
    expect(hasSomethingToShow(ref)).toBe(false);
  });
});
