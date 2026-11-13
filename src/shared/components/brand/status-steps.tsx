import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function StatusSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 flex-col items-center">
            <div className="flex h-6 w-full items-center justify-center">
              <div className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : i <= current ? "bg-good" : "bg-line")} />
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-full",
                  done ? "bg-good" : active ? "border-2 border-good bg-card" : "bg-soft",
                )}
              >
                {done ? <Check className="size-3.5 text-white" strokeWidth={3} aria-hidden /> : null}
              </div>
              <div
                className={cn(
                  "h-0.5 flex-1",
                  i === steps.length - 1 ? "bg-transparent" : i < current ? "bg-good" : "bg-line",
                )}
              />
            </div>
            <p
              className={cn(
                "mt-1 text-ap-small",
                active ? "font-semibold text-ink" : done ? "font-semibold text-good" : "font-normal text-muted-foreground",
              )}
            >
              {label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
