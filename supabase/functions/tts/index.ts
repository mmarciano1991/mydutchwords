/* tts — Dutch pronunciation in a natural neural voice (Azure Speech).

   POST { text } → audio/mpeg. Each word is synthesised once: the MP3 is kept
   in the private "tts" storage bucket, keyed by voice and text, and served
   from there afterwards — so a word costs one Azure call, ever.

   Secrets (supabase secrets set …):
     AZURE_SPEECH_KEY     the Speech resource's key
     AZURE_SPEECH_REGION  its region, e.g. westeurope
     AZURE_SPEECH_VOICE   optional; defaults to nl-NL-FennaNeural
   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

   The app has no required account, so this runs without a user JWT
   (verify_jwt = false in config.toml). It only speaks short Dutch words and
   phrases, which bounds what a stray caller can spend. */
import { createClient } from "jsr:@supabase/supabase-js@2";

const VOICE = Deno.env.get("AZURE_SPEECH_VOICE") ?? "nl-NL-FennaNeural";
const BUCKET = "tts";
const MAX_LENGTH = 80;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const storage = admin.storage.from(BUCKET);

function fail(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function audio(body: Blob | ArrayBuffer): Response {
  return new Response(body, {
    headers: { ...cors, "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

async function synthesise(text: string): Promise<ArrayBuffer> {
  const region = Deno.env.get("AZURE_SPEECH_REGION");
  const key = Deno.env.get("AZURE_SPEECH_KEY");
  if (!region || !key) throw new Error("Azure Speech is not configured");
  const ssml =
    `<speak version="1.0" xml:lang="nl-NL"><voice name="${VOICE}">` +
    `<prosody rate="-10%">${escapeXml(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "woordkast-tts",
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`Azure Speech ${res.status}: ${await res.text()}`);
  return res.arrayBuffer();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail(405, "POST only");

  let text: unknown;
  try {
    ({ text } = await req.json());
  } catch {
    return fail(400, "Body must be JSON: { text }");
  }
  if (typeof text !== "string") return fail(400, "text must be a string");
  text = text.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!text || (text as string).length > MAX_LENGTH || !/^[\p{L}\p{M}\s'’.,!?-]+$/u.test(text as string)) {
    return fail(400, `text must be a short word or phrase (≤ ${MAX_LENGTH} letters)`);
  }

  const path = `${VOICE}/${await sha256(text as string)}.mp3`;
  const cached = await storage.download(path);
  if (cached.data) return audio(cached.data);

  try {
    const mp3 = await synthesise(text as string);
    // Caching is best-effort: a failed upload still serves the audio. The
    // bucket is made on first use if the migration hasn't been applied.
    const saved = await storage.upload(path, mp3, { contentType: "audio/mpeg", upsert: true });
    if (saved.error) {
      await admin.storage.createBucket(BUCKET, { public: false });
      await storage.upload(path, mp3, { contentType: "audio/mpeg", upsert: true });
    }
    return audio(mp3);
  } catch (e) {
    console.error(e);
    // Azure's status (401 key/region, 400 voice, 429 quota) — never the key.
    const status = /Azure Speech (\d+)/.exec(String(e))?.[1] ?? (String(e).includes("not configured") ? "unconfigured" : "unreachable");
    return fail(502, `Speech synthesis failed (${status})`);
  }
});
