/* Applies src/styles/tokens/tokens.json as CSS custom properties on :root.
   This is the runtime link between the JSON tokens and the app's CSS — edit
   tokens.json (or re-run `npm run tokens` from design/figma-tokens.json) and
   the values below flow straight into every stylesheet that reads var(--x). */
import tokens from "../styles/tokens/tokens.json";

export function applyTokens(): void {
  const root = document.documentElement.style;
  for (const [name, value] of Object.entries(tokens as Record<string, string>)) {
    root.setProperty(`--${name}`, value);
  }
}
