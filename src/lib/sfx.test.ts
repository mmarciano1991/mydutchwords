// @vitest-environment jsdom
/* The feedback sounds: played through a stand-in AudioContext that counts
   the notes it's asked for. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let oscillators = 0;
let contexts = 0;

function param() {
  return { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} };
}
function node() {
  return { connect: (n: unknown) => n };
}

class FakeContext {
  state = "running";
  currentTime = 0;
  destination = node();
  constructor() {
    contexts++;
  }
  resume() {
    return Promise.resolve();
  }
  createGain() {
    return { ...node(), gain: param() };
  }
  createBiquadFilter() {
    return { ...node(), type: "", frequency: param(), Q: param() };
  }
  createDynamicsCompressor() {
    return { ...node(), threshold: param(), ratio: param() };
  }
  createOscillator() {
    oscillators++;
    return { ...node(), type: "", frequency: param(), detune: param(), start() {}, stop() {} };
  }
}

async function load(withAudio = true) {
  vi.resetModules();
  if (withAudio) vi.stubGlobal("AudioContext", FakeContext);
  return import("./sfx");
}

// This jsdom has no localStorage; one that survives "reloads" (fresh imports).
const stored = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => stored.get(k) ?? null,
  setItem: (k: string, v: string) => void stored.set(k, v),
  removeItem: (k: string) => void stored.delete(k),
};

beforeEach(() => {
  oscillators = 0;
  contexts = 0;
  stored.clear();
  vi.stubGlobal("localStorage", fakeStorage);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("playSound", () => {
  it("plays each sound as a handful of synth notes, through one shared context", async () => {
    const { playSound } = await load();
    playSound("correct");
    const correct = oscillators;
    expect(correct).toBeGreaterThan(0);
    vi.advanceTimersByTime(1000);
    playSound("wrong");
    playSound("complete");
    expect(oscillators).toBeGreaterThan(correct);
    expect(contexts).toBe(1);
  });

  it("plays the same sound once when one event asks twice", async () => {
    const { playSound } = await load();
    playSound("correct");
    const once = oscillators;
    playSound("correct");
    expect(oscillators).toBe(once);
    vi.advanceTimersByTime(200);
    playSound("correct");
    expect(oscillators).toBe(once * 2);
  });

  it("is silent when muted — and the choice survives a reload", async () => {
    let sfx = await load();
    sfx.setSoundEffectsMuted(true);
    sfx.playSound("correct");
    expect(oscillators).toBe(0);
    sfx = await load();
    expect(sfx.soundEffectsMuted()).toBe(true);
    sfx.setSoundEffectsMuted(false);
    sfx.playSound("correct");
    expect(oscillators).toBeGreaterThan(0);
  });

  it("does nothing, and never throws, where Web Audio doesn't exist", async () => {
    const { playSound } = await load(false);
    expect(() => playSound("complete")).not.toThrow();
    expect(contexts).toBe(0);
  });

  it("wakes a suspended context on the first tap", async () => {
    const resume = vi.fn(() => Promise.resolve());
    vi.stubGlobal(
      "AudioContext",
      class extends FakeContext {
        state = "suspended";
        resume = resume;
      }
    );
    vi.resetModules();
    await import("./sfx");
    document.dispatchEvent(new Event("pointerdown"));
    expect(resume).toHaveBeenCalled();
  });
});
