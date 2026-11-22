"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ApCard, Pill } from "@/shared/components/brand";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { colors } from "@/shared/theme/tokens";
import { HISTORY_MONTHS, scoreAxis } from "@/features/quality/score-history";
import { useScoreHistory } from "@/features/quality/use-score-history";
import { cn } from "@/shared/lib/utils";

// SVG user space; the svg scales to the card width (fits 390px phones, labels stay >= 10px).
const W = 320;
const H = 150;
const PAD_L = 30;
const PAD_R = 14;
const PAD_T = 24;
const PAD_B = 22;

type Props = {
  fieldId: string | null | undefined;
  /** Change this (e.g. latest score id) to refetch after a new score is saved. */
  refreshKey?: string | number | null;
  className?: string;
};

/** 6-month quality score line chart for one field, with the current score highlighted. */
export function ScoreHistoryChart({ fieldId, refreshKey, className }: Props) {
  const t = useTranslations("scoreHistory");
  const locale = useLocale();
  const { history, loading } = useScoreHistory(fieldId, refreshKey);
  const [picked, setPicked] = useState<number | null>(null);

  const monthLabel = (d: Date) => d.toLocaleDateString(locale, { month: "short" });

  if (loading) {
    return <Skeleton className={cn("h-48 w-full rounded-card", className)} />;
  }

  const points = history?.points ?? [];

  if (!history || !history.hasHistory) {
    return (
      <ApCard className={cn("p-4", className)}>
        <p className="text-ap-card font-extrabold text-ink">{t("title")}</p>
        <p className="mt-1 text-ap-body font-semibold text-ink">{t("emptyTitle")}</p>
        <p className="mt-0.5 text-ap-small text-muted-foreground">{t("emptyBody")}</p>
      </ApCard>
    );
  }

  const { lo, hi, ticks } = scoreAxis(points.map((p) => p.score));
  const x = (slot: number) => PAD_L + (slot * (W - PAD_L - PAD_R)) / (HISTORY_MONTHS - 1);
  const y = (s: number) => PAD_T + ((hi - s) / (hi - lo)) * (H - PAD_T - PAD_B);
  const step = (W - PAD_L - PAD_R) / (HISTORY_MONTHS - 1);

  const currentIdx = points.findIndex((p) => p.current);
  const sel = picked !== null && picked < points.length ? picked : currentIdx;
  const selPoint = points[sel]!;
  const tipW = 30;
  const tipX = Math.min(Math.max(PAD_L, x(selPoint.slot) - tipW / 2), W - PAD_R - tipW);
  const tipY = Math.max(2, y(selPoint.score) - 24);

  const change = history.change;
  const sinceLabel = monthLabel(history.since!);
  const tone = change > 0 ? "good" : change < 0 ? "risk" : "neutral";
  const summary =
    change > 0
      ? t("up", { n: change, month: sinceLabel })
      : change < 0
        ? t("down", { n: Math.abs(change), month: sinceLabel })
        : t("same", { month: sinceLabel });

  return (
    <ApCard className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-ap-card font-extrabold text-ink">{t("title")}</p>
          <p className="text-ap-small text-muted-foreground">{t("subtitle", { n: HISTORY_MONTHS })}</p>
        </div>
        <Pill tone={tone}>{change > 0 ? `+${change}` : String(change)}</Pill>
      </div>

      <p
        className={cn(
          "mt-2 text-ap-body font-bold",
          change > 0 ? "text-good" : change < 0 ? "text-risk" : "text-muted-foreground",
        )}
      >
        {summary}
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 block h-auto w-full"
        role="img"
        aria-label={t("chartLabel", { n: HISTORY_MONTHS })}
      >
        {ticks.map((g) => (
          <g key={g}>
            <line x1={PAD_L - 6} x2={W - PAD_R} y1={y(g)} y2={y(g)} stroke={colors.line} strokeWidth={1} />
            <text x={PAD_L - 10} y={y(g) + 3.5} textAnchor="end" fontSize={10} fill={colors.muted}>
              {g}
            </text>
          </g>
        ))}
        <line
          x1={x(selPoint.slot)}
          x2={x(selPoint.slot)}
          y1={PAD_T - 6}
          y2={H - PAD_B}
          stroke={colors.line}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <polyline
          points={points.map((p) => `${x(p.slot)},${y(p.score)}`).join(" ")}
          fill="none"
          stroke={colors.accent}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle
            key={p.slot}
            cx={x(p.slot)}
            cy={y(p.score)}
            r={i === sel ? 5.5 : 4}
            fill={i === sel ? colors.accent : colors.card}
            stroke={i === sel ? colors.card : colors.accent}
            strokeWidth={2}
          />
        ))}
        <g pointerEvents="none">
          <rect x={tipX} y={tipY} width={tipW} height={18} rx={6} fill={colors.ink} />
          <text x={tipX + tipW / 2} y={tipY + 12.5} textAnchor="middle" fontSize={11} fontWeight={800} fill="#fff">
            {selPoint.score}
          </text>
        </g>
        {Array.from({ length: HISTORY_MONTHS }, (_, slot) => {
          const p = points.find((q) => q.slot === slot);
          const isNow = Boolean(p?.current) && slot === HISTORY_MONTHS - 1;
          const d = p?.month ?? new Date(new Date().getFullYear(), new Date().getMonth() - (HISTORY_MONTHS - 1 - slot), 1);
          return (
            <text
              key={slot}
              x={x(slot)}
              y={H - 5}
              textAnchor="middle"
              fontSize={10}
              fontWeight={p && p === selPoint ? 800 : 500}
              fill={p && p === selPoint ? colors.ink : colors.muted}
            >
              {isNow ? t("now") : monthLabel(d)}
            </text>
          );
        })}
        {/* Hit targets: one full-height column per data point, much bigger than the dot (touch friendly). */}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.slot}`}
            x={x(p.slot) - Math.max(step / 2, 22)}
            y={0}
            width={Math.max(step, 44)}
            height={H}
            fill="transparent"
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={t("pointLabel", { month: monthLabel(p.month), n: p.score })}
            onClick={() => setPicked(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setPicked(i);
              }
            }}
          />
        ))}
      </svg>
    </ApCard>
  );
}
