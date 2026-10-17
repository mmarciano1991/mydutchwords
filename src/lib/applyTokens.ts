/* Applies src/styles/tokens/tokens.json as CSS custom properties on :root.
   This is the runtime link between the JSON tokens and the app's CSS — edit
   tokens.json (or re-run `npm run tokens` from design/figma-tokens.json) and
   the values below flow straight into every stylesheet that reads var(--x). */
import tokens from "../styles/tokens/tokens.json";

/** Type sizes come from Figma in px; they are applied in rem (px / 16) so
 *  text follows the user's text-size setting (see the root rule in
 *  app.css). Everything else keeps its unit. */
export function tokenValue(name: string, value: string): string {
  const px = /^size-/.test(name) ? /^(\d+(?:\.\d+)?)px$/.exec(value) : null;
  return px ? `${Number(px[1]) / 16}rem` : value;
}

export function applyTokens(): void {
  const root = document.documentElement.style;
  for (const [name, value] of Object.entries(tokens as Record<string, string>)) {
    root.setProperty(`--${name}`, tokenValue(name, value));
  }
}
