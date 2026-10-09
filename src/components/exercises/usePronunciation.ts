import { useEffect } from "react";
import { stopDutch, speakDutch } from "../../lib/audio";

/** Every exercise's spoken word. `onShow` is said as the exercise appears
 *  (null: nothing to say yet — the word would give the answer away). Either
 *  way, whatever is still speaking stops when the exercise leaves, so a
 *  quick Continue never has two words talking over each other. */
export function usePronunciation(onShow: string | null): void {
  useEffect(() => {
    if (onShow) speakDutch(onShow);
    return () => stopDutch();
  }, [onShow]);
}
