/* audio — Dutch pronunciation for the Listening exercise.

   First choice is a natural neural voice (Azure Speech, through the "tts"
   Supabase Edge Function): each word is fetched once, kept as an object URL
   for the rest of the visit, and played with an <audio> element. Offline,
   without a Supabase project, or when the call fails, the device's own
   speech synthesis (Web Speech API) speaks instead — its most natural Dutch
   voice. Device voices load asynchronously, so the app re-checks
   availability when the voice list changes. With neither, Listening is
   simply never selected. */
import { edgeFunction } from "./supabase";

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

/** How natural a voice sounds, best first: the neural / premium voices some
 *  browsers and OSes ship ("Microsoft Fenna Online (Natural)", "Xander
 *  (Premium)", "Google Nederlands") over the old robotic defaults. */
const NATURAL = [/natural|neural/i, /premium/i, /enhanced/i, /online|google/i];

function rank(v: SpeechSynthesisVoice): number {
  const i = NATURAL.findIndex((re) => re.test(v.name));
  const quality = i === -1 ? NATURAL.length : i;
  // Netherlands Dutch before Flemish, on equal quality.
  return quality * 2 + (lang(v).startsWith("nl-nl") ? 0 : 1);
}

const lang = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-");

function dutchVoice(): SpeechSynthesisVoice | null {
  const voices = (synth()?.getVoices() ?? []).filter((v) => lang(v).startsWith("nl"));
  return voices.sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/** Whether Dutch pronunciation can be played on this device. */
export function dutchAudioAvailable(): boolean {
  const online = typeof navigator === "undefined" || navigator.onLine;
  return (edgeFunction("tts") !== null && online) || dutchVoice() !== null;
}

/** Calls `listener` whenever availability may have changed: the device's
 *  voice list (often empty at first and filled shortly after load), or the
 *  connection the neural voice needs. Returns an unsubscribe. */
export function onVoicesChanged(listener: () => void): () => void {
  const s = synth();
  s?.addEventListener("voiceschanged", listener);
  if (typeof window !== "undefined") {
    window.addEventListener("online", listener);
    window.addEventListener("offline", listener);
  }
  return () => {
    s?.removeEventListener("voiceschanged", listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("online", listener);
      window.removeEventListener("offline", listener);
    }
  };
}

// ── Neural voice ──

/** Fetched pronunciations, by text: an object URL, or null if it failed. */
const fetched = new Map<string, Promise<string | null>>();
/** The ones already here — played without waiting, so still inside the tap. */
const ready = new Map<string, string>();

/** Starts fetching `text`'s neural pronunciation, once. Calling it as soon
 *  as a word is on screen means the tap on "Play again" finds it ready and
 *  plays it inside the gesture, as iOS requires. */
export function preloadDutch(text: string): Promise<string | null> {
  let p = fetched.get(text);
  if (!p) {
    const fn = edgeFunction("tts");
    p = fn
      ? fetch(fn.url, { method: "POST", headers: fn.headers, body: JSON.stringify({ text }) })
          .then(async (res) => (res.ok ? URL.createObjectURL(await res.blob()) : null))
          .catch(() => null)
      : Promise.resolve(null);
    void p.then((url) => {
      if (url) ready.set(text, url);
      // A failure isn't remembered: offline now may be online on the next try.
      else fetched.delete(text);
    });
    fetched.set(text, p);
  }
  return p;
}

let player: HTMLAudioElement | null = null;
/** Bumped on every request, so a slow fetch never talks over a newer word. */
let latest = 0;

function playNeural(url: string, text: string, id: number) {
  synth()?.cancel();
  player ??= new Audio();
  player.src = url;
  player.currentTime = 0;
  // Autoplay blocked, or the file won't decode: say it with the device.
  player.play().catch(() => id === latest && speakWithDevice(text));
}

/** Speaks `text` in Dutch — the neural voice if it can be had, the device
 *  voice if not — cutting off anything still playing. `delayMs` lets a
 *  feedback sound finish first; anything asked for meanwhile replaces it.
 *  Returns false when neither voice is available. */
export function speakDutch(text: string, { delayMs = 0 }: { delayMs?: number } = {}): boolean {
  if (!dutchAudioAvailable()) return false;
  const id = ++latest;
  player?.pause();
  const start = () => {
    if (id !== latest) return;
    const url = ready.get(text);
    if (url) {
      playNeural(url, text, id);
      return;
    }
    void preloadDutch(text).then((fetchedUrl) => {
      if (id !== latest) return;
      if (fetchedUrl) playNeural(fetchedUrl, text, id);
      else speakWithDevice(text);
    });
  };
  if (delayMs > 0) {
    // Fetch meanwhile, so the word is ready when its turn comes.
    void preloadDutch(text);
    window.setTimeout(start, delayMs);
  } else {
    start();
  }
  return true;
}

/** Silences the spoken word, and drops any still on its way — when an
 *  exercise leaves the screen, its word goes with it. */
export function stopDutch(): void {
  latest++;
  current = null;
  player?.pause();
  const s = synth();
  if (s && (s.speaking || s.pending)) s.cancel();
}

// ── Device voice ──

/** Held so the browser can't garbage-collect it mid-word (Chrome then
 *  cuts it off). */
let current: SpeechSynthesisUtterance | null = null;

function speakWithDevice(text: string): boolean {
  const s = synth();
  const voice = dutchVoice();
  if (!s || !voice) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.9;
  current = u;
  const play = () => {
    // Chrome can leave the engine paused (after a while idle, or a
    // backgrounded tab), and then queues forever without a sound.
    s.resume();
    if (current === u) s.speak(u);
  };
  if (s.speaking || s.pending) {
    // Chrome drops an utterance spoken in the same tick as cancel().
    s.cancel();
    window.setTimeout(play, 60);
  } else {
    play();
  }
  return true;
}
