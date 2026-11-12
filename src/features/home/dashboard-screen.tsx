"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { CloudSun, ShieldAlert, Sparkles } from "lucide-react";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { useFieldWeather } from "@/features/weather-risk/use-field-weather";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Link } from "@/shared/i18n/navigation";
import { Skeleton } from "@/shared/components/ui/skeleton";

export function DashboardScreen() {
  const t = useTranslations("farmerHome");
  const { fields, primary, loading: fieldsLoading, error: fieldsError } = useFarmerFields();

  const point = useMemo(() => {
    if (primary?.lat == null || primary?.lon == null) return null;
    return { fieldId: primary.id, lat: primary.lat, lon: primary.lon };
  }, [primary]);

  const { weather, top, loading: weatherLoading, error: weatherError } = useFieldWeather(point);

  const loading = fieldsLoading || (point != null && weatherLoading);

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : null}

      {fieldsError ? (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">{fieldsError}</CardContent>
        </Card>
      ) : null}

      {!loading && !fieldsError && fields.length === 0 ? (
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

      {!loading && primary && (primary.lat == null || primary.lon == null) ? (
        <EmptyState
          title={t("noLocationTitle")}
          description={t("noLocationBody")}
          action={
            <Button asChild variant="outline">
              <Link href="/farmer/fields">{t("ctaFields")}</Link>
            </Button>
          }
        />
      ) : null}

      {weatherError ? (
        <Card className="mt-4 border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">{weatherError}</CardContent>
        </Card>
      ) : null}

      {weather ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <CloudSun className="size-4" aria-hidden />
                {t("weather")}
              </CardTitle>
              <div className="flex items-center gap-2">
                {primary?.name ? <Badge variant="outline">{primary.name}</Badge> : null}
                <Badge variant="secondary">{weather.source}</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-2xl font-bold md:text-3xl">{Math.round(weather.current.temp)}°C</p>
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

          <Card className="bg-muted/40 md:col-span-2 xl:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4" aria-hidden />
                {t("next")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row xl:flex-col">
              <Button asChild className="sm:flex-1 xl:flex-none">
                <Link href="/farmer/scan">{t("ctaScan")}</Link>
              </Button>
              <Button asChild variant="outline" className="sm:flex-1 xl:flex-none">
                <Link href="/farmer/fields">{t("ctaFields")}</Link>
              </Button>
              <Button asChild variant="secondary" className="sm:flex-1 xl:flex-none">
                <Link href="/farmer/quality">{t("ctaQuality")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
