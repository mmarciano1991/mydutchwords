/* The pieces added for App Store readiness: backups, crash reports, the
   frozen legacy dictionary, the native reminder schedule, the sign-in
   providers and rem type sizes. */
import { beforeEach, describe, expect, it } from "vitest";
import { backupFileName, createBackup, parseBackup, PROGRESS_KEYS, restoreBackup } from "./durableStore";
import { buildReport, MAX_PER_LAUNCH, resetErrorReporting, scrub } from "./errorReporting";
import { legacyEntries, legacyShardOf, parseLegacyKey } from "./legacyDictionary";
import { nativeSchedule } from "./reminders";
import { newHabit, type HabitState } from "./habit";
import { oauthProviders } from "./auth";
import { tokenValue } from "./applyTokens";
import { hasResearchConsent } from "./research";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  },
});

beforeEach(() => store.clear());

describe("backups", () => {
  it("round-trips the progress keys and nothing else", () => {
    store.set("woordkast.deck", JSON.stringify([{ id: "s_abcd" }]));
    store.set("woordkast.habit", JSON.stringify({ commitment: "espresso" }));
    store.set("woordkast.owner", JSON.stringify("user-1"));
    const backup = createBackup(new Date(2026, 9, 17));
    expect(Object.keys(backup.data).sort()).toEqual(["woordkast.deck", "woordkast.habit"]);

    store.clear();
    store.set("woordkast.results", "[]");
    const parsed = parseBackup(JSON.stringify(backup));
    if (typeof parsed === "string") throw new Error(parsed);
    restoreBackup(parsed);
    expect(JSON.parse(store.get("woordkast.deck")!)).toEqual([{ id: "s_abcd" }]);
    // A key the backup didn't have is cleared, so the device matches it.
    expect(store.has("woordkast.results")).toBe(false);
    expect(PROGRESS_KEYS).not.toContain("woordkast.owner");
  });

  it("refuses files that aren't a usable backup", () => {
    expect(parseBackup("not json")).toMatch(/isn’t a Woordkast backup/);
    expect(parseBackup(JSON.stringify({ app: "other", version: 1, data: {} }))).toMatch(/isn’t a Woordkast backup/);
    expect(parseBackup(JSON.stringify({ app: "woordkast", version: 2, data: {} }))).toMatch(/newer version/);
    expect(parseBackup(JSON.stringify({ app: "woordkast", version: 1, data: { "woordkast.deck": {} } }))).toMatch(/damaged/);
  });

  it("names the file by date", () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe("woordkast-backup-2026-01-05.json");
  });
});

describe("error reports", () => {
  beforeEach(() => resetErrorReporting());

  it("masks email addresses and trims", () => {
    expect(scrub("no user anna@example.nl here", 100)).toBe("no user [email] here");
    expect(scrub("x".repeat(20), 5)).toBe("xxxxx");
  });

  it("sends the same error once, and only a few per launch", () => {
    const first = buildReport(new Error("boom"), "error");
    expect(first?.message).toBe("Error: boom");
    expect(first?.platform).toBe("web");
    expect(buildReport(new Error("boom"), "error")).toBeNull();
    for (let i = 1; i < MAX_PER_LAUNCH; i++) expect(buildReport(new Error(`e${i}`), "rejection")).not.toBeNull();
    expect(buildReport(new Error("one too many"), "error")).toBeNull();
  });
});

describe("legacy dictionary", () => {
  const shard = {
    aanslag: {
      dutch: "aanslag",
      senses: [
        { english: "attack", gender: "de", source: "curated", example: "Een aanslag.", exampleEn: "An attack." },
        { english: "tax assessment / bill", gender: "de", source: "authored" },
      ],
    },
  };
  const fetcher = (async (url: string) =>
    String(url).endsWith("legacy/a.json") ? new Response(JSON.stringify(shard)) : new Response("", { status: 404 })) as typeof fetch;

  it("reads ids and their sense index", () => {
    expect(parseLegacyKey("aanslag#1")).toEqual({ baseId: "aanslag", index: 1 });
    expect(parseLegacyKey("a#b")).toEqual({ baseId: "a#b", index: 0 });
    expect(legacyShardOf("één")).toBe("e");
    expect(legacyShardOf("'s-avonds")).toBe("_");
  });

  it("rebuilds each entry from its word's senses", async () => {
    const found = await legacyEntries(["aanslag", "aanslag#1", "aanslag#5", "constructor"], fetcher).catch(() => null);
    // The "c" shard 404s, so the whole call rejects — like being offline.
    expect(found).toBeNull();
    const ok = await legacyEntries(["aanslag", "aanslag#1", "aanslag#5"], fetcher);
    expect(ok.get("aanslag")).toMatchObject({ id: "aanslag", english: "attack", example: "Een aanslag." });
    expect(ok.get("aanslag#1")).toMatchObject({ id: "aanslag#1", english: "tax assessment / bill", example: "", exampleEn: "" });
    expect(ok.has("aanslag#5")).toBe(false);
  });
});

describe("native reminder schedule", () => {
  const at = (day: number, hour: number) => new Date(2026, 9, day, hour);
  const habit = (over: Partial<HabitState> = {}): HabitState => ({
    ...newHabit({ commitment: "espresso", time: "08:00" }, at(5, 7)),
    reminders: true,
    ...over,
  });
  const open = { done: false, eligible: true, hasWords: true };

  it("covers the coming week from the next reminder", () => {
    const dates = nativeSchedule(habit(), at(5, 7), open);
    expect(dates).toHaveLength(7);
    expect(dates[0]).toEqual(at(5, 8));
    expect(dates[6]).toEqual(at(11, 8));
  });

  it("starts tomorrow once today is done, and is empty when off", () => {
    expect(nativeSchedule(habit(), at(5, 7), { ...open, done: true })[0]).toEqual(at(6, 8));
    expect(nativeSchedule(habit({ reminders: false }), at(5, 7), open)).toEqual([]);
  });
});

describe("sign-in and consent", () => {
  it("offers Apple first by default", () => {
    expect(oauthProviders()).toEqual(["apple", "google"]);
  });

  it("reads research consent only when explicitly given", () => {
    expect(hasResearchConsent(null)).toBe(false);
    expect(hasResearchConsent({ user_metadata: {} })).toBe(false);
    expect(hasResearchConsent({ user_metadata: { research_consent: "true" } })).toBe(false);
    expect(hasResearchConsent({ user_metadata: { research_consent: true } })).toBe(true);
  });
});

describe("type sizes", () => {
  it("applies px size tokens as rem, other tokens unchanged", () => {
    expect(tokenValue("size-body", "16px")).toBe("1rem");
    expect(tokenValue("size-label", "12px")).toBe("0.75rem");
    expect(tokenValue("space-4", "16px")).toBe("16px");
  });
});
