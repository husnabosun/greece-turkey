"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Bell,
  Camera,
  Cloud,
  CloudRain,
  Droplet,
  Globe,
  Leaf,
  MapPin,
  Plus,
  Settings,
  Sun,
  Tag,
  Trees,
  TriangleAlert,
} from "lucide-react";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { THREAT_BY_ID } from "@/features/weather-risk/risk";
import { useFieldWeather } from "@/features/weather-risk/use-field-weather";
import { LOCALES, type Locale } from "@/core/config/constants";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { ApButton, ApCard, FieldChips, Pill, SectionHeader } from "@/shared/components/brand";
import { FIELD_DOTS, colors } from "@/shared/theme/tokens";
import { Link, usePathname, useRouter } from "@/shared/i18n/navigation";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

const TONE = {
  High: {
    card: "bg-risk-soft",
    kicker: "text-risk",
    iconBg: "bg-[#F6CFC2]",
    iconColor: colors.risk,
    btn: "risk" as const,
  },
  Medium: {
    card: "bg-warn-soft",
    kicker: "text-warn-text",
    iconBg: "bg-[#EEDDA8]",
    iconColor: colors.warnText,
    btn: "dark" as const,
  },
  Low: {
    card: "bg-soft",
    kicker: "text-muted-foreground",
    iconBg: "bg-card",
    iconColor: colors.muted,
    btn: "dark" as const,
  },
};

