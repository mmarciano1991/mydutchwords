// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { AppState, PushResult, SyncBase } from "./cloudState";
import type { DeckItem, PracticeResult } from "./types";

vi.mock("./supabase", () => ({ supabase: {} }));

vi.mock("./wordSources", () => ({
  getCustomEntries: () => [],
  setCustomEntries: () => {},
  useCustomEntriesVersion: () => 0,
}));

const fetchRemoteState = vi.fn();
const pushState = vi.fn<(userId: string, state: AppState, base: SyncBase) => Promise<PushResult>>();
vi.mock("./cloudState", async (original) => ({
  ...(await original<typeof import("./cloudState")>()),
  fetchRemoteState: (...args: unknown[]) => fetchRemoteState(...args),
  pushState: (...args: Parameters<typeof pushState>) => pushState(...args),
}));

// The review log uploads on its own schedule; not what these tests are about.
vi.mock("./reviewEvents", () => ({ flushReviewEvents: () => Promise.resolve() }));

const { useCloudSync } = await import("./useCloudSync");
const { newDeckItem } = await import("./storage");

// jsdom under vitest ships no localStorage; the hook records whose data the
// device holds there.
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

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const word = (id: string): DeckItem => ({ ...newDeckItem(id, new Date(0)), dateAdded: 1 });
const answer = (entryId: string, timestamp: number): PracticeResult => ({ entryId, timestamp, grade: "know" });
const snapshot = (over: Partial<AppState> = {}): AppState => ({
  deck: [],
  results: [],
  customWords: [],
  run: null,
  habit: null,
  ...over,
});

let container: HTMLDivElement;
let root: Root;
let flush: () => Promise<boolean>;
const applied: AppState[] = [];

function Harness({ local }: { local: AppState }) {
  const sync = useCloudSync({
    userId: "user-1",
    ...local,
    habit: local.habit ?? null,
    applyMerged: (s) => applied.push(s),
  });
  flush = sync.flush;
  return null;
}

async function mount(local: AppState) {
  container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(<Harness local={local} />));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  fetchRemoteState.mockReset();
  pushState.mockReset();
  applied.length = 0;
  store.clear();
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe("useCloudSync", () => {
  it("merges the remote snapshot on login and pushes against its version", async () => {
    fetchRemoteState.mockResolvedValue({ ok: true, state: snapshot({ deck: [word("kat")] }), version: 5 });
    pushState.mockResolvedValue({ status: "ok", version: 6 });

    await mount(snapshot({ deck: [word("huis")] }));

    expect(applied[0].deck.map((d) => d.id).sort()).toEqual(["huis", "kat"]);
    const [, sent, base] = pushState.mock.calls[0];
    expect(base.version).toBe(5);
    expect(sent.deck.map((d) => d.id).sort()).toEqual(["huis", "kat"]);
  });

  it("on a conflict, merges the newer row in and retries against its version", async () => {
    fetchRemoteState.mockResolvedValue({ ok: true, state: null, version: 0 });
    pushState
      .mockResolvedValueOnce({
        status: "conflict",
        remote: snapshot({ results: [answer("kat", 2)] }),
        version: 9,
      })
      .mockResolvedValueOnce({ status: "ok", version: 10 });

    await mount(snapshot({ results: [answer("huis", 1)] }));

    expect(pushState).toHaveBeenCalledTimes(2);
    const [, retried, base] = pushState.mock.calls[1];
    expect(base.version).toBe(9);
    // The other device's answer is already on the server; only ours is new.
    expect(base.serverResults.has("kat|2|know")).toBe(true);
    expect(retried.results.map((r) => r.entryId)).toEqual(["huis", "kat"]);
    expect(applied[applied.length - 1].results.map((r) => r.entryId)).toEqual(["huis", "kat"]);
  });

  it("reports a failed save, so sign-out can refuse to wipe the device", async () => {
    fetchRemoteState.mockResolvedValue({ ok: true, state: null, version: 0 });
    pushState.mockResolvedValue({ status: "error" });

    await mount(snapshot());

    let saved: boolean | undefined;
    await act(async () => {
      saved = await flush();
    });
    expect(saved).toBe(false);
  });

  it("can't report saved before the first pull has landed", async () => {
    fetchRemoteState.mockReturnValue(new Promise(() => {}));

    await mount(snapshot({ deck: [word("huis")] }));

    let saved: boolean | undefined;
    await act(async () => {
      saved = await flush();
    });
    expect(saved).toBe(false);
    expect(pushState).not.toHaveBeenCalled();
  });

  it("doesn't merge another account's leftover data into this one", async () => {
    // Another user's session expired on this device, leaving their deck.
    store.set("woordkast.owner", JSON.stringify("someone-else"));
    fetchRemoteState.mockResolvedValue({ ok: true, state: snapshot({ deck: [word("kat")] }), version: 1 });
    pushState.mockResolvedValue({ status: "ok", version: 2 });

    await mount(snapshot({ deck: [word("huis")] }));

    expect(applied[0].deck.map((d) => d.id)).toEqual(["kat"]);
    expect(pushState.mock.calls[0][1].deck.map((d) => d.id)).toEqual(["kat"]);
    expect(JSON.parse(store.get("woordkast.owner")!)).toBe("user-1");
  });

  it("still merges the same account's local progress", async () => {
    store.set("woordkast.owner", JSON.stringify("user-1"));
    fetchRemoteState.mockResolvedValue({ ok: true, state: snapshot({ deck: [word("kat")] }), version: 1 });
    pushState.mockResolvedValue({ status: "ok", version: 2 });

    await mount(snapshot({ deck: [word("huis")] }));

    expect(applied[0].deck.map((d) => d.id).sort()).toEqual(["huis", "kat"]);
  });
});
