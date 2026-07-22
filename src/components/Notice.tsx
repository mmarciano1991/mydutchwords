/* Notice — status banner (Figma node 62:18). Variants: error · caution ·
   success · info, each with its Material status icon. Info is for neutral
   facts (e.g. "already in your deck") — calm blue, not an alarm. Text uses
   UI/Body Bold. Colour (icon + text) comes from the variant's foreground
   token via CSS `currentColor`. */
import type { ReactNode } from "react";
import { Cancel, CheckCircle, Error as ErrorIcon, Info } from "../icons";

export type NoticeType = "error" | "caution" | "success" | "info";

const ICON = {
  error: Cancel,
  caution: ErrorIcon,
  success: CheckCircle,
  info: Info,
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
