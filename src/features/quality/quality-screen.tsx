"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { useFieldWeather } from "@/features/weather-risk/use-field-weather";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Link } from "@/shared/i18n/navigation";

type ScorePayload = {
  score: number;
  breakdown: { tree: number; spray: number; harvest: number; records: number };
  plan: { text: string; points: number }[];
  engineVersion: string;
};

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
            // Real inputs only — zeros until scans/logbook exist for this field.
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

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {fieldsLoading ? <Skeleton className="h-40 w-full rounded-xl" /> : null}

      {!fieldsLoading && fields.length === 0 ? (
        <EmptyState
          title={t("noFieldsTitle")}
          description={t("noFieldsBody")}
          action={
            <Button asChild>
              <Link href="/farmer/fields">{t("ctaFields")}</Link>
            </Button>
          }
        />
      ) : null}

      {loading ? <Skeleton className="h-40 w-full rounded-xl" /> : null}

      {data ? (
        <>
          <Card>
            <CardContent className="flex items-end justify-between pt-6">
              <div>
                <p className="text-sm text-muted-foreground">{t("scoreLabel")}</p>
                <p className="text-5xl font-extrabold tabular-nums">{data.score}</p>
              </div>
              <p className="text-xs text-muted-foreground">{data.engineVersion}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {Object.entries(data.breakdown).map(([key, value]) => (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm capitalize">{key}</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold tabular-nums">{value}</CardContent>
              </Card>
            ))}
          </div>

          {data.plan.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("plan")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.plan.map((item) => (
                  <p key={item.text}>
                    +{item.points} · {item.text}
                  </p>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
