"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bug, CloudSun, MapPin, MapPinOff, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { riskLevelLabel, threatLabel, threatTip } from "@/features/weather-risk/threat-labels";
import { LEVEL_RANK, type RiskLevel } from "@/features/weather-risk/risk/types";
import { useFieldSignals } from "@/features/weather-risk/use-field-signals";
import { useFieldWeather } from "@/features/weather-risk/use-field-weather";
import { FieldChips, ApCard, Pill, type PillTone } from "@/shared/components/brand";
import { FIELD_DOTS } from "@/shared/theme/tokens";
import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";

const TABS = ["pests", "weather", "location"] as const;
const PILL: Record<string, PillTone> = { High: "risk", Medium: "warn", Low: "good" };
const TONE_BOX: Record<PillTone, string> = {
  risk: "bg-risk-soft text-risk",
  warn: "bg-warn-soft text-warn-text",
  good: "bg-good-soft text-good",
  accent: "bg-ap-accent-soft text-ap-accent",
  neutral: "bg-soft text-ink",
};
const TONE_BAR: Record<PillTone, string> = {
  risk: "bg-risk",
  warn: "bg-warn",
  good: "bg-good",
  accent: "bg-ap-accent",
  neutral: "bg-ink/25",
};
const TAB_ICON: Record<(typeof TABS)[number], LucideIcon> = { pests: Bug, weather: CloudSun, location: MapPin };

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
  const { signalsFor } = useFieldSignals(fields);
  const { risk, top, loading: weatherLoading } = useFieldWeather(point, primary ? signalsFor(primary.id) : undefined);
  const noLocation = primary != null && point == null;

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
    <div className="w-full flex-1 space-y-3">
      <div>
        <h1 className="text-[20px] font-extrabold tracking-tight text-ink">{t("title")}</h1>
        <p className="text-ap-small text-muted-foreground">{t("subtitle")}</p>
      </div>

      {loading ? <div className="h-11 w-full animate-pulse rounded-full bg-soft" aria-hidden /> : null}

      {!loading && fields.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-soft">
            <MapPin className="size-6 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-3 text-ap-body font-semibold text-ink">{t("noFields")}</p>
          <p className="mt-1 text-ap-small text-muted-foreground">{t("noFieldsBody")}</p>
          <Link
            href="/farmer/fields"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-ap-btn text-white hover:bg-ink/90"
          >
            {t("ctaFields")}
          </Link>
        </div>
      ) : null}

      {fields.length > 0 ? (
        <>
          <FieldChips
            fields={fields.map((f, i) => ({ id: f.id, name: f.name, color: FIELD_DOTS[i % FIELD_DOTS.length] }))}
            selected={selected === "all" ? (fields[0]?.id ?? "all") : selected}
            onSelect={(id) => setSelected(id === "all" ? "all" : id)}
            tone="green"
          />

          {noLocation ? (
            <ApCard className="flex items-start gap-3 border-warn/40 bg-warn-soft p-3">
              <MapPinOff className="mt-0.5 size-5 shrink-0 text-warn-text" aria-hidden />
              <p className="text-ap-body font-semibold text-warn-text">{t("noLocation")}</p>
            </ApCard>
          ) : null}

          {weatherLoading ? <div className="h-28 w-full animate-pulse rounded-card bg-soft" aria-hidden /> : null}

          {top ? (
            <ApCard
              className={cn(
                "p-4",
                PILL[top.level] === "risk" && "border-risk/35 bg-risk-soft/45",
                PILL[top.level] === "warn" && "border-warn/40 bg-warn-soft/50",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full",
                    TONE_BOX[PILL[top.level] ?? "neutral"],
                  )}
                >
                  {PILL[top.level] === "good" ? (
                    <ShieldCheck className="size-5" aria-hidden />
                  ) : (
                    <TriangleAlert className="size-5" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-ap-small font-bold tracking-wide text-muted-foreground uppercase">{t("topAlert")}</p>
                    <Pill tone={PILL[top.level] ?? "neutral"}>{riskLevelLabel(top.level, tThreats)}</Pill>
                  </div>
                  <p className="mt-0.5 text-[17px] font-extrabold tracking-tight text-ink">{threatLabel(top.threat, tThreats)}</p>
                  <p className="mt-1 text-ap-body text-muted-foreground">
                    {threatTip(top.threat, tThreats) || riskLevelLabel(top.level, tThreats)}
                  </p>
                </div>
              </div>
            </ApCard>
          ) : null}

          <div className="flex gap-2" role="tablist">
            {TABS.map((key) => {
              const Icon = TAB_ICON[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border px-2 text-ap-pill font-bold transition-colors",
                    tab === key ? "border-ink bg-ink text-white" : "border-line bg-card text-ink",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{t(`tab.${key}`)}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            {groups.length === 0 && !weatherLoading && !noLocation ? (
              <ApCard className="flex items-center gap-3 p-4">
                <ShieldCheck className="size-5 shrink-0 text-good" aria-hidden />
                <p className="text-ap-body font-semibold text-muted-foreground">{t("emptyTab")}</p>
              </ApCard>
            ) : null}
            {groups.map((g) => {
              const tone = PILL[g.level] ?? "neutral";
              const Icon = TAB_ICON[tab];
              return (
              <ApCard key={g.threat} className="flex min-h-14 items-center gap-3 rounded-2xl px-3 py-3">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", TONE_BOX[tone])}>
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-ap-body font-extrabold text-ink">{threatLabel(g.threat, tThreats)}</p>
                  <p className="text-ap-small text-muted-foreground">{formatDayRange(g.days)}</p>
                </div>
                <div className="flex h-6 shrink-0 items-end gap-1" aria-hidden>
                    {g.days.slice(0, 3).map((d) => {
                      const day = Object.values(risk ?? {})
                        .flat()
                        .find((a) => a.threat === g.threat && a.day === d);
                      const h = day ? Math.min(100, Math.max(12, day.score)) : 20;
                      return (
                        <span
                          key={d}
                          title={d}
                          className={cn("inline-block w-1.5 rounded-sm", TONE_BAR[tone])}
                          style={{ height: `${Math.round(h * 0.24)}px` }}
                        />
                      );
                    })}
                </div>
                <Pill tone={tone}>{riskLevelLabel(g.level, tThreats)}</Pill>
              </ApCard>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
