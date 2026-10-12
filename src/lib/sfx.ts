/* sfx — the app's feedback sounds, synthesised on the spot.

   No audio files: each sound is built from Web Audio. Two round voices:
     keys  a soft electric-piano-ish pluck — a sine with a little triangle
           and a faint octave, through a gentle low-pass, decaying like a
           struck note.
     pad   a slow-blooming chord tone — detuned triangles and a sub sine,
           filter opening as it swells.
   Everything plays in small chords rather than single lines, and goes
   through a short synthetic room reverb and a gentle compressor so stacked
   notes stay soft and never clip.

     correct   a light rising chime — two little major chords.
     wrong     a soft, dark, falling dyad: a "hm", not a buzzer.
     complete  a gentle IV – V – I cadence with a sparkling arpeggio over
               the final chord — a small, quiet victory.

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
      comp.threshold.value = -20;
      comp.ratio.value = 3;
      comp.connect(ctx.destination);
      const master = ctx.createGain();
      master.gain.value = MASTER;
      master.connect(comp);
      addRoom(ctx, master, comp);
      out = master;
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

/** A short, soft room: decaying noise as an impulse response, mixed in
 *  under the dry signal. Skipped quietly where convolution isn't there. */
function addRoom(c: AudioContext, from: AudioNode, to: AudioNode) {
  try {
    const seconds = 1.6;
    const len = Math.floor(c.sampleRate * seconds);
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    const room = c.createConvolver();
    room.buffer = ir;
    // Darken the tail so it reads as warmth, not hiss.
    const tone = c.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 3200;
    const wet = c.createGain();
    wet.gain.value = 0.32;
    from.connect(room).connect(tone).connect(wet).connect(to);
  } catch {
    // Dry is fine.
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
  /** How long it sounds before release. */
  dur: number;
  /** Peak level, 0–1. */
  level?: number;
  kind?: "keys" | "pad";
  /** Filter cutoff as a multiple of the note's pitch — lower is darker. */
  bright?: number;
  attack?: number;
  release?: number;
  /** Stereo position, -1 (left) to 1 (right). */
  pan?: number;
};

// [wave, pitch ratio, detune in cents, gain]
type Partial = [OscillatorType, number, number, number];
const KEYS: Partial[] = [
  ["sine", 1, 0, 0.7],
  ["triangle", 1, 4, 0.3],
  ["sine", 2, -3, 0.08],
];
const PAD: Partial[] = [
  ["triangle", 1, -7, 0.4],
  ["triangle", 1, 7, 0.4],
  ["sine", 0.5, 0, 0.25],
];

function voice(c: AudioContext, dest: AudioNode, t0: number, n: Note) {
  const pad = n.kind === "pad";
  const start = t0 + n.at;
  const attack = n.attack ?? (pad ? 0.18 : 0.012);
  const release = n.release ?? (pad ? 0.7 : 0.35);
  const end = start + attack + n.dur + release;
  const level = n.level ?? 0.3;
  const cutoff = Math.min(n.freq * (n.bright ?? (pad ? 2.5 : 3.5)), 6000);

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 0.7;
  if (pad) {
    // The chord blooms: filter opens with the swell.
    filter.frequency.setValueAtTime(cutoff * 0.5, start);
    filter.frequency.linearRampToValueAtTime(cutoff, start + attack + n.dur * 0.5);
  } else {
    // A struck note mellows as it rings.
    filter.frequency.setValueAtTime(cutoff, start);
    filter.frequency.setTargetAtTime(cutoff * 0.5, start + attack, n.dur + 0.05);
  }

  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.linearRampToValueAtTime(level, start + attack);
  amp.gain.setTargetAtTime(level * (pad ? 0.8 : 0.4), start + attack, (n.dur + 0.02) / 2);
  amp.gain.setTargetAtTime(0.0001, start + attack + n.dur, release / 4);
  filter.connect(amp);

  if (n.pan && typeof c.createStereoPanner === "function") {
    const p = c.createStereoPanner();
    p.pan.value = n.pan;
    amp.connect(p).connect(dest);
  } else {
    amp.connect(dest);
  }

  for (const [type, ratio, detune, gain] of pad ? PAD : KEYS) {
    const o = c.createOscillator();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(n.freq * ratio, start);
    const g = c.createGain();
    g.gain.value = gain;
    o.connect(g).connect(filter);
    o.start(start);
    o.stop(end + 0.05);
  }
}

// Equal temperament, A4 = 440.
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const C4 = 60;

/** A chord of `kind` notes, all struck together, spread a little in stereo. */
function chord(at: number, steps: number[], n: Omit<Note, "at" | "freq">): Note[] {
  return steps.map((step, i) => ({
    ...n,
    at,
    freq: hz(C4 + step),
    pan: steps.length > 1 ? (i / (steps.length - 1) - 0.5) * 0.6 : 0,
  }));
}

const SOUNDS: Record<SoundName, Note[]> = {
  correct: [
    // C/E, then up to a C chord topped by G — a little lift.
    ...chord(0, [12, 16], { dur: 0.06, level: 0.24 }),
    ...chord(0.09, [16, 19, 24], { dur: 0.22, level: 0.22, release: 0.45 }),
  ],
  wrong: [
    // A low minor third sinking a semitone, kept dark.
    ...chord(0, [-2, 1], { dur: 0.1, level: 0.26, bright: 2, attack: 0.02 }),
    ...chord(0.15, [-3, 0], { dur: 0.2, level: 0.24, bright: 1.8, attack: 0.025, release: 0.4 }),
  ],
  complete: [
    // IV — Fmaj7, with the melody on C.
    ...chord(0, [-7, 5, 9, 16], { kind: "pad", dur: 0.25, level: 0.12, attack: 0.08, release: 0.35 }),
    ...chord(0, [24], { dur: 0.2, level: 0.22 }),
    // V — G, melody steps up to D.
    ...chord(0.38, [-5, 7, 11, 14], { kind: "pad", dur: 0.25, level: 0.12, attack: 0.08, release: 0.35 }),
    ...chord(0.38, [26], { dur: 0.2, level: 0.22 }),
    // I — a wide C(add9) that blooms and rings out.
    ...chord(0.76, [-12, 7, 12, 14, 16], { kind: "pad", dur: 0.9, level: 0.12, attack: 0.15, release: 1.3 }),
    // A sparkle up the chord on top, ending high on E.
    ...[24, 28, 31, 36, 40].map((step, i) => ({
      at: 0.76 + i * 0.08,
      freq: hz(C4 + step),
      dur: i === 4 ? 0.5 : 0.12,
      level: i === 4 ? 0.16 : 0.2,
      release: i === 4 ? 1.1 : 0.5,
      pan: (i / 4 - 0.5) * 0.8,
    })),
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
export const SOUND_MS: Record<SoundName, number> = { correct: 420, wrong: 520, complete: 2000 };
