"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useFieldWeather } from "@/features/weather-risk/use-field-weather";
import { PageHeader } from "@/shared/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

type ScorePayload = {
  score: number;
  breakdown: { tree: number; spray: number; harvest: number; records: number };
  plan: { text: string; points: number }[];
  engineVersion: string;
};

export function QualityScreen() {
  const t = useTranslations("farmerQuality");
  const { top, loading: weatherLoading } = useFieldWeather();
  const [data, setData] = useState<ScorePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (weatherLoading) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/quality/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scanHealth: 82,
            healthyTreeShare: 0.9,
            sprayCount12m: 2,
            hasBannedSpray: false,
            daysSinceLastRecord: 7,
            proofLevel: "evidence_based",
            peakRiskScore: top?.score ?? 30,
            stage: "almost",
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
  }, [weatherLoading, top?.score]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("subtitle")} />

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

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data.breakdown).map(([key, value]) => (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm capitalize">{key}</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold tabular-nums">{value}</CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("plan")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.plan.map((item) => (
                <div key={item.text} className="rounded-lg border px-3 py-2 text-sm">
                  <p>{item.text}</p>
                  <p className="text-xs text-muted-foreground">+{item.points} pts</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
