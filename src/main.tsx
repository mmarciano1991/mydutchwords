import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { applyTokens } from "./lib/applyTokens";
import "./styles/app.css";

applyTokens();

// The app (and with it the ~14k-word bundled dictionary, by far the largest
// part of the JS) loads as a separate async chunk, so the first paint — the
// splash below — doesn't wait for it.
const App = lazy(() => import("./App"));

function Splash() {
  return (
    <div className="app-shell">
      <div className="phone" style={{ alignItems: "center", justifyContent: "center" }}>
        <span className="wordmark" style={{ fontSize: 14 }}>Woordkast</span>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<Splash />}>
      <App />
    </Suspense>
  </StrictMode>
);
