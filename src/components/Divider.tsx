/* Divider — a short horizontal rule (Figma node 85:226). 60×1, blue/200.
   Used inside the flashcard between the word and its example sentence. */
export function Divider({ className }: { className?: string }) {
  return <div className={`divider-rule${className ? ` ${className}` : ""}`} aria-hidden="true" />;
}
