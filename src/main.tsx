import { lazy, StrictMode, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { applyTokens } from "./lib/applyTokens";
import { Splash } from "./components/Splash";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { installErrorReporting } from "./lib/errorReporting";
import { prepareDurableStorage } from "./lib/durableStore";
import "./styles/app.css";

installErrorReporting();
applyTokens();

// The app loads as a separate async chunk, so the first paint — the splash —
// doesn't wait for it. Durable storage goes first: in a native shell it puts
// back any progress the web view's storage lost, before the app reads it.
const App = lazy(() => prepareDurableStorage().then(() => import("./App")));

// The splash is a deliberate opening beat (Access flow, Figma 228:1789), not
// just a loading state: it overlays the app for a moment, then fades away to
// reveal whatever the app decided to show first (sign-in gate or home).
const SPLASH_HOLD_MS = 1400;
const SPLASH_FADE_MS = 450;

function Root() {
  const [phase, setPhase] = useState<"hold" | "out" | "done">("hold");

  useEffect(() => {
    const out = window.setTimeout(() => setPhase("out"), SPLASH_HOLD_MS);
    const done = window.setTimeout(() => setPhase("done"), SPLASH_HOLD_MS + SPLASH_FADE_MS);
    return () => {
      window.clearTimeout(out);
      window.clearTimeout(done);
    };
  }, []);

  return (
    <>
      {/* If the chunk load somehow outlasts the splash, the splash simply
          stays up (fully faded in) until the app is ready. */}
      <ErrorBoundary>
        <Suspense fallback={<Splash />}>
          <App />
        </Suspense>
      </ErrorBoundary>
      {phase !== "done" && <Splash out={phase === "out"} />}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