function greeting(locale: string) {
  const h = new Date().getHours();
  if (locale.startsWith("el")) {
    if (h < 12) return "Καλημέρα";
    if (h < 18) return "Καλό απόγευμα";
    return "Καλησπέρα";
  }
  if (locale.startsWith("tr")) {
    if (h < 12) return "Günaydın";
    if (h < 18) return "İyi günler";
    return "İyi akşamlar";
  }
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardScreen() {
  const t = useTranslations("farmerHome");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { fields, loading: fieldsLoading, error: fieldsError } = useFarmerFields();
  const [selected, setSelected] = useState<string | "all">("all");
  const [displayName, setDisplayName] = useState("");
  const [place, setPlace] = useState("");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) return;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, place")
        .eq("id", user.id)
        .maybeSingle();
      const meta = user.user_metadata;
      setDisplayName(
        String(profile?.display_name ?? meta?.display_name ?? user.email?.split("@")[0] ?? ""),
      );
      setPlace(String(profile?.place ?? ""));
    })();
  }, []);

  const shown = useMemo(() => {
    if (selected === "all") return fields;
    return fields.filter((f) => f.id === selected);
  }, [fields, selected]);

  const primary = shown.find((f) => f.lat != null && f.lon != null) ?? shown[0] ?? null;
  const point = useMemo(() => {
    if (primary?.lat == null || primary?.lon == null) return null;
    return { fieldId: primary.id, lat: primary.lat, lon: primary.lon };
  }, [primary]);

  const { weather, risk, top, loading: weatherLoading } = useFieldWeather(point);
  const loading = fieldsLoading || (point != null && weatherLoading);

  const elevated = top && top.level !== "Low" ? top : null;
  const level = elevated?.level ?? "Low";
  const tone = TONE[level];
  const threat = elevated ? THREAT_BY_ID[elevated.threat] : null;
  const riskCount = useMemo(() => {
    if (!risk) return 0;
    return Object.values(risk).filter((days) => days.slice(0, 3).some((a) => a.level !== "Low")).length;
  }, [risk]);

  const WeatherIcon =
    weather?.current.icon === "rain" || weather?.current.icon === "storm"
      ? CloudRain
      : weather?.current.icon === "cloudy"
        ? Cloud
        : Sun;
  const CardIcon = threat?.group === "weather" ? CloudRain : threat?.group === "location" ? MapPin : Leaf;
  const tomorrow = weather ? weather.days[weather.todayIndex + 1] : undefined;
  const rainText = !weather
    ? t("noWeatherYet")
    : tomorrow && tomorrow.rain >= 1
      ? t("rainTomorrow")
      : t("noRainTomorrow");

  const chipFields = fields.map((f, i) => ({
    id: f.id,
    name: f.name,
    color: FIELD_DOTS[i % FIELD_DOTS.length],
  }));

  const location = place || primary?.name || t("noPlace");

  return (
    <div className="w-full flex-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-ap-title text-ink">
            {greeting(locale)},
            <br />
            {displayName || t("farmerFallback")}
          </h1>
          <p className="mt-1 flex items-center gap-1 text-ap-body font-medium text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden />
            {location}
          </p>
        </div>
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            aria-label={t("settings")}
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
            className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
          >
            <Settings className="size-[18px]" aria-hidden />
          </button>
          <Link
            href="/farmer/tasks"
            className="relative flex size-10 items-center justify-center rounded-full border border-line bg-card"
            aria-label={t("tasks")}
          >
            <Bell className="size-[18px] text-good" aria-hidden />
            <i className="absolute top-2.5 right-2.5 size-2 rounded-full bg-[#E5473A]" />
          </Link>
          {menu ? (
            <div className="absolute top-12 right-0 z-20 w-[230px] rounded-2xl border border-line bg-card p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
              <Link
                href="/farmer/fields/new"
                onClick={() => setMenu(false)}
                className="flex h-11 items-center gap-2.5 rounded-xl px-2.5 text-ap-body font-semibold text-ink"
              >
                <Plus className="size-[18px]" aria-hidden />
                {t("addField")}
              </Link>
              <div className="px-2.5 pt-1 pb-1.5">
                <p className="mb-1.5 flex items-center gap-2 text-ap-body font-semibold text-ink">
                  <Globe className="size-4" aria-hidden />
                  {t("advisorLanguage")}
                </p>
                <div className="flex gap-1.5">
                  {LOCALES.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        router.replace(pathname, { locale: code as Locale });
                        setMenu(false);
                      }}
                      className={cn(
                        "h-9 flex-1 rounded-full border text-ap-pill font-bold uppercase",
                        locale === code ? "border-ink bg-ink text-white" : "border-line bg-card text-ink",
                      )}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {fieldsError ? <p className="mt-4 text-sm text-risk">{fieldsError}</p> : null}

      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-9 w-full rounded-full" />
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-[22px]" />
        </div>
      ) : (
        <>
          {fields.length > 0 ? (
            <div className="mt-4">
              <FieldChips
                fields={chipFields}
                selected={selected}
                onSelect={setSelected}
                showAll
                allLabel={t("allFields", { n: fields.length })}
                tone="green"
              />
            </div>
          ) : null}

          <div className="mt-3.5 flex h-11 items-center gap-2 rounded-2xl border border-line bg-card px-3 text-ap-body font-semibold">
            <WeatherIcon className="size-[18px] shrink-0 text-warn" aria-hidden />
            <span>{weather ? `${Math.round(weather.current.temp)}°C` : "—"}</span>
            <span className="truncate font-medium text-muted-foreground">{weather?.current.label ?? ""}</span>
            <span className="mx-1 h-5 w-px shrink-0 bg-line" />
            <Droplet className="size-4 shrink-0 text-ap-accent" aria-hidden />
            <span className="truncate font-medium text-muted-foreground">{rainText}</span>
          </div>

          <div className={cn("relative mt-3.5 rounded-[22px] p-4", tone.card)}>
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-white px-2.5 py-1 text-[12px] font-bold text-ink">
              <MapPin className="size-3" style={{ color: tone.iconColor }} aria-hidden />
              {primary?.name ?? "—"}
              {primary?.tree_count != null ? ` · ${primary.tree_count}` : ""}
            </div>
            <p className={cn("mt-3 text-[11.5px] font-bold tracking-[1.4px] uppercase", tone.kicker)}>
              {t("fieldCheck")}
            </p>
            <h2 className="mt-1.5 max-w-[240px] text-[23px] leading-tight font-extrabold tracking-tight text-ink">
              {elevated && threat
                ? t("riskIs", {
                    threat: threat.name,
                    level: elevated.level === "High" ? t("levelHigh") : t("levelMedium"),
                  })
                : weather
                  ? t("noBigRisks")
                  : t("noWeatherYet")}
            </h2>
            <p className="mt-1.5 max-w-[260px] text-ap-body text-[#5a5a5a]">
              {elevated?.actions?.[0] ||
                elevated?.drivers?.[0] ||
                (weather ? t("keepChecks") : fields.length === 0 ? t("noFieldsBody") : t("noLocationBody"))}
            </p>
            <div
              className={cn(
                "absolute top-14 right-4 flex size-12 items-center justify-center rounded-full",
                tone.iconBg,
              )}
            >
              <CardIcon className="size-5" style={{ color: tone.iconColor }} aria-hidden />
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <ApButton
                label={t("ctaScan")}
                variant={tone.btn}
                icon={<Camera className="size-4" aria-hidden />}
                onClick={() => router.push("/farmer/scan")}
              />
              <Link href="/farmer/tasks" className={cn("text-ap-small font-semibold", tone.kicker)}>
                {t("tasksRatio", { done: 0, total: 0 })}
              </Link>
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <QuickPill href="/farmer/alerts" tone="risk" label={t("risksCount", { n: riskCount })}>
              <TriangleAlert className="size-4" aria-hidden />
            </QuickPill>
            <QuickPill href="/farmer/tasks" tone="warn" label={t("recheckCount", { n: 0 })}>
              <Leaf className="size-4" aria-hidden />
            </QuickPill>
            <QuickPill href="/farmer/market?tab=offers" tone="good" label={t("offersCount", { n: 0 })}>
              <Tag className="size-4" aria-hidden />
            </QuickPill>
          </div>

          <SectionHeader
            title={t("yourFields")}
            action={
              <Link href="/farmer/fields" className="text-ap-body font-medium text-muted-foreground">
                {t("seeAll")}
              </Link>
            }
          />
          {fields.length === 0 ? (
            <p className="mt-2 text-ap-body text-muted-foreground">{t("noFieldsBody")}</p>
          ) : (
            <div className="mt-2.5 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {shown.map((f) => {
                const live = elevated && primary?.id === f.id ? elevated : null;
                const liveThreat = live ? THREAT_BY_ID[live.threat] : null;
                return (
                  <Link key={f.id} href="/farmer/fields" className="w-[236px] shrink-0">
                    <ApCard className="p-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-good-soft">
                          <Trees className="size-5 text-good" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-ap-card text-ink">{f.name}</p>
                          <p className="text-ap-small text-muted-foreground">
                            {f.tree_count != null ? `${f.tree_count}` : "—"}
                            {f.area_ha != null ? ` · ${Number(f.area_ha).toFixed(1)} ha` : ""}
                          </p>
                        </div>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-soft text-ap-body font-extrabold text-muted-foreground">
                          —
                        </span>
                      </div>
                      {live && liveThreat ? (
                        <div className="mt-2 flex h-6 items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: live.level === "High" ? colors.risk : colors.warn }}
                          />
                          <span className="flex-1 truncate text-ap-body font-semibold text-ink">{liveThreat.name}</span>
                          <Pill tone={live.level === "High" ? "risk" : "warn"}>{live.level}</Pill>
                        </div>
                      ) : null}
                    </ApCard>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuickPill({
  href,
  tone,
  label,
  children,
}: {
  href: "/farmer/alerts" | "/farmer/tasks" | "/farmer/market?tab=offers";
  tone: "risk" | "warn" | "good";
  label: string;
  children: React.ReactNode;
}) {
  const style = {
    risk: "border-[#E9B5A6] text-risk",
    warn: "border-[#E3CF95] text-warn-text",
    good: "border-[#A9BE9C] text-good",
  }[tone];
  return (
    <Link
      href={href}
      className={cn(
        "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] bg-card text-ap-pill font-bold",
        style,
      )}
    >
      {children}
      {label}
    </Link>
  );
}
