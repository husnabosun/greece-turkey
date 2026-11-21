"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, ChevronLeft, Mic, Minus, Plus, Sparkles } from "lucide-react";
import { hasSupabaseConfig, publicEnv } from "@/core/config/env";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import type { FieldPolygon } from "@/features/fields/field-map-editor";
import { initialMapView } from "@/features/fields/map-location";
import {
  defaultVarietySlug,
  isVarietyAllowed,
  resolveOliveCountry,
  varietyLabel,
  varietiesGrouped,
  type OliveCountry,
} from "@/features/fields/olive-varieties";
import { ApCard } from "@/shared/components/brand";
import { useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { parseTreeCount, useErrorMessage } from "@/shared/lib/error-message";

const FieldMapEditor = dynamic(() => import("./field-map-editor").then((m) => m.FieldMapEditor), {
  ssr: false,
  loading: () => <div className="h-[58dvh] min-h-[320px] w-full animate-pulse bg-soft md:h-[62dvh]" />,
});

const AGE_PRESETS = [
  { key: "ageYoung" as const, years: 12 },
  { key: "ageMid" as const, years: 35 },
  { key: "ageOld" as const, years: 60 },
];
/** Rough olive density for satellite estimate when polygon area is known. */
const TREES_PER_HA = 130;

/**
- Add field — your product flow: enter details, save, done.
- (Demo’s extra “Start selling” step is intentionally not used.)
 */
export function AddFieldScreen() {
  const t = useTranslations("farmerFields");
  const errMsg = useErrorMessage();
  const locale = useLocale();
  const router = useRouter();
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN;

  const [name, setName] = useState("");
  const [polygon, setPolygon] = useState<FieldPolygon | null>(null);
  const [areaHa, setAreaHa] = useState<number | null>(null);
  const [mapLon, setMapLon] = useState<number | null>(() => {
    const last = initialMapView();
    return last.center[0] ?? null;
  });
  const [profileCountry, setProfileCountry] = useState<OliveCountry | null>(null);
  const [treesText, setTreesText] = useState("80");
  const [ageYears, setAgeYears] = useState(35);
  const [showAllVarieties, setShowAllVarieties] = useState(false);
  const [treesTouched, setTreesTouched] = useState(false);
  const oliveCountry = useMemo(
    () => resolveOliveCountry({ locale, lon: mapLon, profileCountry }).country,
    [locale, mapLon, profileCountry],
  );
  const [varietySlug, setVarietySlug] = useState(() => defaultVarietySlug(oliveCountry));
  const [irrigated, setIrrigated] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);

  const varietyGroups = useMemo(
    () => varietiesGrouped(locale, mapLon, profileCountry, showAllVarieties),
    [locale, mapLon, profileCountry, showAllVarieties],
  );

  function parseTrees(): number | null {
    return parseTreeCount(treesText);
  }

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase.from("profiles").select("country").eq("id", user.id).maybeSingle();
      if (cancelled) return;
      const c = data?.country;
      if (c === "GR" || c === "TR") setProfileCountry(c);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (showAllVarieties) return;
    if (!isVarietyAllowed(varietySlug, oliveCountry)) {
      setVarietySlug(defaultVarietySlug(oliveCountry));
    }
  }, [oliveCountry, varietySlug, showAllVarieties]);

  const satelliteTrees = useMemo(() => {
    if (areaHa == null || areaHa <= 0) return null;
    return Math.max(10, Math.round(areaHa * TREES_PER_HA));
  }, [areaHa]);

  function onPolygon(next: FieldPolygon | null, ha: number | null) {
    setPolygon(next);
    setAreaHa(ha);
    if (next?.coordinates?.[0]?.length) {
      const ring = next.coordinates[0];
      const lon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
      setMapLon(lon);
    }
    // Do not overwrite a number the user already typed — offer estimate separately.
    if (ha != null && ha > 0 && !treesTouched) {
      const estimate = Math.max(10, Math.round(ha * TREES_PER_HA));
      setTreesText(String(estimate));
    }
  }

  async function saveField() {
    if (saving || saveLock.current) return;
    if (!name.trim()) {
      toast.error(t("needName"));
      return;
    }
    if (!polygon) {
      toast.error(t("needPolygon"));
      return;
    }
    const trees = parseTrees();
    if (trees == null) {
      toast.error(t("invalidTrees"));
      return;
    }
    if (!hasSupabaseConfig()) {
      toast.error(t("needSupabase"));
      return;
    }
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      toast.error(t("needSupabase"));
      return;
    }

    saveLock.current = true;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t("needLogin"));
        return;
      }

      const notes = JSON.stringify({
        tree_age_years: ageYears,
        tree_age_band: ageYears <= 20 ? "5-20" : ageYears <= 50 ? "20-50" : "50+",
        area_ha_client: areaHa,
      });

      const { error } = await supabase.rpc("create_field_from_geojson", {
        p_name: name.trim(),
        p_geojson: JSON.stringify(polygon),
        p_variety: varietySlug === "other" ? null : varietySlug,
        p_variety_slug: varietySlug,
        p_tree_count: trees,
        p_irrigated: irrigated,
        p_proof_level: "self_reported",
        p_notes: notes,
      });

      if (error) {
        saveLock.current = false;
        toast.error(errMsg(error.message, "saveFailed"));
        return;
      }

      toast.success(t("saveOk"));
      router.push("/farmer/fields");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-background md:left-60">
      <div className="flex min-h-full w-full flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8">
        <div className="flex shrink-0 items-center gap-3 px-4 pt-2 md:px-6">
          <button
            type="button"
            aria-label={t("back")}
            onClick={() => router.push("/farmer/fields")}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card transition-colors hover:bg-soft"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-[22px] font-extrabold tracking-tight text-ink">
            {t("addTitle")}
          </h1>
        </div>

        <div className="px-4 md:px-6">
          <Label>{t("fieldName")}</Label>
          <div className="flex h-12 items-center rounded-[14px] border-[1.5px] border-ink bg-card pr-1 pl-3.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("nameExample")}
              maxLength={80}
              className="h-full min-w-0 flex-1 bg-transparent text-ap-card font-bold text-ink outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              aria-label={t("voiceSoon")}
              onClick={() => toast(t("voiceSoon"))}
              className="flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-soft"
            >
              <Mic className="size-[18px] text-muted-foreground" aria-hidden />
            </button>
          </div>
          <Label>{t("drawOnMap")}</Label>
        </div>

        {!token ? (
          <p className="mx-4 rounded-[18px] border border-line bg-soft px-3 py-6 text-center text-ap-body text-muted-foreground md:mx-6">
            {t("needMapboxBody")}
          </p>
        ) : (
          <FieldMapEditor
            token={token}
            onPolygonChange={onPolygon}
            onCenterChange={(lon) => setMapLon(lon)}
            placeLabel={name.trim() || undefined}
            className="w-full"
            fullBleed
          />
        )}

        <div className="px-4 md:px-6">
          {satelliteTrees != null ? (
            <p className="mt-2.5 flex items-center gap-1.5 text-ap-body font-semibold text-good">
              <Sparkles className="size-4 shrink-0" aria-hidden />
              {t("satelliteTrees", { n: satelliteTrees })}
            </p>
          ) : (
            <p className="mt-2.5 text-ap-small text-muted-foreground">{t("drawHint")}</p>
          )}

          <div className="mt-3 grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-2">
            <ApCard className="p-3.5">
              <p className="text-ap-small font-medium text-muted-foreground">{t("numberOfTrees")}</p>
              <div className="mt-2 flex items-center justify-between gap-1">
                <RoundBtn
                  label={t("less")}
                  onClick={() => {
                    setTreesTouched(true);
                    const n = parseTrees() ?? 1;
                    setTreesText(String(Math.max(1, n - 1)));
                  }}
                >
                  <Minus className="size-4" />
                </RoundBtn>
                <input
                  type="text"
                  inputMode="numeric"
                  value={treesText}
                  onChange={(e) => {
                    setTreesTouched(true);
                    // Keep exactly what was typed; invalid input is flagged below, never rewritten.
                    setTreesText(e.target.value.slice(0, 7));
                  }}
