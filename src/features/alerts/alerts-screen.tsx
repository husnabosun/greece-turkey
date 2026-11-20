"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, Info } from "lucide-react";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { riskLevelLabel, threatLabel, threatTip } from "@/features/weather-risk/threat-labels";
import { LEVEL_RANK, type RiskLevel } from "@/features/weather-risk/risk/types";
import { useFieldWeather } from "@/features/weather-risk/use-field-weather";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { FieldChips, ApCard, Pill, type PillTone } from "@/shared/components/brand";
import { FIELD_DOTS } from "@/shared/theme/tokens";
import { Button } from "@/shared/components/ui/button";
import { Link } from "@/shared/i18n/navigation";
import { Skeleton } from "@/shared/components/ui/skeleton";

const TABS = ["pests", "weather", "location"] as const;
const PILL: Record<string, PillTone> = { High: "risk", Medium: "warn", Low: "good" };

type GroupedThreat = {
  threat: string;
  level: RiskLevel;
  score: number;
  days: string[];
};

export function AlertsScreen() {
  const t = useTranslations("farmerAlerts");
  const tThreats = useTranslations("riskThreats");
  const locale = useLocale();
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

  const groups = useMemo(() => {
    if (!risk) return [] as GroupedThreat[];
    const all = Object.values(risk).flatMap((days) => days.slice(0, 3));
    const filtered = all.filter((a) => {
      if (tab === "pests") {
        return ["peacock-spot", "olive-fly", "olive-moth", "olive-knot", "anthracnose"].includes(a.threat);
      }
      if (tab === "weather") {
        return ["frost", "heat", "wind", "drought"].includes(a.threat);
      }
      return a.threat === "location";
    });

    const map = new Map<string, GroupedThreat>();
    for (const a of filtered) {
      const cur = map.get(a.threat);
      if (!cur) {
        map.set(a.threat, {
          threat: a.threat,
          level: a.level,
          score: a.score,
          days: [a.day],
        });
        continue;
      }
      cur.days.push(a.day);
      if (LEVEL_RANK[a.level] > LEVEL_RANK[cur.level] || a.score > cur.score) {
        cur.level = a.level;
        cur.score = a.score;
      }
    }
    return [...map.values()].sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || b.score - a.score);
  }, [risk, tab]);

  function formatDayRange(days: string[]) {
    const unique = [...new Set(days)].sort();
    if (unique.length === 0) return "";
    const fmt = (iso: string) => {
      try {
        return new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
          weekday: "short",
          day: "numeric",
          month: "numeric",
        });
      } catch {
        return iso;
      }
    };
    if (unique.length === 1) return fmt(unique[0]!);
    return `${fmt(unique[0]!)}–${fmt(unique[unique.length - 1]!)}`;
  }

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
                className={`h-11 flex-1 rounded-full text-ap-pill font-bold ${
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
                  <p className="text-ap-small font-semibold text-muted-foreground">{t("topAlert")}</p>
                  <p className="mt-1 text-ap-card text-ink">{threatLabel(top.threat, tThreats)}</p>
                  <p className="mt-1 text-ap-body text-muted-foreground">
                    {threatTip(top.threat, tThreats) || riskLevelLabel(top.level, tThreats)}
                  </p>
                </div>
                <Pill tone={PILL[top.level] ?? "neutral"}>{riskLevelLabel(top.level, tThreats)}</Pill>
              </div>
            </ApCard>
          ) : null}

          <div className="space-y-2">
            {groups.length === 0 && !weatherLoading ? (
              <ApCard className="p-4 text-ap-body text-muted-foreground">{t("emptyTab")}</ApCard>
            ) : null}
            {groups.map((g) => (
              <ApCard key={g.threat} className="flex min-h-14 items-center gap-3 p-3">
                <Info className="size-4 shrink-0 text-ap-accent" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-ap-body font-extrabold text-ink">{threatLabel(g.threat, tThreats)}</p>
                  <p className="text-ap-small text-muted-foreground">
                    {riskLevelLabel(g.level, tThreats)} · {formatDayRange(g.days)}
                  </p>
                  <div className="mt-1.5 flex gap-1">
                    {g.days.slice(0, 3).map((d) => {
                      const day = Object.values(risk ?? {})
                        .flat()
                        .find((a) => a.threat === g.threat && a.day === d);
                      const h = day ? Math.min(100, Math.max(12, day.score)) : 20;
                      return (
                        <span
                          key={d}
                          title={d}
                          className="inline-block w-2 rounded-sm bg-ink/25"
                          style={{ height: `${Math.round(h * 0.22)}px` }}
                          aria-hidden
                        />
                      );
                    })}
                  </div>
                </div>
                <Pill tone={PILL[g.level] ?? "neutral"}>{riskLevelLabel(g.level, tThreats)}</Pill>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </ApCard>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
