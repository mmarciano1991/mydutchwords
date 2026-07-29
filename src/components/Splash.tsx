/* Splash — the branded opening moment (Access flow, Figma 228:1789):
   tulip medallion + wordmark fading in over the cream canvas. Rendered by
   main.tsx both as the lazy-chunk fallback and as a timed overlay on top of
   the app, so it must stay outside the async App chunk and import nothing
   heavy. `out` fades the whole overlay away before it unmounts. */
import { TulipMedallion } from "./brand";

export function Splash({ out = false }: { out?: boolean }) {
  return (
    <div className={`app-shell splash-overlay${out ? " splash-overlay--out" : ""}`} aria-hidden="true">
      <div className="phone splash-phone">
        <div className="splash-content">
          <div className="splash-medallion">
            <TulipMedallion size={120} />
          </div>
          <span className="splash-wordmark">Woordkast</span>
        </div>
      </div>
    </div>
  );
}
