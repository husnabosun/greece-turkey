"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { refreshFieldQuality } from "@/features/quality/refresh-field-quality";
import { useFieldQuality } from "@/features/quality/use-field-quality";
import { useFieldWeather } from "@/features/weather-risk/use-field-weather";
import { EmptyState } from "@/shared/components/empty-state";
import { ApCard, AIBox, FieldChips, Pill } from "@/shared/components/brand";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Link } from "@/shared/i18n/navigation";
import { colors, FIELD_DOTS } from "@/shared/theme/tokens";
import { cn } from "@/shared/lib/utils";

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
  const { fields, loading: fieldsLoading } = useFarmerFields();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    if (!fields.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !fields.some((f) => f.id === selectedId)) {
      setSelectedId(fields[0]!.id);
    }
  }, [fields, selectedId]);

  const field = fields.find((f) => f.id === selectedId) ?? null;
  const point = useMemo(() => {
    if (field?.lat == null || field?.lon == null) return null;
    return { fieldId: field.id, lat: field.lat, lon: field.lon };
  }, [field]);
  const { top } = useFieldWeather(point);
  const { current, previous, loading: scoreLoading, reload } = useFieldQuality(selectedId);

  const chipFields = fields.map((f, i) => ({
    id: f.id,
    name: f.name,
    color: FIELD_DOTS[i % FIELD_DOTS.length],
  }));

  const deltaPct =
    current && previous && previous.score > 0
      ? Math.round(((current.score - previous.score) / previous.score) * 100)
      : null;

  const rows = current
    ? [
        { key: "tree", label: t("treeHealth"), value: current.breakdown.tree },
        { key: "spray", label: t("safeSpraying"), value: current.breakdown.spray },
        { key: "harvest", label: t("harvestTiming"), value: current.breakdown.harvest },
        { key: "records", label: t("recordsKept"), value: current.breakdown.records },
      ]
    : [];

  async function onRefresh() {
    if (!field) return;
    setRefreshing(true);
    try {
      const result = await refreshFieldQuality({
        fieldId: field.id,
        proofLevel: field.proof_level ?? "self_reported",
        peakRiskScore: top?.score ?? 0,
        stage: "growing",
      });
      if (!result.ok) {
        toast.error(t(result.error === "needLogin" || result.error === "needSupabase" ? result.error : "refreshFailed"));
        return;
      }
      toast.success(t("refreshed"));
      await reload();
    } finally {
      setRefreshing(false);
    }
  }

  // No auto-insert on visit (Π4) — user refreshes explicitly via the button.

  return (
    <div className="w-full flex-1 space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/farmer/dashboard"
          aria-label={t("back")}
          className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-[22px] font-extrabold tracking-tight text-ink">{t("title")}</h1>
        <button
          type="button"
          disabled={!field || refreshing}
          onClick={() => void onRefresh()}
          aria-label={t("refresh")}
          className="flex size-10 items-center justify-center rounded-full border border-line bg-card disabled:opacity-50"
        >
          <RefreshCw className={cn("size-[18px]", refreshing && "animate-spin")} aria-hidden />
        </button>
      </div>

      {fieldsLoading ? <Skeleton className="h-9 w-full rounded-full" /> : null}

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

      {!fieldsLoading && fields.length > 0 ? (
        <FieldChips
          fields={chipFields}
          selected={selectedId ?? fields[0]!.id}
          onSelect={(id) => {
            if (id !== "all") setSelectedId(id);
          }}
          tone="black"
        />
      ) : null}

      {scoreLoading || refreshing ? <Skeleton className="h-48 w-full rounded-card" /> : null}

      {!scoreLoading && !refreshing && current ? (
        <>
          <ApCard className="p-5">
            <ScoreRing score={current.score} qualityLabel={t("qualityShort")} />
            <p className="mt-3 text-center text-ap-body font-medium text-muted-foreground">
              {field?.name ? `${field.name} · ` : null}
              {t("buyersSee")}
            </p>
          </ApCard>

          {deltaPct != null && deltaPct !== 0 ? (
            <div
              className={cn(
                "rounded-[18px] border p-3",
                deltaPct < 0 ? "border-risk/30 bg-risk-soft" : "border-good/30 bg-good-soft",
              )}
            >
              <p className={cn("text-ap-body font-extrabold", deltaPct < 0 ? "text-risk" : "text-good")}>
                {t(deltaPct < 0 ? "deltaLower" : "deltaHigher", { n: Math.abs(deltaPct) })}
              </p>
              <p className="mt-0.5 text-ap-small text-muted-foreground">
                {deltaPct < 0 ? t("deltaReasonDown") : t("deltaReasonUp")}
              </p>
            </div>
          ) : null}

          <ApCard className="space-y-4 p-4">
            <p className="text-ap-card font-extrabold text-ink">{t("breakdown")}</p>
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

          <p className="text-center text-ap-small text-muted-foreground">{t("feedbackHint")}</p>

          <AIBox title={t("plan")}>
            <ul className="mt-2 space-y-2">
              {(current.plan.length
                ? current.plan
                : [
                    { text: t("planDefault1"), points: 7 },
                    { text: t("planDefault2"), points: 4 },
                    { text: t("planDefault3"), points: 3 },
                  ]
              ).map((item, i) => {
                const planKeys = new Set([
                  "planBanned",
                  "planRecords",
                  "planRisk",
                  "planTrees",
                  "planKeep",
                  "planDefault1",
                  "planDefault2",
                  "planDefault3",
                ]);
                const label = planKeys.has(item.text) ? t(item.text as "planBanned") : item.text;
                return (
                <li key={`${item.text}-${i}`} className="flex items-start gap-2 text-ap-body text-ink">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-line bg-card text-[11px] font-bold">
                    {i + 1}
                  </span>
                  <span className="flex-1">{label}</span>
                  <span className="font-extrabold text-good">+{item.points}</span>
                </li>
                );
              })}
            </ul>
          </AIBox>
        </>
      ) : null}

      {!scoreLoading && !refreshing && field && !current ? (
        <EmptyState title={t("noScoreTitle")} description={t("noScoreBody")} />
      ) : null}
    </div>
  );
}
