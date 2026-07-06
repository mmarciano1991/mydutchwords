#!/usr/bin/env node
/**
 * Token build step — Figma → JSON design tokens.
 *
 * Reads design/figma-tokens.json (the structured export from Figma, grouped
 * by collection, with aliases) and flattens it into src/styles/tokens/tokens.json
 * — a single flat { "css-name": "value" } map that the app imports directly
 * and applies as CSS custom properties at runtime (see src/lib/applyTokens.ts).
 *
 * Run this after re-exporting design/figma-tokens.json from Figma. Day-to-day
 * manual tweaks can be made directly in tokens.json — Vite hot-reloads JSON
 * imports, so edits show up immediately without a build step. Just be aware
 * a future `npm run tokens` run will overwrite tokens.json from
 * design/figma-tokens.json, so fold any manual tweak back into that file too
 * if you want it to survive a re-sync.
 *
 * What it emits:
 *   - Color  : primitives as hex (or rgba when alpha < 1); semantic tokens as
 *              `var(--alias)` references so the alias chain is preserved.
 *   - Spacing/Radius/Grid : px strings (except a small unitless denylist).
 *   - Typography : font SIZES only (--size-*). Font FAMILIES stay hand-authored
 *                  in typography.css so the fallback stacks are preserved.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const SRC = resolve(root, "design/figma-tokens.json");
const OUT = resolve(root, "src/styles/tokens/tokens.json");

// FLOAT tokens that must stay unitless (no px suffix).
const UNITLESS = new Set(["grid-columns"]);
// Typography STRING tokens we deliberately do NOT generate (kept hand-authored
// in typography.css to preserve font fallback stacks).
const SKIP = new Set(["font-serif", "font-sans"]);

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderValue(v) {
  if (v.value.alias) return `var(--${v.value.alias})`;
  if (v.type === "COLOR") {
    const { color, alpha } = v.value;
    return alpha != null && alpha < 1 ? hexToRgba(color, alpha) : color;
  }
  if (v.type === "FLOAT") {
    return UNITLESS.has(v.css) ? String(v.value.literal) : `${v.value.literal}px`;
  }
  return String(v.value.literal); // STRING
}

function main() {
  const { collections } = JSON.parse(readFileSync(SRC, "utf8"));
  const tokens = {};

  let count = 0;
  for (const vars of Object.values(collections)) {
    for (const v of vars) {
      if (SKIP.has(v.css)) continue;
      tokens[v.css] = renderValue(v);
      count++;
    }
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(tokens, null, 2) + "\n", "utf8");
  console.log(`✓ Wrote ${count} tokens → ${OUT.replace(root + "/", "")}`);
}

main();