<<<<<<< HEAD
                  className="min-w-0 flex-1 bg-transparent text-center text-ap-card font-extrabold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
=======
                  aria-invalid={treesText.trim() !== "" && parseTrees() == null}
                  className="w-16 bg-transparent text-center text-ap-card font-extrabold text-ink outline-none"
>>>>>>> bae40a1a4f39f12c467fc4f9db0d6072f0016e03
                />
                <RoundBtn
                  label={t("more")}
                  onClick={() => {
                    setTreesTouched(true);
                    const n = parseTrees() ?? 0;
                    setTreesText(String(Math.min(5000, n + 1)));
                  }}
                >
                  <Plus className="size-4" />
                </RoundBtn>
              </div>
<<<<<<< HEAD
            </ApCard>

            <ApCard className="p-3.5">
=======
              {treesText.trim() !== "" && parseTrees() == null ? (
                <p className="mt-1 text-ap-small font-semibold text-risk" role="alert">
                  {t("invalidTrees")}
                </p>
              ) : null}
              {satelliteTrees != null && treesTouched ? (
                <button
                  type="button"
                  onClick={() => {
                    setTreesText(String(satelliteTrees));
                    setTreesTouched(false);
                  }}
                  className="mt-2 text-left text-ap-small font-bold text-ap-accent"
                >
                  {t("useEstimate", { n: satelliteTrees })}
                </button>
              ) : null}
            </div>
            <div className="rounded-[18px] border border-line bg-card p-3">
