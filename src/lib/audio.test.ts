// @vitest-environment jsdom
/* Pronunciation: the neural voice first, the device voice when it can't be
   had. The Edge Function, <audio> and speech synthesis are all stand-ins. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  edgeFunction: () => ({ url: "https://project.test/functions/v1/tts", headers: {} }),
}));

const { preloadDutch, speakDutch, stopDutch } = await import("./audio");

const flush = () => new Promise((r) => setTimeout(r, 0));

let played: string[];
let spoken: string[];

beforeEach(() => {
  played = [];
  spoken = [];
  URL.createObjectURL = vi.fn((b: Blob) => `blob:${(b as Blob & { word: string }).word}`);
  vi.stubGlobal(
    "Audio",
    class {
      src = "";
      currentTime = 0;
      pause() {}
      play() {
        played.push(this.src);
        return Promise.resolve();
      }
    }
  );
  vi.stubGlobal("speechSynthesis", {
    speaking: false,
    pending: false,
    getVoices: () => [{ name: "Xander", lang: "nl-NL" }],
    cancel() {},
    resume() {},
    speak: (u: { text: string }) => spoken.push(u.text),
    addEventListener() {},
    removeEventListener() {},
  });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    }
  );
});

afterEach(() => vi.unstubAllGlobals());

function serve(ok: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      const blob = Object.assign(new Blob(), { word: JSON.parse(init.body).text });
      return { ok, blob: async () => blob };
    })
  );
}

describe("speakDutch", () => {
  it("plays the neural voice, fetching each word once", async () => {
    serve(true);
    speakDutch("fiets");
    await flush();
    speakDutch("fiets");
    expect(played).toEqual(["blob:fiets", "blob:fiets"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(spoken).toEqual([]);
  });

  it("plays a preloaded word straight away, inside the tap", async () => {
    serve(true);
    await preloadDutch("huis");
    speakDutch("huis");
    expect(played).toEqual(["blob:huis"]);
  });

  it("falls back to the device voice when the function fails — and retries next time", async () => {
    serve(false);
    speakDutch("trein");
    await flush();
    expect(spoken).toEqual(["trein"]);
    expect(played).toEqual([]);
    serve(true);
    speakDutch("trein");
    await flush();
    expect(played).toEqual(["blob:trein"]);
  });

  it("never plays a word that was replaced before it arrived", async () => {
    serve(true);
    speakDutch("boek");
    speakDutch("werk");
    await flush();
    expect(played).toEqual(["blob:werk"]);
  });

  it("waits for a feedback sound when asked to, then speaks", async () => {
    serve(true);
    vi.useFakeTimers();
    await preloadDutch("doet");
    speakDutch("doet", { delayMs: 380 });
    expect(played).toEqual([]);
    vi.advanceTimersByTime(380);
    expect(played).toEqual(["blob:doet"]);
    vi.useRealTimers();
  });

  it("stopDutch drops a word still on its way", async () => {
    serve(true);
    speakDutch("zon");
    stopDutch();
    await flush();
    expect(played).toEqual([]);
    expect(spoken).toEqual([]);
  });
});
