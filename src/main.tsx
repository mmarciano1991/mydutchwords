import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyTokens } from "./lib/applyTokens";
import "./styles/app.css";

applyTokens();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
