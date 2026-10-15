/* On-demand examples — the "example" Edge Function (supabase/functions/
   example). For a dictionary sense that shipped without an example, it
   returns one: already written by then for most, or written now by a small
   model, checked, and kept for every learner after. */
import type { Example } from "./dictionary/model";
import { edgeFunction } from "./supabase";

/** What asking for an example came to:
 *    example    one to show
 *    none       the server answered, and has none to give (no project, or
 *               the sense can't get one) — ask again much later
 *    offline    the request didn't get through, or the server isn't set up
 *               yet — ask again next time */
export type ExampleResult = { kind: "example"; example: Example } | { kind: "none" } | { kind: "offline" };

export async function requestExample(senseId: string, signal?: AbortSignal): Promise<ExampleResult> {
  const fn = edgeFunction("example");
  if (!fn) return { kind: "none" };
  let res: Response;
  try {
    res = await fetch(fn.url, { method: "POST", headers: fn.headers, body: JSON.stringify({ senseId }), signal });
  } catch {
    return { kind: "offline" };
  }
  // A server error, or a function not deployed (404) or set up (503) yet,
  // says nothing about the sense — try again next time.
  if (res.status >= 500 || res.status === 404) return { kind: "offline" };
  if (!res.ok) return { kind: "none" };
  try {
    const body = (await res.json()) as Partial<Example>;
    if (typeof body.nl !== "string" || typeof body.en !== "string" || !body.nl.trim() || !body.en.trim()) return { kind: "none" };
    return {
      kind: "example",
      example: { nl: body.nl, en: body.en, targetSpans: Array.isArray(body.targetSpans) ? body.targetSpans : [], source: "generated" },
    };
  } catch {
    return { kind: "offline" };
  }
}
