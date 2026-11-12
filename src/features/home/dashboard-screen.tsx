"use client";

import { useTranslations } from "next-intl";
import { CloudSun, ShieldAlert, Sparkles } from "lucide-react";
import { useFieldWeather } from "@/features/weather-risk/use-field-weather";
import { PageHeader } from "@/shared/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Link } from "@/shared/i18n/navigation";
import { Skeleton } from "@/shared/components/ui/skeleton";

export function DashboardScreen() {
  const t = useTranslations("farmerHome");
  const { weather, top, loading, error } = useFieldWeather();

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : null}

      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {weather ? (
        <div className="space-y-3">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <CloudSun className="size-4" aria-hidden />
                {t("weather")}
              </CardTitle>
              <Badge variant="secondary">{weather.source}</Badge>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-2xl font-bold">{Math.round(weather.current.temp)}°C</p>
              <p className="text-muted-foreground">
                {weather.current.label} · RH {Math.round(weather.current.rh)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="size-4" aria-hidden />
                {t("risk")}
              </CardTitle>
              {top ? <Badge>{top.level}</Badge> : null}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {top ? (
                <>
                  <p className="font-medium capitalize">{top.threat.replaceAll("-", " ")}</p>
                  <p className="text-muted-foreground">{top.drivers[0]}</p>
                  <p className="text-xs text-muted-foreground">{t("score", { n: top.score })}</p>
                </>
              ) : (
                <p className="text-muted-foreground">{t("noRisk")}</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-muted/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4" aria-hidden />
                {t("next")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild>
                <Link href="/farmer/scan">{t("ctaScan")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/farmer/fields">{t("ctaFields")}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/farmer/quality">{t("ctaQuality")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
