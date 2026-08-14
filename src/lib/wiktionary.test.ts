// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupWiktionary } from "./wiktionary";
import {
  HUIS_DEFINITION_JSON,
  HUIS_HTML,
  KAT_DEFINITION_JSON,
  KAT_HTML,
  WANDELEN_DEFINITION_JSON,
} from "./wiktionary.fixtures";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function htmlResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/html" } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("lookupWiktionary", () => {
  it("attaches the article and example sentence for a noun that has both", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(HUIS_DEFINITION_JSON))
      .mockResolvedValueOnce(htmlResponse(HUIS_HTML));
    vi.stubGlobal("fetch", fetchMock);

    const entry = await lookupWiktionary("huis");

    expect(entry).not.toBeNull();
    expect(entry!.gender).toBe("het");
    expect(entry!.example).toBe("Ik woon in een klein huis aan de rand van de stad.");
    expect(entry!.exampleEn).toBe("I live in a small house on the outskirts of the city.");
    expect(entry!.senses).toHaveLength(3);
    // The Verb sense never had a gender to find, and the French homograph's
    // "feminine" earlier on the same page must not have leaked in either.
    expect(entry!.senses![2].label).toBe("verb");
    expect(entry!.senses![2].gender).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("/page/definition/huis");
    expect(fetchMock.mock.calls[1][0]).toContain("/page/html/huis");
  });

  it("still finds the article when the word has no authored example", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(KAT_DEFINITION_JSON))
      .mockResolvedValueOnce(htmlResponse(KAT_HTML));
    vi.stubGlobal("fetch", fetchMock);

    const entry = await lookupWiktionary("kat");

    expect(entry!.gender).toBe("de");
    expect(entry!.example).toBe("");
    expect(entry!.exampleEn).toBe("");
  });

  it("skips the article request entirely when there is no noun sense", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(WANDELEN_DEFINITION_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const entry = await lookupWiktionary("wandelen");

    expect(entry!.gender).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still resolves the lookup when the article request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(HUIS_DEFINITION_JSON))
      .mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const entry = await lookupWiktionary("huis");

    expect(entry).not.toBeNull();
    expect(entry!.gender).toBeNull();
    // The example still came through — it rides on the definition response,
    // not the failed one.
    expect(entry!.example).not.toBe("");
  });

  it("still returns null on a genuine 404, unaffected by the enrichment step", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({}, 404));
    vi.stubGlobal("fetch", fetchMock);

    const entry = await lookupWiktionary("zzznotaword");

    expect(entry).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recovers from a dropped connection with one silent retry", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(WANDELEN_DEFINITION_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const entry = await lookupWiktionary("wandelen");

    expect(entry).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1 + 1); // definition retried once, no noun sense to enrich
  });

  it("recovers from a transient 503 with one silent retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse(WANDELEN_DEFINITION_JSON));
    vi.stubGlobal("fetch", fetchMock);

    const entry = await lookupWiktionary("wandelen");

    expect(entry).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("still fails after the retry is also unsuccessful", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(lookupWiktionary("wandelen")).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
