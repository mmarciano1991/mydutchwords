// Line icons drawn inline as SVG, matching the Woordkast design (≈1.6–2px
// stroke, rounded caps). No icon font, no emoji.
//
// Most UI glyphs live in src/icons (the Material Symbols set exported from
// Figma); this file is only for shapes that set has no equivalent of.

export function SearchIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="6.5" stroke={color} strokeWidth="2" />
      <path d="M14 14l4 4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
