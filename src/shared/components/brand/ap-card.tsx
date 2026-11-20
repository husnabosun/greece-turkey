import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export function ApCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-card border border-line bg-card", className)}>{children}</div>;
}

export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-4 flex items-baseline justify-between", className)}>
      <h2 className="text-[17px] font-extrabold text-ink">{title}</h2>
      {action}
    </div>
  );
}
