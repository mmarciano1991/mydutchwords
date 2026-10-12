/* useLookup — resolves one picked or tapped word to every sense it can be
   (lib/dictionary/service lookup), with the request lifecycle the screens
   need: the latest pick wins, a slow answer shows a placeholder, a failure
   offers "Try again". */
import { useEffect, useState } from "react";
import { lookup, type LookupResult } from "./dictionary/service";

export type LookupState =
  | { status: "idle" }
  | { status: "loading"; form: string }
  | { status: "done"; form: string; result: LookupResult }
  | { status: "error"; form: string };

export function useLookup(form: string | null, sentence?: { text: string; start: number; end: number }): LookupState & { retry: () => void } {
  const [state, setState] = useState<LookupState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const sentenceKey = sentence ? `${sentence.start}:${sentence.text}` : "";

  useEffect(() => {
    if (!form) {
      setState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setState({ status: "loading", form });
    lookup(form, { sentence, signal: controller.signal }).then(
      (result) => !controller.signal.aborted && setState({ status: "done", form, result }),
      () => !controller.signal.aborted && setState({ status: "error", form })
    );
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, sentenceKey, attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}
