import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

const variants = {
  risk: "bg-risk text-white hover:bg-risk/90",
  dark: "bg-ink text-white hover:bg-ink/90",
  primary: "bg-primary text-white hover:bg-primary/90",
  outline: "border border-ink bg-card text-ink hover:bg-soft",
  good: "bg-good text-white hover:bg-good/90",
} as const;

export function ApButton({
  label,
  onClick,
  variant = "dark",
  icon,
  compact,
  className,
  type = "button",
  disabled,
}: {
  label: string;
  onClick?: () => void;
  variant?: keyof typeof variants;
  icon?: ReactNode;
  compact?: boolean;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-11 flex-row items-center justify-center gap-1.5 rounded-full text-ap-btn transition-opacity disabled:opacity-50",
        compact ? "px-2" : "px-5",
        variants[variant],
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}
