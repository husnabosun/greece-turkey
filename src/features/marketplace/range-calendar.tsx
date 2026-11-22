"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { colors } from "@/shared/theme/tokens";
import { cn } from "@/shared/lib/utils";
import { todayIsoDate } from "@/features/marketplace/schedule";

const isoToDate = (iso: string) => new Date(`${iso}T12:00:00`);

function monthStart(iso: string) {
  const d = isoToDate(iso);
  return new Date(d.getFullYear(), d.getMonth(), 1, 12);
}

/**
 * Booking-style date-range calendar (Sofia’s buy-request control).
 * Same UI wherever a start→end window is picked.
 */
export function RangeCalendar({
  start,
  end,
  onChange,
  locale,
  monthsShown = 1,
  minIso,
  prevLabel,
  nextLabel,
  className,
}: {
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
  locale: string;
  monthsShown?: 1 | 2;
  minIso: string;
  prevLabel: string;
  nextLabel: string;
  className?: string;
}) {
  const [view, setView] = useState(() => monthStart(start ?? minIso));
  const [hover, setHover] = useState<string | null>(null);
  const minMonth = monthStart(minIso);

  const weekdays = useMemo(
    // 2026-11-16 is a Monday → Mon..Sun headers in the UI locale.
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Date(2026, 10, 16 + i, 12).toLocaleDateString(locale, { weekday: "short" }),
      ),
    [locale],
  );

  const pick = (iso: string) => {
    if (!start || (start && end)) {
      onChange(iso, null);
    } else if (iso < start) {
      onChange(iso, null);
    } else {
      onChange(start, iso);
    }
  };

  // While choosing the end day, preview the range under the pointer.
  const effEnd = end ?? (start && hover && hover >= start ? hover : null);
  const canGoBack = view.getTime() > minMonth.getTime();
  const shift = (delta: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1, 12));

  const months = Array.from({ length: monthsShown }, (_, i) => new Date(view.getFullYear(), view.getMonth() + i, 1, 12));

  return (
    <div className={cn("select-none", className)} onMouseLeave={() => setHover(null)}>
      <div className={cn("grid gap-6", monthsShown === 2 && "md:grid-cols-2")}>
        {months.map((m, mi) => {
          const offset = (m.getDay() + 6) % 7;
          const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
          const cells: (string | null)[] = [
            ...Array.from({ length: offset }, () => null),
            ...Array.from({ length: daysInMonth }, (_, d) =>
              todayIsoDate(new Date(m.getFullYear(), m.getMonth(), d + 1, 12)),
            ),
          ];
          return (
            <div key={m.toISOString()}>
              <div className="mb-3 flex h-10 items-center justify-between">
                {mi === 0 ? (
                  <button
                    type="button"
                    aria-label={prevLabel}
                    disabled={!canGoBack}
                    onClick={() => shift(-1)}
                    className="flex size-10 items-center justify-center rounded-full text-ink hover:bg-soft disabled:opacity-30"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                ) : (
                  <span className="size-10" />
                )}
                <p className="text-[15px] font-extrabold text-ink capitalize">
                  {m.toLocaleDateString(locale, { month: "long", year: "numeric" })}
                </p>
                {mi === months.length - 1 ? (
                  <button
                    type="button"
                    aria-label={nextLabel}
                    onClick={() => shift(1)}
                    className="flex size-10 items-center justify-center rounded-full text-ink hover:bg-soft"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                ) : (
                  <span className="size-10" />
                )}
              </div>
              <div className="grid grid-cols-7 text-center">
                {weekdays.map((w) => (
                  <span key={`${m.toISOString()}-${w}`} className="pb-2 text-[12px] font-semibold text-muted-foreground">
                    {w}
                  </span>
                ))}
                {cells.map((iso, ci) => {
                  if (!iso) return <span key={`e${ci}`} />;
                  const disabled = iso < minIso;
                  const isStart = iso === start;
                  const isEnd = iso === effEnd;
                  const inside = start != null && effEnd != null && iso > start && iso < effEnd;
                  const edgeBand =
                    start && effEnd && start !== effEnd
                      ? isStart
                        ? `linear-gradient(to right, transparent 50%, ${colors.soft} 50%)`
                        : isEnd
                          ? `linear-gradient(to left, transparent 50%, ${colors.soft} 50%)`
                          : undefined
                      : undefined;
                  const isToday = iso === minIso;
                  return (
                    <div
                      key={iso}
                      className="py-0.5"
                      style={{ background: inside ? colors.soft : edgeBand }}
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => pick(iso)}
                        onMouseEnter={() => setHover(iso)}
                        aria-pressed={isStart || isEnd}
                        aria-label={isoToDate(iso).toLocaleDateString(locale, {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                        className={cn(
                          "mx-auto flex size-10 items-center justify-center rounded-full text-[14px] font-semibold transition-colors",
                          disabled && "cursor-not-allowed text-muted-foreground/40 line-through",
                          !disabled && !isStart && !isEnd && "text-ink hover:border hover:border-ink",
                          (isStart || (isEnd && end)) && "bg-ink font-extrabold text-white",
                          isEnd && !end && !isStart && "border-2 border-dashed border-ink font-extrabold text-ink",
                          isToday && !isStart && !isEnd && "underline decoration-2 underline-offset-4",
                        )}
                      >
                        {isoToDate(iso).getDate()}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
