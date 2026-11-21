import { Check, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export function StatusSteps({
  steps,
  current,
  captions,
  failedAt,
}: {
  steps: string[];
  current: number;
  /** Step that failed (e.g. lab check): drawn red with an ✗ and nothing after it is reached. */
  failedAt?: number;
  /** Optional date/meta under each step label (B3). */
  captions?: (string | null | undefined)[];
}) {
  return (
    <div className="flex">
      {steps.map((label, i) => {
        const failed = failedAt != null && i === failedAt;
        const done = !failed && i < current;
        const active = !failed && i === current;
        const caption = captions?.[i];
        return (
          <div key={`${label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex h-6 w-full items-center justify-center">
              <div className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : i <= current ? "bg-good" : "bg-line")} />
              <div
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  failed ? "bg-risk" : done ? "bg-good" : active ? "border-2 border-good bg-card" : "bg-soft",
                )}
              >
                {done ? <Check className="size-3.5 text-white" strokeWidth={3} aria-hidden /> : null}
                {failed ? <X className="size-3.5 text-white" strokeWidth={3} aria-hidden /> : null}
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
                "text-[12px] max-[399px]:line-clamp-2 min-[400px]:text-ap-small min-[400px]:leading-normal",
                failed
                  ? "font-semibold text-risk"
                  : active
                    ? "font-semibold text-ink"
                    : done
                      ? "font-semibold text-good"
                      : "font-normal text-muted-foreground",
              )}
            >
              {label}
            </p>
            {caption ? (
              <p className="mt-0.5 max-w-full truncate px-0.5 text-center text-[12px] text-muted-foreground">
                {caption}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
