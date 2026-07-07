/* Badge — small status pill with an icon (Figma node 155:353).
   Currently only the "success" tone is designed (used for the session
   report's "Batch of N done" pill). */
import type { ReactNode } from "react";
import { Check } from "../icons";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="badge">
      <Check size={18} />
      {children}
    </span>
  );
}
