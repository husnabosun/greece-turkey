"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";

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

/** Field onboarding only — trust score / listing is a separate field action. */
export function AddFieldScreen() {
  const t = useTranslations("farmerFields");
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
  const [trees, setTrees] = useState(80);
  const [ageYears, setAgeYears] = useState(35);
  const oliveCountry = useMemo(
    () => resolveOliveCountry({ locale, lon: mapLon, profileCountry }).country,
    [locale, mapLon, profileCountry],
  );
  const [varietySlug, setVarietySlug] = useState(() => defaultVarietySlug(oliveCountry));
  const [irrigated, setIrrigated] = useState(false);
  const [saving, setSaving] = useState(false);

  const varietyGroups = useMemo(
    () => varietiesGrouped(locale, mapLon, profileCountry),
    [locale, mapLon, profileCountry],
  );

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
    if (!isVarietyAllowed(varietySlug, oliveCountry)) {
      setVarietySlug(defaultVarietySlug(oliveCountry));
    }
  }, [oliveCountry, varietySlug]);

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
    if (ha != null && ha > 0) {
      const estimate = Math.max(10, Math.round(ha * TREES_PER_HA));
      setTrees(estimate);
    }
  }

  async function saveField() {
    if (!name.trim()) {
      toast.error(t("needName"));
      return;
    }
    if (!polygon) {
      toast.error(t("needPolygon"));
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
        toast.error(error.message);
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
    <div className="fixed inset-0 z-40 overflow-y-auto overscroll-y-contain bg-background md:left-60">
      <div className="flex min-h-full w-full flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
        <div className="flex shrink-0 items-center gap-3 px-4 pt-2 md:px-6">
          <button
            type="button"
            aria-label={t("back")}
            onClick={() => router.push("/farmer/fields")}
            className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <h1 className="flex-1 text-[22px] font-extrabold tracking-tight text-ink">{t("addTitle")}</h1>
        </div>

        <div className="px-4 md:px-6">
          <Label>{t("fieldName")}</Label>
          <div className="flex h-12 items-center rounded-[14px] border-[1.5px] border-ink bg-card px-3.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("nameExample")}
              maxLength={24}
              className="h-full min-w-0 flex-1 bg-transparent text-ap-card font-bold text-ink outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              aria-label={t("voiceSoon")}
              onClick={() => toast(t("voiceSoon"))}
              className="flex size-9 items-center justify-center"
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
            <p className="mt-2 flex items-center gap-1.5 text-ap-body font-semibold text-good">
              <Sparkles className="size-4 shrink-0" aria-hidden />
              {t("satelliteTrees", { n: satelliteTrees })}
            </p>
          ) : (
            <p className="mt-2 text-ap-small text-muted-foreground">{t("drawHint")}</p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-[18px] border border-line bg-card p-3">
              <p className="text-ap-small font-medium text-muted-foreground">{t("numberOfTrees")}</p>
              <div className="mt-2 flex items-center justify-between gap-1">
                <RoundBtn label={t("less")} onClick={() => setTrees((n) => Math.max(1, n - 1))}>
                  <Minus className="size-4" />
                </RoundBtn>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={5000}
                  value={trees}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    setTrees(Math.max(1, Math.min(5000, Math.round(n))));
                  }}
                  className="w-14 bg-transparent text-center text-ap-card font-extrabold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <RoundBtn label={t("more")} onClick={() => setTrees((n) => Math.min(5000, n + 1))}>
                  <Plus className="size-4" />
                </RoundBtn>
              </div>
            </div>
            <div className="rounded-[18px] border border-line bg-card p-3">
              <p className="text-ap-small font-medium text-muted-foreground">{t("treeAgeExact")}</p>
              <div className="mt-2 flex items-center justify-between gap-1">
                <RoundBtn label={t("less")} onClick={() => setAgeYears((n) => Math.max(1, n - 1))}>
                  <Minus className="size-4" />
                </RoundBtn>
                <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
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
                    className="w-12 bg-transparent text-center text-ap-card font-extrabold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-ap-small font-bold text-muted-foreground">{t("treeAgeYears")}</span>
                </div>
                <RoundBtn label={t("more")} onClick={() => setAgeYears((n) => Math.min(200, n + 1))}>
                  <Plus className="size-4" />
                </RoundBtn>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {AGE_PRESETS.map((p) => (
                  <PillBtn key={p.key} on={ageYears === p.years} onClick={() => setAgeYears(p.years)}>
                    {t(p.key)}
                  </PillBtn>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-2 rounded-[18px] border border-line bg-card p-3">
            <p className="text-ap-small font-medium text-muted-foreground">{t("oliveVariety")}</p>
            <div className="mt-2 space-y-2.5">
              {varietyGroups.map((group) => (
                <div key={group.origin}>
                  <p className="mb-1 text-[10px] font-bold tracking-[0.6px] text-muted-foreground uppercase">
                    {t(group.labelKey)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((v) => (
                      <PillBtn key={v.slug} on={varietySlug === v.slug} onClick={() => setVarietySlug(v.slug)}>
                        {varietyLabel(v, locale)}
                      </PillBtn>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 rounded-[18px] border border-line bg-card p-3">
            <p className="text-ap-small font-medium text-muted-foreground">{t("irrigatedQ")}</p>
            <div className="mt-2 flex gap-1.5">
              <PillBtn on={irrigated} onClick={() => setIrrigated(true)}>
                {t("yes")}
              </PillBtn>
              <PillBtn on={!irrigated} onClick={() => setIrrigated(false)}>
                {t("no")}
              </PillBtn>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void saveField()}
            className="mt-5 mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-ap-btn font-bold text-white disabled:opacity-50"
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
        "inline-flex h-[30px] items-center rounded-full border px-3 text-ap-pill font-bold",
        on ? "border-ink bg-ink text-white" : "border-line bg-card text-ink",
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
      className="flex size-9 items-center justify-center rounded-full bg-soft"
    >
      {children}
    </button>
  );
}
