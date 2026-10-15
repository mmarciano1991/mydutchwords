/* Asking the "example" function: an example, nothing to give, or not reached. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestExample } from "./exampleService";

vi.mock("./supabase", () => ({
  edgeFunction: () => ({ url: "https://project.test/functions/v1/example", headers: {} }),
}));

const respond = (status: number, body: unknown) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.restoreAllMocks());

describe("requestExample", () => {
  it("returns the example, marked as generated", async () => {
    const fetch = respond(200, { nl: "De termijn is voorbij.", en: "The term is over.", targetSpans: [[3, 10]], source: "corpus" });
    expect(await requestExample("s_abcdef")).toEqual({
      kind: "example",
      example: { nl: "De termijn is voorbij.", en: "The term is over.", targetSpans: [[3, 10]], source: "generated" },
    });
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({ senseId: "s_abcdef" });
  });

  it("says none when the server has none to give", async () => {
    respond(422, { error: "No example passed the checks" });
    expect(await requestExample("s_abcdef")).toEqual({ kind: "none" });
    respond(200, { nl: "", en: "" });
    expect(await requestExample("s_abcdef")).toEqual({ kind: "none" });
  });

  it("says offline when it couldn't get through, or the server failed", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await requestExample("s_abcdef")).toEqual({ kind: "offline" });
    respond(502, { error: "Example writing failed (529)" });
    expect(await requestExample("s_abcdef")).toEqual({ kind: "offline" });
    respond(503, { error: "Example writing is not configured" });
    expect(await requestExample("s_abcdef")).toEqual({ kind: "offline" });
    respond(404, { code: "NOT_FOUND", message: "Requested function was not found" });
    expect(await requestExample("s_abcdef")).toEqual({ kind: "offline" });
  });
});
