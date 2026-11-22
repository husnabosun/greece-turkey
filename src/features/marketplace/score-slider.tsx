"use client";

import { colors } from "@/shared/theme/tokens";
import { cn } from "@/shared/lib/utils";

export const SCORE_SLIDER_MIN = 50;
export const SCORE_SLIDER_MAX = 95;

export type ScoreBand = "low" | "mid" | "high";

export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return "high";
  if (score >= 70) return "mid";
  return "low";
}

/** Shared Tailwind tones for any score badge / pill (80+ good, 70–79 warn, else risk). */
export function scoreToneClasses(score: number): {
  soft: string;
  text: string;
  pill: "good" | "warn" | "risk";
} {
  const band = scoreBand(score);
  if (band === "high") return { soft: "bg-good-soft", text: "text-good", pill: "good" };
  if (band === "mid") return { soft: "bg-warn-soft", text: "text-warn-text", pill: "warn" };
  return { soft: "bg-risk-soft", text: "text-risk", pill: "risk" };
}

export function scoreToneClassName(score: number): string {
  const tone = scoreToneClasses(score);
  return `${tone.soft} ${tone.text}`;
}

const BAND_COLOR = { low: colors.risk, mid: colors.warn, high: colors.good } as const;

/**
 * Colorful min-score slider (Sofia’s buy-request control).
 * Reuse everywhere a quality minimum is chosen or filtered.
 */
export function ScoreSlider({
  label,
  value,
  onChange,
  valueLabel,
  bandLabel,
  hint,
  min = SCORE_SLIDER_MIN,
  max = SCORE_SLIDER_MAX,
  step = 1,
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  valueLabel: string;
  bandLabel: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const span = Math.max(1, max - min);
  const pct = ((Math.min(max, Math.max(min, value)) - min) / span) * 100;
  const pos = (v: number) => ((Math.min(max, Math.max(min, v)) - min) / span) * 100;
  const band = scoreBand(value);
  const ticks = [50, 60, 70, 80, 90].filter((t) => t >= min && t <= max);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-end justify-between gap-3">
        <span className="text-[13px] leading-[18px] font-semibold text-muted-foreground">{label}</span>
        <div className="text-right">
          <p className="text-[24px] leading-7 font-extrabold" style={{ color: BAND_COLOR[band] }}>
            {valueLabel}
          </p>
          <p className="text-[12px] font-semibold text-muted-foreground">{bandLabel}</p>
        </div>
      </div>
      <div className="relative h-8">
        {/* zones: &lt;70 risk, 70–79 warn, ≥80 good — active fill from thumb to the right */}
        <div className="absolute inset-x-0 top-1/2 flex h-2 -translate-y-1/2 overflow-hidden rounded-full">
          <div style={{ width: `${Math.max(0, pos(70))}%`, background: colors.riskSoft }} />
          <div style={{ width: `${Math.max(0, pos(80) - pos(70))}%`, background: colors.warnSoft }} />
          <div style={{ flex: 1, background: colors.goodSoft }} />
        </div>
        <div
          className="absolute top-1/2 right-0 h-2 -translate-y-1/2 rounded-r-full"
          style={{ left: `${pct}%`, background: BAND_COLOR[band], opacity: 0.85 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          aria-valuetext={valueLabel}
          className={cn(
            "absolute inset-0 h-8 w-full cursor-pointer appearance-none bg-transparent",
            "[&::-webkit-slider-runnable-track]:h-8 [&::-webkit-slider-runnable-track]:bg-transparent",
            "[&::-webkit-slider-thumb]:mt-1 [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-ink [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.35)]",
            "[&::-moz-range-track]:bg-transparent",
            "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-ink [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.35)]",
            "focus-visible:outline-none focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-ink/20",
          )}
        />
      </div>
      <div className="relative h-4 text-[12px] font-semibold text-muted-foreground">
        {ticks.map((tick) => (
          <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${pos(tick)}%` }}>
            {tick}
          </span>
        ))}
      </div>
      {hint ? <p className="text-[13px] font-medium text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
