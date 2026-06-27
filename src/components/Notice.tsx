/* Notice — status banner (Figma node 62:18). Variants: error · caution · success,
   each with its Material status icon. Text uses UI/Body Bold. Colour (icon + text)
   comes from the variant's foreground token via CSS `currentColor`. */
import type { ReactNode } from "react";
import { Cancel, CheckCircle, Error as ErrorIcon } from "../icons";

export type NoticeType = "error" | "caution" | "success";

const ICON = {
  error: Cancel,
  caution: ErrorIcon,
  success: CheckCircle,
} as const;

export function Notice({
  type,
  children,
}: {
  type: NoticeType;
  children: ReactNode;
}) {
  const Icon = ICON[type];
  return (
    <div className={`notice notice--${type}`} role="status">
      <Icon className="notice__icon" />
      <span>{children}</span>
    </div>
  );
}
