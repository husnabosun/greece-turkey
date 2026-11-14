"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { useFieldWeather } from "@/features/weather-risk/use-field-weather";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { ApCard, Pill, AIBox } from "@/shared/components/brand";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Link } from "@/shared/i18n/navigation";
import { colors } from "@/shared/theme/tokens";

type ScorePayload = {
  score: number;
  breakdown: { tree: number; spray: number; harvest: number; records: number };
  plan: { text: string; points: number }[];
  engineVersion: string;
};

function ScoreRing({ score, qualityLabel }: { score: number; qualityLabel: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const low = score < 70;
  const stroke = low ? colors.risk : colors.good;
  return (
    <div className="relative mx-auto size-36">
      <svg viewBox="0 0 140 140" className="size-full -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#E6E6E2" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className={`text-3xl font-extrabold tabular-nums ${low ? "text-risk" : "text-good"}`}>{score}</p>
        <p className="text-[11px] font-bold text-muted-foreground">{qualityLabel}</p>
      </div>
    </div>
  );
}

function barTone(
  v: number,
  t: (key: "toneExcellent" | "toneVeryGood" | "toneGood" | "toneNeedsWork") => string,
): { label: string; pill: "good" | "warn" | "risk" | "accent"; bar: string } {
  if (v >= 85) return { label: t("toneExcellent"), pill: "accent", bar: "bg-ap-accent" };
  if (v >= 75) return { label: t("toneVeryGood"), pill: "good", bar: "bg-good" };
  if (v >= 60) return { label: t("toneGood"), pill: "good", bar: "bg-good" };
  if (v >= 40) return { label: t("toneNeedsWork"), pill: "warn", bar: "bg-warn" };
  return { label: t("toneNeedsWork"), pill: "risk", bar: "bg-risk" };
}

export function QualityScreen() {
  const t = useTranslations("farmerQuality");
  const { fields, primary, loading: fieldsLoading } = useFarmerFields();
  const point = useMemo(() => {
    if (primary?.lat == null || primary?.lon == null) return null;
    return { fieldId: primary.id, lat: primary.lat, lon: primary.lon };
  }, [primary]);
  const { top, loading: weatherLoading } = useFieldWeather(point);
  const [data, setData] = useState<ScorePayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (fieldsLoading || !primary || weatherLoading) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/quality/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scanHealth: 0,
            healthyTreeShare: 0,
            sprayCount12m: 0,
            hasBannedSpray: false,
            daysSinceLastRecord: 999,
            proofLevel: primary.proof_level ?? "self_reported",
            peakRiskScore: top?.score ?? 0,
            stage: "start",
          }),
        });
        const json = await res.json();
        if (!cancelled && json.ok) setData(json.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fieldsLoading, primary, weatherLoading, top?.score]);

  const rows = data
    ? [
        { key: "tree", label: t("treeHealth"), value: data.breakdown.tree },
        { key: "spray", label: t("safeSpraying"), value: data.breakdown.spray },
        { key: "harvest", label: t("harvestTiming"), value: data.breakdown.harvest },
        { key: "records", label: t("recordsKept"), value: data.breakdown.records },
      ]
    : [];

  return (
    <div className="w-full flex-1 space-y-4">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {fieldsLoading ? <Skeleton className="h-40 w-full rounded-card" /> : null}

      {!fieldsLoading && fields.length === 0 ? (
        <EmptyState
          title={t("noFieldsTitle")}
          description={t("noFieldsBody")}
          action={
            <Button asChild className="rounded-full">
              <Link href="/farmer/fields">{t("ctaFields")}</Link>
            </Button>
          }
        />
      ) : null}

      {loading ? <Skeleton className="h-48 w-full rounded-card" /> : null}

      {data ? (
        <>
          <ApCard className="p-5">
            <ScoreRing score={data.score} qualityLabel={t("qualityShort")} />
            <p className="mt-3 text-center text-ap-body font-medium text-muted-foreground">
              {primary?.name ? `${primary.name} · ` : null}
              {t("scoreLabel")}
            </p>
          </ApCard>

          <ApCard className="space-y-4 p-4">
            {rows.map((row) => {
              const tone = barTone(row.value, t);
              return (
                <div key={row.key}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-ap-body font-bold text-ink">{row.label}</p>
                    <Pill tone={tone.pill}>{tone.label}</Pill>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-soft">
                    <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, row.value)}%` }} />
                  </div>
                  <p className="mt-1 text-right text-ap-small font-semibold text-muted-foreground">{row.value}</p>
                </div>
              );
            })}
          </ApCard>

          <AIBox title={t("plan")}>
            <ul className="mt-2 space-y-2">
              {(data.plan.length
                ? data.plan
                : [
                    { text: t("planDefault1"), points: 7 },
                    { text: t("planDefault2"), points: 4 },
                    { text: t("planDefault3"), points: 3 },
                  ]
              ).map((item) => (
                <li key={item.text} className="flex items-start gap-2 text-ap-body text-ink">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-line bg-card text-[11px]">
                    ☐
                  </span>
                  <span className="flex-1">{item.text}</span>
                  <span className="font-extrabold text-good">+{item.points}</span>
                </li>
              ))}
            </ul>
          </AIBox>
        </>
      ) : null}
    </div>
  );
}
