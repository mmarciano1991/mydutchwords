# Design tokens — Figma ↔ code sync

This project keeps its **design-token values** in the Figma design system and
generates the CSS from them, so design and code can't silently drift.

## Files

| File | Role | Edit by hand? |
|---|---|---|
| `design/figma-tokens.json` | Snapshot of the token values exported from Figma (colors, spacing, radius, grid, font sizes). **Source of truth for values.** | Only via re-export (see below) |
| `scripts/build-tokens.mjs` | Transforms the JSON → CSS custom properties. | Yes (it's the transform) |
| `src/styles/tokens/_generated.css` | The generated CSS variables. | **Never** — overwritten on build |
| `src/styles/tokens/typography.css` | Font families + `--type-*` composition (uses generated `--size-*`). | Yes |
| `src/styles/tokens/shadows.css` | Shadow tokens (mirror of Figma effect styles). | Yes |
| `src/styles/tokens/fonts.css` | `@font-face` / webfont import. | Yes |

## Regenerate the CSS

```bash
npm run tokens
```

Reads `design/figma-tokens.json` and rewrites `src/styles/tokens/_generated.css`.

## The sync loop (design → code)

1. **Change token values in Figma** (e.g. recolor `blue/700`, change `space/5`).
   Every variable carries its CSS name as **code syntax** (`var(--blue-700)`),
   which is the contract between Figma and this repo.
2. **Re-export `design/figma-tokens.json`.** Two options:
   - **Plugin export (used to bootstrap this):** run the variables-export script
     against the Figma file via the Figma MCP / a small plugin, and paste the
     resulting JSON into `design/figma-tokens.json`.
   - **Figma REST API (recommended for automation):** `GET
     /v1/files/:key/variables/local` with a Figma personal access token, then
     map each variable's `codeSyntax.WEB` → CSS name and its mode value → CSS
     value. (Requires a paid Figma seat for the Variables REST endpoint.)
3. **Run `npm run tokens`** and commit the regenerated `_generated.css`.

Because the app's components consume the variables (`var(--primary)`, …), the
whole UI restyles automatically — no component edits needed for pure retokens.

## What is NOT auto-generated (on purpose)

- **Font families** (`--font-serif`, `--font-sans`) stay hand-authored in
  `typography.css` so the fallback stacks survive (Figma only stores the bare
  family name).
- **Shadows** live in `shadows.css` (mirror of Figma effect styles) — shadows
  can't be Figma *variables*.
- **Component structure & page layout** are not derived from Figma — those are
  implemented in React and verified visually per change. Only the *token layer*
  is deterministic.

## Adding a new token

Create the variable in Figma **first** (with WEB code syntax `var(--your-name)`),
re-export the JSON, then `npm run tokens`. Never add a token only in code — it
would be overwritten on the next regenerate.
