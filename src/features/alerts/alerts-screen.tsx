"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Info } from "lucide-react";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { useFieldWeather } from "@/features/weather-risk/use-field-weather";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { FieldChips, ApCard, Pill, AIBox, type PillTone } from "@/shared/components/brand";
import { FIELD_DOTS } from "@/shared/theme/tokens";
import { Button } from "@/shared/components/ui/button";
import { Link } from "@/shared/i18n/navigation";
import { Skeleton } from "@/shared/components/ui/skeleton";

const TABS = ["pests", "weather", "location"] as const;
const PILL: Record<string, PillTone> = { High: "risk", Medium: "warn", Low: "good" };

export function AlertsScreen() {
  const t = useTranslations("farmerAlerts");
  const { fields, loading } = useFarmerFields();
  const [selected, setSelected] = useState<string | "all">("all");
  const [tab, setTab] = useState<(typeof TABS)[number]>("pests");

  const primary =
    (selected === "all" ? fields[0] : fields.find((f) => f.id === selected)) ?? null;
  const point = useMemo(() => {
    if (primary?.lat == null || primary?.lon == null) return null;
    return { fieldId: primary.id, lat: primary.lat, lon: primary.lon };
  }, [primary]);
  const { risk, top, loading: weatherLoading } = useFieldWeather(point);

  const assessments = useMemo(() => {
    if (!risk) return [];
    const all = Object.values(risk).flatMap((days) => days.slice(0, 3));
    return all
      .filter((a) => {
        if (tab === "pests") {
          return ["peacock-spot", "olive-fly", "olive-moth", "olive-knot", "anthracnose"].includes(a.threat);
        }
        if (tab === "weather") {
          return ["frost", "heat", "wind", "drought"].includes(a.threat);
        }
        return a.threat === "location";
      })
      .sort((a, b) => b.score - a.score);
  }, [risk, tab]);

  return (
    <div className="w-full flex-1 space-y-4">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {loading ? <Skeleton className="h-10 w-full rounded-full" /> : null}

      {!loading && fields.length === 0 ? (
        <EmptyState
          title={t("noFields")}
          description={t("noFieldsBody")}
          action={
            <Button asChild className="rounded-full">
              <Link href="/farmer/fields">{t("ctaFields")}</Link>
            </Button>
          }
        />
      ) : null}

      {fields.length > 0 ? (
        <>
          <FieldChips
            fields={fields.map((f, i) => ({ id: f.id, name: f.name, color: FIELD_DOTS[i % FIELD_DOTS.length] }))}
            selected={selected === "all" ? (fields[0]?.id ?? "all") : selected}
            onSelect={(id) => setSelected(id === "all" ? "all" : id)}
            tone="green"
          />

          <div className="flex gap-2">
            {TABS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`h-9 flex-1 rounded-full text-ap-pill font-bold ${
                  tab === key ? "bg-ink text-white" : "border border-line bg-card text-ink"
                }`}
              >
                {t(`tab.${key}`)}
              </button>
            ))}
          </div>

          {weatherLoading ? <Skeleton className="h-28 w-full rounded-card" /> : null}

          {top ? (
            <ApCard className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-ap-small font-bold tracking-wide text-muted-foreground uppercase">
                    {t("topAlert")}
                  </p>
                  <p className="mt-1 text-ap-card capitalize text-ink">{top.threat.replaceAll("-", " ")}</p>
                  <p className="mt-1 text-ap-body text-muted-foreground">{top.drivers[0]}</p>
                </div>
                <Pill tone={PILL[top.level] ?? "neutral"}>{top.level}</Pill>
              </div>
            </ApCard>
          ) : null}

          <div className="space-y-2">
            {assessments.length === 0 && !weatherLoading ? (
              <ApCard className="p-4 text-ap-body text-muted-foreground">{t("emptyTab")}</ApCard>
            ) : null}
            {assessments.slice(0, 8).map((a) => (
              <ApCard key={`${a.threat}-${a.day}`} className="flex items-center gap-3 p-3">
                <Info className="size-4 text-ap-accent" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-ap-body font-extrabold capitalize text-ink">{a.threat.replaceAll("-", " ")}</p>
                  <p className="text-ap-small text-muted-foreground">
                    {a.day} · score {a.score}
                  </p>
                </div>
                <Pill tone={PILL[a.level] ?? "neutral"}>{a.level}</Pill>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </ApCard>
            ))}
          </div>

          <AIBox title={t("aiTitle")}>{t("aiBody")}</AIBox>
        </>
      ) : null}
    </div>
  );
}
