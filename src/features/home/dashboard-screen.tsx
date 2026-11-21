"use client";

import { useErrorMessage } from "@/shared/lib/error-message";
import { localizeTip } from "@/features/weather-risk/tip-i18n";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { formatStremmata } from "@/features/fields/area";
import { reverseGeocodePlace } from "@/features/fields/reverse-geocode";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { scanCameraHref, scanCameraHrefForTask } from "@/features/diagnostics/open-scan-camera";
import { AddTaskForm } from "@/features/tasks/add-task-form";
import { TaskCard } from "@/features/tasks/task-card";
import { completeTask, dismissTask, useFarmerTasks } from "@/features/tasks/use-farmer-tasks";
import { LEVEL_RANK, THREAT_BY_ID, type ThreatId } from "@/features/weather-risk/risk";
import { riskLevelLabel, threatLabel, threatTip } from "@/features/weather-risk/threat-labels";
import { useFieldRiskColors } from "@/features/weather-risk/use-field-risk-colors";
import { useFieldWeather } from "@/features/weather-risk/use-field-weather";
import { LOCALES, type Locale } from "@/core/config/constants";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { ApButton, ApCard, FieldChips, Pill, SectionHeader } from "@/shared/components/brand";
import { colors } from "@/shared/theme/tokens";
import { Link, usePathname, useRouter } from "@/shared/i18n/navigation";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

/** Scan mode for "Take a photo" CTA (demo parity). */
const SCAN_MODE: Partial<Record<ThreatId, "leaf" | "fruit" | "trap">> = {
  "peacock-spot": "leaf",
  "olive-moth": "leaf",
  "olive-knot": "leaf",
  "olive-fly": "trap",
  anthracnose: "fruit",
};

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
    card: "bg-good-soft",
    kicker: "text-good",
    iconBg: "bg-[#CFE3C4]",
    iconColor: colors.good,
    btn: "dark" as const,
  },
};

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return "greetingMorning" as const;
  if (h < 18) return "greetingAfternoon" as const;
  return "greetingEvening" as const;
}

function weatherLabelKey(label: string) {
  switch (label) {
    case "storm":
      return "weatherStorm" as const;
    case "snow":
      return "weatherSnow" as const;
    case "rain":
      return "weatherRain" as const;
    case "sunny":
      return "weatherSunny" as const;
    default:
      return "weatherCloudy" as const;
  }
}

