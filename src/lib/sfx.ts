/* sfx — the app's feedback sounds, synthesised on the spot.

   No audio files: each sound is a small Moog-style voice built from Web
   Audio — two slightly detuned saws and a square an octave down, through a
   resonant low-pass filter whose cutoff sweeps with its own envelope, then
   a soft amplitude envelope. Everything ends in a gentle compressor so
   stacked notes never clip.

     correct   a quick rising fifth — bright, short, rewarding.
     wrong     a soft falling half-step, low and filtered dark: a "hm", not
               a buzzer.
     complete  a warm arpeggio up to the octave, landing on a held chord
               whose filter opens and settles — the end of a session.

   Browsers only start audio after a user gesture, so the AudioContext is
   made (or resumed) on the first tap anywhere, and every sound is a no-op
   until then. The same sound asked for twice within a beat plays once, so
   one event can't double up. Muting is per device and leaves the spoken
   Dutch words alone (that's lib/audio). */

export type SoundName = "correct" | "wrong" | "complete";

const MUTE_KEY = "woordkast.sfxMuted";
/** Overall level — feedback should sit under the voice, never over it. */
const MASTER = 0.16;
/** The same sound within this window is one event. */
const DEDUPE_MS = 150;

let ctx: AudioContext | null = null;
let out: AudioNode | null = null;
const lastPlayed = new Map<SoundName, number>();

// ── Mute ──

export function soundEffectsMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundEffectsMuted(muted: boolean): void {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, "1");
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    // Storage blocked: the choice lasts until reload.
  }
  mutedFallback = muted;
}
let mutedFallback = false;
const muted = () => mutedFallback || soundEffectsMuted();

// ── Context ──

function audioContextClass(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Makes or wakes the audio context. Only works inside a user gesture the
 *  first time; called on every tap, so it's ready by the first answer. */
export function unlockSounds(): void {
  const AC = audioContextClass();
  if (!AC) return;
  try {
    if (!ctx) {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 4;
      const master = ctx.createGain();
      master.gain.value = MASTER;
      master.connect(comp).connect(ctx.destination);
      out = master;
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", unlockSounds, { capture: true, passive: true });
  document.addEventListener("keydown", unlockSounds, { capture: true });
}

// ── Voice ──

type Note = {
  /** Seconds after the sound starts. */
  at: number;
  freq: number;
  /** Held length, before release. */
  dur: number;
  /** Peak level, 0–1. */
  level?: number;
  /** Filter cutoff at rest, and how far above it the envelope opens. */
  cutoff?: number;
  sweep?: number;
  /** Filter resonance — the Moog "squelch". */
  q?: number;
  attack?: number;
  release?: number;
  /** Slide up from this frequency (portamento). */
  glideFrom?: number;
};

function voice(c: AudioContext, dest: AudioNode, t0: number, n: Note) {
  const start = t0 + n.at;
  const attack = n.attack ?? 0.008;
  const release = n.release ?? 0.12;
  const end = start + attack + n.dur + release;
  const cutoff = n.cutoff ?? 1400;
  const sweep = n.sweep ?? 2200;

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = n.q ?? 5;
  filter.frequency.setValueAtTime(cutoff, start);
  filter.frequency.linearRampToValueAtTime(cutoff + sweep, start + attack + 0.01);
  filter.frequency.exponentialRampToValueAtTime(Math.max(cutoff * 0.6, 80), end);

  const amp = c.createGain();
  const level = n.level ?? 0.5;
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(level, start + attack);
  amp.gain.setTargetAtTime(level * 0.7, start + attack, n.dur / 3 + 0.01);
  amp.gain.setTargetAtTime(0.0001, start + attack + n.dur, release / 4);
  filter.connect(amp).connect(dest);

  const oscs: [OscillatorType, number, number, number][] = [
    ["sawtooth", 1, -6, 0.5],
    ["sawtooth", 1, 6, 0.5],
    ["square", 0.5, 0, 0.35],
  ];
  for (const [type, ratio, detune, gain] of oscs) {
    const o = c.createOscillator();
    o.type = type;
    o.detune.value = detune;
    if (n.glideFrom) {
      o.frequency.setValueAtTime(n.glideFrom * ratio, start);
      o.frequency.exponentialRampToValueAtTime(n.freq * ratio, start + 0.06);
    } else {
      o.frequency.setValueAtTime(n.freq * ratio, start);
    }
    const g = c.createGain();
    g.gain.value = gain;
    o.connect(g).connect(filter);
    o.start(start);
    o.stop(end + 0.05);
  }
}

// Equal temperament, A4 = 440.
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const C5 = 72;

const SOUNDS: Record<SoundName, Note[]> = {
  correct: [
    { at: 0, freq: hz(C5), dur: 0.05, level: 0.45, cutoff: 1500, sweep: 2600 },
    { at: 0.085, freq: hz(C5 + 7), dur: 0.12, level: 0.5, cutoff: 1600, sweep: 3000, glideFrom: hz(C5 + 5), release: 0.18 },
  ],
  wrong: [
    { at: 0, freq: hz(C5 - 20), dur: 0.09, level: 0.42, cutoff: 500, sweep: 700, q: 3, attack: 0.015 },
    { at: 0.12, freq: hz(C5 - 21), dur: 0.16, level: 0.38, cutoff: 420, sweep: 400, q: 3, attack: 0.02, release: 0.2 },
  ],
  complete: [
    // Arpeggio: C, E, G, C.
    ...[0, 4, 7, 12].map((step, i) => ({
      at: i * 0.09,
      freq: hz(C5 + step),
      dur: 0.06,
      level: 0.38,
      cutoff: 1300 + i * 250,
      sweep: 2400,
    })),
    // The landing chord, filter opening slowly then settling.
    ...[0, 4, 7, 12].map((step) => ({
      at: 0.4,
      freq: hz(C5 + step),
      dur: 0.55,
      level: 0.2,
      cutoff: 700,
      sweep: 2600,
      q: 6,
      attack: 0.06,
      release: 0.5,
    })),
    // A low root underneath, for warmth.
    { at: 0.4, freq: hz(C5 - 12), dur: 0.6, level: 0.22, cutoff: 500, sweep: 600, attack: 0.05, release: 0.5 },
  ],
};

/** Plays one of the feedback sounds — unless muted, audio isn't unlocked
 *  yet, or the same sound just played. Never throws. */
export function playSound(name: SoundName): void {
  if (muted()) return;
  const now = Date.now();
  if (now - (lastPlayed.get(name) ?? -Infinity) < DEDUPE_MS) return;
  if (!ctx || !out) unlockSounds();
  if (!ctx || !out || ctx.state === "closed") return;
  lastPlayed.set(name, now);
  try {
    const t0 = ctx.currentTime + 0.01;
    for (const n of SOUNDS[name]) voice(ctx, out, t0, n);
  } catch {
    // A sound is never worth breaking an answer over.
  }
}

/** How long each sound takes, so speech can start after it. */
export const SOUND_MS: Record<SoundName, number> = { correct: 380, wrong: 480, complete: 1500 };