>>>>>>> bae40a1a4f39f12c467fc4f9db0d6072f0016e03
              <p className="text-ap-small font-medium text-muted-foreground">{t("treeAgeExact")}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <RoundBtn label={t("less")} onClick={() => setAgeYears((n) => Math.max(1, n - 1))}>
                  <Minus className="size-4" />
                </RoundBtn>
                <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={200}
                    value={ageYears}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      setAgeYears(Math.max(1, Math.min(200, Math.round(n))));
                    }}
                    className="w-16 bg-transparent text-center text-ap-card font-extrabold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-ap-small font-bold text-muted-foreground">{t("treeAgeYears")}</span>
                </div>
                <RoundBtn label={t("more")} onClick={() => setAgeYears((n) => Math.min(200, n + 1))}>
                  <Plus className="size-4" />
                </RoundBtn>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {AGE_PRESETS.map((p) => (
                  <PillBtn key={p.key} on={ageYears === p.years} onClick={() => setAgeYears(p.years)}>
                    {t(p.key)}
                  </PillBtn>
                ))}
              </div>
            </ApCard>
          </div>

<<<<<<< HEAD
          <ApCard className="mt-2.5 p-3.5">
            <p className="text-ap-small font-medium text-muted-foreground">{t("oliveVariety")}</p>
            <div className="mt-2.5 space-y-3">
              {varietyGroups.map((group) => (
                <div key={group.origin}>
                  <p className="mb-1.5 text-[12px] font-bold tracking-[0.6px] text-muted-foreground uppercase">
=======
          <div className="mt-2 rounded-[18px] border border-line bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-ap-small font-medium text-muted-foreground">{t("oliveVariety")}</p>
              <button
                type="button"
                onClick={() => setShowAllVarieties((v) => !v)}
                className="text-ap-small font-bold text-ap-accent"
              >
                {showAllVarieties ? t("showLocalVarieties") : t("showAllVarieties")}
              </button>
            </div>
            <div className="mt-2 space-y-2.5">
              {varietyGroups.map((group) => (
                <div key={group.origin}>
                  <p className="mb-1 text-[12px] font-bold tracking-[0.6px] text-muted-foreground uppercase">
>>>>>>> bae40a1a4f39f12c467fc4f9db0d6072f0016e03
                    {t(group.labelKey)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((v) => (
                      <PillBtn key={v.slug} on={varietySlug === v.slug} onClick={() => setVarietySlug(v.slug)}>
                        {varietyLabel(v, locale)}
                      </PillBtn>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ApCard>

          <ApCard className="mt-2.5 p-3.5">
            <p className="text-ap-small font-medium text-muted-foreground">{t("irrigatedQ")}</p>
            <div className="mt-2 flex gap-2">
              <PillBtn on={irrigated} onClick={() => setIrrigated(true)}>
                {t("yes")}
              </PillBtn>
              <PillBtn on={!irrigated} onClick={() => setIrrigated(false)}>
                {t("no")}
              </PillBtn>
            </div>
          </ApCard>

          <button
            type="button"
            disabled={saving}
            onClick={() => void saveField()}
            className="mt-5 mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-ap-btn font-bold text-white transition-opacity disabled:opacity-50"
          >
            <ArrowRight className="size-[18px]" aria-hidden />
            {saving ? t("saving") : t("saveField")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: string }) {
  return <p className="mt-4 mb-1.5 text-ap-small font-bold tracking-[1px] text-muted-foreground uppercase">{children}</p>;
}

function PillBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
<<<<<<< HEAD
        "inline-flex min-h-11 items-center rounded-full border px-4 text-ap-pill font-bold transition-colors",
        on ? "border-ink bg-ink text-white" : "border-line bg-card text-ink hover:bg-soft",
=======
        "inline-flex min-h-11 items-center rounded-full border px-3 text-ap-pill font-bold",
        on ? "border-ink bg-ink text-white" : "border-line bg-card text-ink",
>>>>>>> bae40a1a4f39f12c467fc4f9db0d6072f0016e03
      )}
    >
      {children}
    </button>
  );
}

function RoundBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
<<<<<<< HEAD
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-soft transition-colors hover:bg-soft/80"
=======
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-soft"
>>>>>>> bae40a1a4f39f12c467fc4f9db0d6072f0016e03
    >
      {children}
    </button>
  );
}