export function DashboardScreen() {
  const t = useTranslations("farmerHome");
  const tTasks = useTranslations("farmerTasks");
  const errMsg = useErrorMessage();
  const tThreats = useTranslations("riskThreats");
  const tFields = useTranslations("farmerFields");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { fields, loading: fieldsLoading, error: fieldsError } = useFarmerFields();
  const {
    tasks,
    loading: tasksLoading,
    reload: reloadTasks,
    markLocalDone,
    removeLocal,
    prependLocal,
  } = useFarmerTasks();
  const [selected, setSelected] = useState<string | "all">("all");
  const [displayName, setDisplayName] = useState("");
  const [profilePlace, setProfilePlace] = useState("");
  const [fieldPlace, setFieldPlace] = useState<string | null>(null);
  const [recheckCount, setRecheckCount] = useState(0);
  const [offerCount, setOfferCount] = useState(0);
  const [fieldScores, setFieldScores] = useState<Record<string, number>>({});
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [greeting, setGreeting] = useState<"greetingMorning" | "greetingAfternoon" | "greetingEvening">(
    "greetingAfternoon",
  );

  useEffect(() => {
    setGreeting(greetingKey());
  }, []);

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) return;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, place, country")
        .eq("id", user.id)
        .maybeSingle();
      const meta = user.user_metadata as { display_name?: string } | undefined;
      const name =
        (typeof profile?.display_name === "string" ? profile.display_name : "").trim() ||
        (typeof meta?.display_name === "string" ? meta.display_name : "").trim() ||
        user.email?.split("@")[0]?.trim() ||
        "";
      setDisplayName(name);
      setProfilePlace((typeof profile?.place === "string" ? profile.place : "").trim());

      let onboardingDone = false;
      try {
        const raw = localStorage.getItem("ap_notify_prefs");
        if (raw) {
          const parsed = JSON.parse(raw) as { onboardingDone?: boolean };
          onboardingDone = Boolean(parsed.onboardingDone);
        }
      } catch {
        /* ignore */
      }
      const hasCountry = profile?.country === "GR" || profile?.country === "TR";
      if (!hasCountry && !onboardingDone) {
        router.replace("/farmer/welcome");
      }
    })();
  }, [router]);

  /** Greeting location uses the first field with coords (not chip selection). */
  const greetingField = useMemo(
    () => fields.find((f) => f.lat != null && f.lon != null) ?? null,
    [fields],
  );

  useEffect(() => {
    if (!greetingField || greetingField.lat == null || greetingField.lon == null) {
      setFieldPlace(null);
      return;
    }
    let cancelled = false;
    const { lat, lon } = greetingField;
    void (async () => {
      const label = await reverseGeocodePlace(lat, lon, locale);
      if (!cancelled) setFieldPlace(label);
    })();
    return () => {
      cancelled = true;
    };
  }, [greetingField, locale]);

  /** Config/auth errors → toast (or console in dev), never a red banner on Home. */
  useEffect(() => {
    if (!fieldsError) return;
    const msg =
      fieldsError === "needSupabase" || fieldsError === "needLogin"
        ? tFields(fieldsError)
        : fieldsError;
    toast.error(msg);
    if (process.env.NODE_ENV === "development") {
      console.warn("[farmerHome] fields load:", fieldsError);
    }
  }, [fieldsError, tFields]);

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      setRecheckCount(0);
      setOfferCount(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const fieldIds = fields.map((f) => f.id);
      const [offersRes, treesRes, scansRes, scoresRes] = await Promise.all([
        supabase
          .from("offers")
          .select("id, status")
          .eq("farmer_id", user.id)
          .eq("status", "pending"),
        fieldIds.length
          ? supabase
              .from("field_trees")
              .select("id, status, field_id")
              .in("field_id", fieldIds)
              .in("status", ["diseased", "suspicious"])
          : Promise.resolve({ data: [] as { id: string }[] }),
        fieldIds.length
          ? supabase
              .from("scans")
              .select("id, diagnosis, confidence, title")
              .eq("farmer_id", user.id)
              .in("field_id", fieldIds)
              .order("captured_at", { ascending: false })
              .limit(40)
          : Promise.resolve({
              data: [] as { id: string; diagnosis?: string | null; confidence?: number | null; title?: string | null }[],
            }),
        fieldIds.length
          ? supabase
              .from("quality_scores")
              .select("field_id, score, computed_at")
              .in("field_id", fieldIds)
              .order("computed_at", { ascending: false })
          : Promise.resolve({ data: [] as { field_id: string; score: number }[] }),
      ]);
      if (cancelled) return;

      const taskRechecks = tasks.filter((row) => row.kind === "recheck" && !row.done).length;
      const treeRechecks = treesRes.data?.length ?? 0;
      const scanRechecks = (scansRes.data ?? []).filter((s) => {
        const dx = `${s.diagnosis ?? ""} ${s.title ?? ""}`.toLowerCase();
        const risky =
          dx.includes("high") ||
          dx.includes("risk") ||
          dx.includes("peacock") ||
          dx.includes("fly") ||
          dx.includes("κυκλοκ") ||
          dx.includes("δάκ");
        const lowConf = s.confidence != null && s.confidence < 0.7;
        return risky || lowConf;
      }).length;
      setRecheckCount(Math.max(taskRechecks, treeRechecks, scanRechecks));
      setOfferCount(offersRes.data?.length ?? 0);

      const scores: Record<string, number> = {};
      for (const row of scoresRes.data ?? []) {
        if (scores[row.field_id] == null) scores[row.field_id] = row.score;
      }
      setFieldScores(scores);
    })();
    return () => {
      cancelled = true;
    };
  }, [fields, tasks]);

  const shown = useMemo(() => {
    if (selected === "all") return fields;
    return fields.filter((f) => f.id === selected);
  }, [fields, selected]);

  const taskStats = useMemo(
    () => ({
      done: tasks.filter((row) => row.done).length,
      total: tasks.length,
    }),
    [tasks],
  );

  const openTasks = useMemo(() => {
    const open = tasks.filter((row) => !row.done);
    const scoped = selected === "all" ? open : open.filter((row) => row.fieldId === selected);
    return scoped.slice(0, 4);
  }, [tasks, selected]);

  async function markTaskDone(taskId: string, message?: string) {
    setBusyTaskId(taskId);
    markLocalDone(taskId);
    try {
      const result = await completeTask(taskId);
      if (!result.ok) {
        toast.error(errMsg(result.error, "actionFailed"));
        await reloadTasks();
        return;
      }
      toast.success(message ?? tTasks("markedDone"));
    } finally {
      setBusyTaskId(null);
    }
  }

  async function dismissHomeTask(taskId: string) {
    setBusyTaskId(taskId);
    removeLocal(taskId);
    try {
      const result = await dismissTask(taskId);
      if (!result.ok) {
        toast.error(errMsg(result.error, "actionFailed"));
        await reloadTasks();
        return;
      }
      toast.success(tTasks("dismissed"));
    } finally {
      setBusyTaskId(null);
    }
  }

  const taskLabels = {
    takePhoto: tTasks("takePhoto"),
    yesAdd: tTasks("yesAdd"),
    no: tTasks("no"),
    recheckNow: tTasks("recheckNow"),
    markDone: tTasks("markDone"),
    dismiss: tTasks("dismiss"),
  };

  const primary = shown.find((f) => f.lat != null && f.lon != null) ?? shown[0] ?? null;
  const point = useMemo(() => {
    if (primary?.lat == null || primary?.lon == null) return null;
    return { fieldId: primary.id, lat: primary.lat, lon: primary.lon };
  }, [primary]);

  const { weather, risk, top, loading: weatherLoading } = useFieldWeather(point);
  const contentLoading = fieldsLoading || (point != null && weatherLoading);
  const riskColors = useFieldRiskColors(fields);

  const elevated = top && top.level !== "Low" ? top : null;
  const level = elevated?.level ?? "Low";
  const tone = TONE[level];
  const threat = elevated ? THREAT_BY_ID[elevated.threat] : null;
  const scanMode = elevated ? SCAN_MODE[elevated.threat] : undefined;
  /** Distinct Medium+High threats in the next 3 days (Π3). */
  const riskCount = useMemo(() => {
    if (!risk) return 0;
    let n = 0;
    for (const days of Object.values(risk)) {
      if (days.slice(0, 3).some((a) => LEVEL_RANK[a.level] >= LEVEL_RANK.Medium)) n += 1;
    }
    return n;
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
    ? ""
    : tomorrow && tomorrow.rain >= 1
      ? t("rainTomorrow")
      : t("noRainTomorrow");
  const weatherLabel = weather ? t(weatherLabelKey(weather.current.label)) : "";

  const whenLabel = useMemo(() => {
    if (!elevated || !weather) return t("whenToday");
    const idx = weather.days.findIndex((d) => d.date === elevated.day);
    if (idx === weather.todayIndex) return t("whenToday");
    if (idx === weather.todayIndex + 1) return t("whenTomorrow");
    if (idx < 0) return t("whenToday");
    return new Date(`${elevated.day}T12:00:00`).toLocaleDateString(locale, { weekday: "long" });
  }, [elevated, weather, t, locale]);

  const kickerText =
    elevated && threat
      ? t(
          threat.group === "weather"
            ? "kickerWeatherWatch"
            : threat.group === "location"
              ? "kickerLocationWatch"
              : "kickerFieldCheck",
          { when: whenLabel },
        )
      : t("kickerAllClear");

  const tipText =
    localizeTip(elevated?.actions?.[0] ?? "", locale) ||
    (elevated ? threatTip(elevated.threat, tThreats) : "") ||
    (weather ? t("keepChecks") : fields.length === 0 ? t("noFieldsBody") : t("noLocationBody"));

  const fieldBadge =
    primary == null
      ? "—"
      : primary.tree_count != null
        ? `${primary.name} · ${tFields("treesCount", { n: primary.tree_count })}`
        : primary.name;

  const chipFields = fields.map((f) => ({
    id: f.id,
    name: f.name,
    color: riskColors[f.id] ?? colors.good,
  }));

  const location =
    profilePlace || fieldPlace || (fields.length === 0 ? t("noPlace") : "");

  const priorityAction =
    offerCount > 0
      ? {
          href: "/farmer/market?tab=offers" as const,
          title: t("priorityOffer", { n: offerCount }),
          cta: t("priorityOfferCta"),
          tone: "good" as const,
        }
      : elevated && elevated.level === "High"
        ? {
            href: (SCAN_MODE[elevated.threat]
              ? scanCameraHref({
                  fieldId: primary?.id,
                  mode: SCAN_MODE[elevated.threat],
                })
              : "/farmer/alerts") as string,
            title: t("priorityRisk", {
              threat: threatLabel(elevated.threat, tThreats),
            }),
            cta: t("priorityRiskCta"),
            tone: "risk" as const,
          }
        : recheckCount > 0
          ? {
              href: "/farmer/scan" as const,
              title: t("priorityRecheck", { n: recheckCount }),
              cta: t("priorityRecheckCta"),
              tone: "warn" as const,
            }
          : null;

  return (
    <div className="w-full flex-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-ap-title text-ink" suppressHydrationWarning>
            {t(greeting)},
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
            className="flex size-11 items-center justify-center rounded-full border border-line bg-card"
          >
            <Settings className="size-[18px]" aria-hidden />
          </button>
          <Link
            href="/farmer/notifications"
            className="relative flex size-11 items-center justify-center rounded-full border border-line bg-card"
            aria-label={t("alerts")}
          >
            <Bell className="size-[18px] text-good" aria-hidden />
            {offerCount > 0 ? (
              <i className="absolute top-2.5 right-2.5 size-2 rounded-full bg-[#E5473A]" />
            ) : null}
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
              <Link
                href="/farmer/welcome"
                onClick={() => setMenu(false)}
                className="flex h-11 items-center gap-2.5 rounded-xl px-2.5 text-ap-body font-semibold text-ink"
              >
                <MapPin className="size-[18px]" aria-hidden />
                {t("profileSettings")}
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
                        "min-h-11 flex-1 rounded-full border text-ap-pill font-bold uppercase",
                        locale === code ? "border-ink bg-ink text-white" : "border-line bg-card text-ink",
                      )}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-line pt-1">
                <SignOutButton className="h-11 w-full justify-start rounded-xl px-2.5" />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {priorityAction ? (
        <Link
          href={priorityAction.href}
          className={cn(
            "mt-4 flex min-h-14 items-center gap-3 rounded-[18px] px-4 py-3",
            priorityAction.tone === "good"
              ? "bg-good-soft"
              : priorityAction.tone === "risk"
                ? "bg-risk-soft"
                : "bg-warn-soft",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="text-ap-small font-bold tracking-[0.4px] text-muted-foreground uppercase">
              {t("doToday")}
            </p>
            <p className="text-ap-body font-extrabold text-ink">{priorityAction.title}</p>
          </div>
          <span className="shrink-0 rounded-full bg-ink px-3 py-2 text-ap-pill font-bold text-white">
            {priorityAction.cta}
          </span>
        </Link>
      ) : null}

      {fieldsLoading ? (
        <div className="mt-4">
          <Skeleton className="h-9 w-full rounded-full" />
        </div>
      ) : fields.length > 0 ? (
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

      {contentLoading ? (
        <div className="mt-3.5 space-y-3">
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-[22px]" />
        </div>
      ) : (
        <div className="mt-3.5 md:grid md:grid-cols-2 md:items-start md:gap-6">
          <div className="min-w-0">
          <div className="flex h-11 items-center gap-2 rounded-2xl border border-line bg-card px-3 text-ap-body font-semibold">
            <WeatherIcon className="size-[18px] shrink-0 text-warn" aria-hidden />
            <span>{weather ? `${Math.round(weather.current.temp)}°C` : "—"}</span>
            <span className="truncate font-medium text-muted-foreground">{weatherLabel}</span>
            <span className="mx-1 h-5 w-px shrink-0 bg-line" />
            <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
              <Droplet className="size-4 shrink-0 text-ap-accent" aria-hidden />
              <span className="truncate font-medium text-muted-foreground">{rainText}</span>
            </span>
          </div>

          <div className={cn("relative mt-3.5 rounded-[22px] p-4", tone.card)}>
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-white px-2.5 py-1 text-[12px] font-bold text-ink">
              <MapPin className="size-3" style={{ color: tone.iconColor }} aria-hidden />
              {fieldBadge}
            </div>
            <p className={cn("mt-3 text-[12px] font-bold tracking-[1.4px] uppercase", tone.kicker)}>
              {kickerText}
            </p>
            <h2 className="mt-1.5 max-w-[240px] text-[23px] leading-tight font-extrabold tracking-tight text-ink">
              {elevated && threat
                ? t("riskIs", {
                    threat: threatLabel(elevated.threat, tThreats),
                    level: riskLevelLabel(elevated.level, tThreats),
                  })
                : weather
                  ? t("noBigRisks")
                  : t("noWeatherYet")}
            </h2>
            <p className="mt-1.5 max-w-[260px] text-ap-body text-[#5a5a5a]">{tipText}</p>
            <div
              className={cn(
                "absolute top-14 right-4 flex size-12 items-center justify-center rounded-full",
                tone.iconBg,
              )}
            >
              <CardIcon className="size-5" style={{ color: tone.iconColor }} aria-hidden />
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              {elevated && scanMode ? (
                <ApButton
                  label={t("ctaScan")}
                  variant={tone.btn}
                  icon={<Camera className="size-4" aria-hidden />}
                  onClick={() =>
                    router.push(
                      scanCameraHref({
                        fieldId: primary?.id,
                        mode: scanMode,
                      }),
                    )
                  }
                />
              ) : (
                <ApButton
                  label={t("ctaAlerts")}
                  variant={tone.btn}
                  icon={<TriangleAlert className="size-4" aria-hidden />}
                  onClick={() => router.push("/farmer/alerts")}
                />
              )}
              <Link href="/farmer/tasks" className={cn("text-ap-small font-semibold", tone.kicker)}>
                {t("tasksRatio", { done: taskStats.done, total: taskStats.total })}
              </Link>
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <QuickPill href="/farmer/alerts" tone="risk" label={t("risksCount", { n: riskCount })}>
              <TriangleAlert className="size-4" aria-hidden />
            </QuickPill>
            <QuickPill href="/farmer/scan" tone="warn" label={t("recheckCount", { n: recheckCount })}>
              <Leaf className="size-4" aria-hidden />
            </QuickPill>
            <QuickPill href="/farmer/market?tab=offers" tone="good" label={t("offersCount", { n: offerCount })}>
              <Tag className="size-4" aria-hidden />
            </QuickPill>
          </div>

          <SectionHeader
            title={t("todayTasks")}
            action={
              <Link href="/farmer/tasks" className="inline-flex min-h-11 min-w-11 items-center justify-end text-ap-body font-medium text-muted-foreground">
                {t("seeAll")}
              </Link>
            }
          />
          <div className="mt-2">
            <AddTaskForm
              fields={fields.map((f) => ({ id: f.id, name: f.name }))}
              onCreated={(task) => prependLocal(task)}
            />
          </div>
          {tasksLoading ? (
            <div className="mt-2.5 space-y-2.5">
              <Skeleton className="h-24 w-full rounded-[18px]" />
              <Skeleton className="h-24 w-full rounded-[18px]" />
            </div>
          ) : openTasks.length === 0 ? (
            <p className="mt-2 text-ap-body font-semibold text-good">{t("tasksAllDone")}</p>
          ) : (
            <div className="mt-2.5 space-y-2.5">
              {openTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  compact
                  busy={busyTaskId === task.id}
                  onPhoto={() => router.push(scanCameraHrefForTask(task))}
                  onSprayYes={() => {
                    void (async () => {
                      await markTaskDone(task.id, tTasks("sprayNoted"));
                      router.push(`/farmer/logbook?add=1&fieldId=${encodeURIComponent(task.fieldId)}`);
                    })();
                  }}
                  onSprayNo={() => void markTaskDone(task.id, tTasks("noSprayNoted"))}
                  onRecheck={() => router.push(scanCameraHrefForTask(task))}
                  onPlain={() => void markTaskDone(task.id)}
                  onDismiss={() => void dismissHomeTask(task.id)}
                  labels={taskLabels}
                />
              ))}
            </div>
          )}
          </div>

          <div className="mt-4 min-w-0 md:mt-0">
          <SectionHeader
            title={t("yourFields")}
            action={
              <Link href="/farmer/fields" className="inline-flex min-h-11 min-w-11 items-center justify-end text-ap-body font-medium text-muted-foreground">
                {t("seeAll")}
              </Link>
            }
          />
          {fieldsLoading ? (
            <div className="mt-2.5 flex gap-2.5">
              <Skeleton className="h-24 w-[236px] shrink-0 rounded-[18px]" />
              <Skeleton className="h-24 w-[236px] shrink-0 rounded-[18px]" />
            </div>
          ) : fields.length === 0 ? (
            <p className="mt-2 text-ap-body text-muted-foreground">{t("noFieldsBody")}</p>
          ) : (
            <div className="mt-2.5 flex gap-2.5 overflow-x-auto pb-1 md:flex-col md:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {shown.map((f) => {
                const live = elevated && primary?.id === f.id ? elevated : null;
                const liveThreat = live ? THREAT_BY_ID[live.threat] : null;
                const score = fieldScores[f.id];
                return (
                  <Link key={f.id} href="/farmer/fields" className="w-[236px] shrink-0 md:w-full">
                    <ApCard className="p-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-good-soft">
                          <Trees className="size-5 text-good" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-ap-card text-ink">{f.name}</p>
                          <p className="text-ap-small text-muted-foreground">
                            {f.tree_count != null ? `${f.tree_count}` : "—"}
                            {f.area_ha != null
                              ? ` · ${tFields("haCount", { n: formatStremmata(Number(f.area_ha), 1, locale) })}`
                              : ""}
                          </p>
                        </div>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-soft text-ap-body font-extrabold text-muted-foreground">
                          {score != null ? score : "—"}
                        </span>
                      </div>
                      {live && liveThreat ? (
                        <div className="mt-2 flex h-6 items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: live.level === "High" ? colors.risk : colors.warn }}
                          />
                          <span className="flex-1 truncate text-ap-body font-semibold text-ink">
                            {threatLabel(live.threat, tThreats)}
                          </span>
                          <Pill tone={live.level === "High" ? "risk" : "warn"}>
                            {riskLevelLabel(live.level, tThreats)}
                          </Pill>
                        </div>
                      ) : null}
                    </ApCard>
                  </Link>
                );
              })}
            </div>
          )}
          </div>
        </div>
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
  href: "/farmer/alerts" | "/farmer/scan" | "/farmer/market?tab=offers";
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
        "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] bg-card text-ap-pill font-bold",
        style,
      )}
    >
      {children}
      {label}
    </Link>
  );
}
