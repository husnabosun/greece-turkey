import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function StatusSteps({
  steps,
  current,
  captions,
}: {
  steps: string[];
  current: number;
  /** Optional date/meta under each step label (B3). */
  captions?: (string | null | undefined)[];
}) {
  return (
    <div className="flex">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const caption = captions?.[i];
        return (
          <div key={`${label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex h-6 w-full items-center justify-center">
              <div className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : i <= current ? "bg-good" : "bg-line")} />
              <div
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
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
                "mt-1 max-w-full px-0.5 text-center leading-tight",
                "text-[11px] max-[399px]:line-clamp-2 min-[400px]:text-ap-small min-[400px]:leading-normal",
                active ? "font-semibold text-ink" : done ? "font-semibold text-good" : "font-normal text-muted-foreground",
              )}
            >
              {label}
            </p>
            {caption ? (
              <p className="mt-0.5 max-w-full truncate px-0.5 text-center text-[10px] text-muted-foreground">
                {caption}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
