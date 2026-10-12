/* InfoPill — a small labelled pill that explains itself: "Generated
   example", "Reconstructed meaning", "Belgium", a register. It is a button
   with its full label ("Generated example, open explanation"); tapping it
   shows one line of explanation under it. Never colour alone. */
import { useId, useState } from "react";

export type InfoPillKind = "generated" | "reconstructed" | "belgium" | "formal" | "informal" | "vulgar" | "archaic" | "rare" | "personal";

const COPY: Record<InfoPillKind, { label: string; explanation: string }> = {
  generated: {
    label: "Generated example",
    explanation: "Written automatically for this meaning and checked for spelling, de/het and meaning. No real sentence was found yet.",
  },
  reconstructed: {
    label: "Reconstructed meaning",
    explanation: "This word isn't in the dictionary. Its meaning is built from its parts, which are; the last part gives the article and plural.",
  },
  belgium: { label: "Belgium", explanation: "Used mainly in Belgium (Flemish Dutch)." },
  formal: { label: "Formal", explanation: "Used in formal writing and official letters." },
  informal: { label: "Informal", explanation: "Used in everyday speech; avoid it in formal writing." },
  vulgar: { label: "Vulgar", explanation: "Offensive or crude. Good to recognise; careful using it." },
  archaic: { label: "Old-fashioned", explanation: "Old-fashioned or rare today." },
  rare: { label: "Rare", explanation: "Rarely used today." },
  personal: { label: "Personal word", explanation: "Saved with your own translation — it wasn't in the dictionary." },
};

export function InfoPill({ kind }: { kind: InfoPillKind }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { label, explanation } = COPY[kind];
  return (
    <span className="info-pill-wrap">
      <button
        type="button"
        className={`info-pill info-pill--${kind}`}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label}, ${open ? "close" : "open"} explanation`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {label}
      </button>
      {open && (
        <span id={id} className="info-pill__explanation" role="note">
          {explanation}
        </span>
      )}
    </span>
  );
}

/** The pills a sense earns from its data. */
export function sensePills(s: { variety?: string; register?: string; reconstructed?: boolean }): InfoPillKind[] {
  const out: InfoPillKind[] = [];
  if (s.reconstructed) out.push("reconstructed");
  if (s.variety === "BE") out.push("belgium");
  if (s.register) out.push(s.register as InfoPillKind);
  return out;
}
