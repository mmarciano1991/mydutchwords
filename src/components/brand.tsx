// Brand illustrations copied verbatim from the Woordkast design (the tulip
// medallion and small wordmark glyph are the only filled brand marks).

export function TulipGlyph({ size = 17 }: { size?: number }) {
  const h = Math.round((size / 22) * 26);
  return (
    <svg width={size} height={h} viewBox="0 0 22 26" fill="none">
      <path d="M11 25 V13" stroke="#1B4079" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M11 13 C5 13 3 5 5 1 C7 5 9 6 11 5 C13 6 15 5 17 1 C19 5 17 13 11 13Z" fill="#2E5EA8" />
      <path d="M11 22 C6 21 3 17 3 12 C8 13 10 17 11 22Z" fill="#6E92C4" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="brandrow">
      <TulipGlyph />
      <span className="wordmark">Woordkast</span>
    </div>
  );
}

/** The large tulip medallion used on empty state and the session summary. */
export function TulipMedallion({ size = 172 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none">
      <circle cx="90" cy="90" r="86" fill="#FFFFFF" stroke="#1B4079" strokeWidth="2.5" />
      <circle cx="90" cy="90" r="78" fill="none" stroke="#6E92C4" strokeWidth="1.5" strokeDasharray="0.5 7" strokeLinecap="round" />
      <path d="M52 130 Q90 140 128 130" stroke="#1B4079" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M90 130 C90 112 89 104 90 92" stroke="#1B4079" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M90 92 C76 92 70 74 75 60 C80 72 86 74 90 72 C94 74 100 72 105 60 C110 74 104 92 90 92 Z" fill="#2E5EA8" />
      <path d="M90 72 C87 62 90 52 90 48 C90 52 93 62 90 72 Z" fill="#0F2B54" />
      <path d="M90 126 C74 122 62 108 60 90 C78 96 88 108 90 126 Z" fill="#6E92C4" />
      <path d="M90 126 C106 122 118 108 120 90 C102 96 92 108 90 126 Z" fill="#9DB6D8" />
      <circle cx="58" cy="76" r="3" fill="#1B4079" />
      <circle cx="122" cy="76" r="3" fill="#1B4079" />
      <circle cx="68" cy="63" r="2" fill="#6E92C4" />
      <circle cx="112" cy="63" r="2" fill="#6E92C4" />
    </svg>
  );
}

/** Faint tulip watermark for the dashboard hero card. */
export function HeroOrnament() {
  return (
    <svg className="hero__ornament" width="120" height="120" viewBox="0 0 120 120" fill="none">
      <path d="M60 110 V58" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 58 C42 58 36 30 42 16 C48 30 54 32 60 30 C66 32 72 30 78 16 C84 30 78 58 60 58Z" fill="#fff" />
      <path d="M60 100 C42 96 30 78 28 56 C50 62 56 78 60 100Z" fill="#fff" />
    </svg>
  );
}
