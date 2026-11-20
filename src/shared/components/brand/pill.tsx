import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

const tones = {
  risk: "bg-risk-soft text-risk",
  warn: "bg-warn-soft text-warn-text",
  good: "bg-good-soft text-good",
  accent: "bg-ap-accent-soft text-ap-accent",
  neutral: "bg-soft text-ink",
} as const;

export type PillTone = keyof typeof tones;

export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center justify-center self-start rounded-full px-2.5 text-ap-pill",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
