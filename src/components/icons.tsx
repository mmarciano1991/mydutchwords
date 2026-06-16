// Line icons drawn inline as SVG, matching the Woordkast design (≈1.6–2px
// stroke, rounded caps, currentColor). No icon font, no emoji.

export function PlusIcon({ size = 19, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowRight({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 8h9M8 3l5 5-5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BackIcon({ color = "#1B4079" }: { color?: string }) {
  return (
    <svg width="11" height="18" viewBox="0 0 12 20" fill="none">
      <path d="M10 2L2 10l8 8" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon({ color = "#1B4079" }: { color?: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="6.5" stroke={color} strokeWidth="2" />
      <path d="M14 14l4 4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SaveIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <path d="M3 4.5A1.5 1.5 0 014.5 3H12l3 3v7.5A1.5 1.5 0 0113.5 15h-9A1.5 1.5 0 013 13.5v-9z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M6 3v4h5V3" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckCircle({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill="#3E7A57" />
      <path d="M5.5 10.2l3 3L14.5 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CrossCircle({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill="#B5462F" />
      <path d="M6.5 6.5l7 7M13.5 6.5l-7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function WarnCircle({ color = "#9A3B22" }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8.2" stroke={color} strokeWidth="1.8" />
      <path d="M10 6v5M10 13.4v.2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function HomeIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 11l8-6 8 6M6 10v9h12v-9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ListIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GearIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8" />
      <path d="M12 2.5l1.4 2.3 2.6-.6.6 2.6 2.3 1.4-1.2 2.4 1.2 2.4-2.3 1.4-.6 2.6-2.6-.6L12 21.5l-1.4-2.3-2.6.6-.6-2.6L5.1 15.8 6.3 13.4 5.1 11l2.3-1.4.6-2.6 2.6.6L12 2.5z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
