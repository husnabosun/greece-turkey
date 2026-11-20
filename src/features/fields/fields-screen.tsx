"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  BadgeCheck,
  Camera,
  ChevronLeft,
  ChevronRight,
  Layers,
  MoreHorizontal,
  RefreshCw,
  Star,
} from "lucide-react";
import { formatStremmata } from "@/features/fields/area";
import { deleteFarmerField, updateFarmerField } from "@/features/fields/field-mutations";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { FieldHealthMap } from "@/features/fields/field-health-map";
import { useFieldTrees } from "@/features/fields/use-field-trees";
import {
  defaultVarietySlug,
  resolveOliveCountry,
  varietiesGrouped,
  varietyLabel,
} from "@/features/fields/olive-varieties";
import { BottomSheet } from "@/features/marketplace/processor-kit";
import { publicEnv } from "@/core/config/env";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { Chip, FieldChips, Pill } from "@/shared/components/brand";
import { Link, useRouter } from "@/shared/i18n/navigation";
import type { Field } from "@/shared/types/database";
import { FIELD_DOTS, colors } from "@/shared/theme/tokens";
import { threatLabel } from "@/features/weather-risk/threat-labels";
import { cn } from "@/shared/lib/utils";

export function FieldsScreen() {
  const t = useTranslations("farmerFields");
  const tThreats = useTranslations("riskThreats");
  const locale = useLocale();
  const router = useRouter();
  const { fields, loading, reload } = useFarmerFields();
  const [showHealth, setShowHealth] = useState(true);
  const [selectedId, setSelectedId] = useState<string | "all">("all");
  const [selectedTreeId, setSelectedTreeId] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTrees, setEditTrees] = useState("");
  const [editVariety, setEditVariety] = useState("koroneiki");
  const [editIrrigated, setEditIrrigated] = useState(false);
  const [profileCountry, setProfileCountry] = useState<"GR" | "TR" | null>(null);
  const [fieldScores, setFieldScores] = useState<Record<string, number>>({});
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) return;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("country").eq("id", user.id).maybeSingle();
      if (data?.country === "GR" || data?.country === "TR") setProfileCountry(data.country);
    })();
  }, []);

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase || fields.length === 0) {
      setFieldScores({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const ids = fields.map((f) => f.id);
      const { data } = await supabase
        .from("quality_scores")
        .select("field_id, score, computed_at")
        .in("field_id", ids)
        .order("computed_at", { ascending: false });
      if (cancelled) return;
      const scores: Record<string, number> = {};
      for (const row of data ?? []) {
        if (scores[row.field_id] == null) scores[row.field_id] = Number(row.score);
      }
      setFieldScores(scores);
    })();
    return () => {
      cancelled = true;
    };
  }, [fields]);

  const viewFields = useMemo(
    () =>
      fields.map((f, i) => ({
        id: f.id,
        name: f.name,
        color: FIELD_DOTS[i % FIELD_DOTS.length],
        trees: f.tree_count,
        ha: f.area_ha,
        lat: f.lat,
        lon: f.lon,
        geom: f.geom,
        score: fieldScores[f.id] ?? null,
      })),
    [fields, fieldScores],
  );

  useEffect(() => {
    if (selectedId === "all") return;
    if (selectedId && !viewFields.some((f) => f.id === selectedId)) {
      setSelectedId(viewFields.length ? "all" : "");
    }
  }, [selectedId, viewFields]);

  const showAll = selectedId === "all";
  const active = showAll ? null : (viewFields.find((f) => f.id === selectedId) ?? viewFields[0] ?? null);
  const activeRaw: Field | null = active ? (fields.find((f) => f.id === active.id) ?? null) : null;
  const { trees, defaultSelectedId } = useFieldTrees(active?.id);

  const varietyGroups = useMemo(() => {
    const lon = activeRaw?.lon ?? null;
    return varietiesGrouped(locale, lon, profileCountry, true);
  }, [locale, activeRaw?.lon, profileCountry]);

  function openEdit() {
    if (!activeRaw) return;
    setEditName(activeRaw.name);
    setEditTrees(activeRaw.tree_count != null ? String(activeRaw.tree_count) : "");
    setEditVariety(activeRaw.variety_slug ?? activeRaw.variety ?? defaultVarietySlug(resolveOliveCountry({ locale, lon: activeRaw.lon, profileCountry }).country));
    setEditIrrigated(activeRaw.irrigated);
    setMenuOpen(false);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!activeRaw) return;
    const trees = editTrees.trim() === "" ? null : Number(editTrees.replace(",", "."));
    if (trees != null && (!Number.isFinite(trees) || trees < 1 || trees > 5000)) {
      toast.error(t("invalidTrees"));
      return;
    }
    setBusy(true);
    try {
      const res = await updateFarmerField({
        fieldId: activeRaw.id,
        name: editName,
        treeCount: trees == null ? null : Math.round(trees),
        varietySlug: editVariety,
        irrigated: editIrrigated,
      });
      if (!res.ok) {
        toast.error(res.error === "needName" ? t("needName") : res.error ?? t("saveFailed"));
        return;
      }
      toast.success(t("updatedOk"));
      setEditOpen(false);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!activeRaw) return;
    setBusy(true);
    try {
      const res = await deleteFarmerField(activeRaw.id);
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"));
        return;
      }
      toast.success(t("deletedOk"));
      setDeleteOpen(false);
      setSelectedId("all");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setSelectedTreeId(defaultSelectedId);
  }, [active?.id, defaultSelectedId]);

  const selectedTree = trees.find((tr) => tr.id === selectedTreeId) ?? null;
  const followUpCount = trees.filter((tr) => tr.status !== "healthy").length;

  const totals = useMemo(() => {
    const trees = viewFields.reduce((s, f) => s + (f.trees ?? 0), 0);
    const ha = viewFields.reduce((s, f) => s + (f.ha != null ? Number(f.ha) : 0), 0);
    const scores = viewFields.map((f) => f.score).filter((n): n is number => n != null);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { trees, ha, avgScore, scoreCount: scores.length };
  }, [viewFields]);

  const mapOutlines = useMemo(
    () =>
      showAll
        ? viewFields.map((f) => ({ id: f.id, geom: f.geom, color: f.color }))
        : undefined,
    [showAll, viewFields],
  );

  const displayTrees = showAll ? totals.trees : active?.trees;
  const displayHa = showAll ? (totals.ha > 0 ? totals.ha : null) : active?.ha != null ? Number(active.ha) : null;
  const displayScore = showAll ? totals.avgScore : active?.score ?? null;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto overscroll-y-contain bg-background md:left-60">
      <div className="flex min-h-full flex-col">
        <div className="shrink-0 space-y-1.5 px-4 pt-2 pb-1.5 md:px-6 md:pt-3">
          <div className="flex items-center gap-3">
            <Link
              href="/farmer/dashboard"
              aria-label={t("back")}
              className="flex size-9 items-center justify-center rounded-full border border-line bg-card"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </Link>
            <h1 className="flex-1 text-[20px] font-extrabold tracking-tight text-ink">
              {showAll ? t("allFieldsTitle") : t("myField")}
            </h1>
            {activeRaw ? (
              <button
                type="button"
                aria-label={t("fieldMenu")}
                onClick={() => setMenuOpen(true)}
                className="flex size-11 items-center justify-center rounded-full border border-line bg-card"
              >
                <MoreHorizontal className="size-[18px]" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                aria-label={t("layers")}
                aria-pressed={showHealth}
                onClick={() => {
                  setShowHealth((v) => !v);
                  toast(showHealth ? t("layersOff") : t("layersOn"));
                }}
                className="flex size-11 items-center justify-center rounded-full border border-line bg-card"
              >
                <Layers className="size-[18px]" aria-hidden />
              </button>
            )}
          </div>

          {loading ? (
            <div className="h-11 animate-pulse rounded-full bg-soft" />
          ) : (
            <FieldChips
              showAll
              allLabel={t("allFieldsChip", { n: viewFields.length })}
              fields={viewFields.map((f) => ({ id: f.id, name: f.name, color: f.color }))}
              selected={selectedId === "" ? "all" : selectedId}
              onSelect={(id) => setSelectedId(id)}
              trailing={
                <Chip on={false} onClick={() => router.push("/farmer/fields/new")}>
                  <span className="text-ap-pill font-bold text-ink">{t("add")}</span>
                </Chip>
              }
            />
          )}

          <div className="flex min-h-11 items-center rounded-2xl border border-line bg-card px-2.5 py-1.5">
            <div className="flex-1 text-center">
              <p className="text-ap-body font-extrabold text-ink">
                {displayTrees != null && displayTrees > 0 ? t("treesCount", { n: displayTrees }) : "—"}
              </p>
              <p className="text-ap-small font-medium text-muted-foreground">
                {showAll ? t("treesTotal") : t("treeCount")}
              </p>
            </div>
            <div className="h-7 w-px bg-line" />
            <div className="flex-1 text-center">
              <p className="text-ap-body font-extrabold text-ink">
                {displayHa != null ? t("haCount", { n: formatStremmata(displayHa, 1, locale) }) : "—"}
              </p>
              <p className="text-ap-small font-medium text-muted-foreground">
                {showAll ? t("areaTotal") : t("fieldSize")}
              </p>
            </div>
            <Link
              href="/farmer/quality"
              className="flex min-h-11 flex-[1.3] items-center justify-center gap-1.5 rounded-xl bg-soft px-1 py-1"
            >
              <Star
                className="size-4"
                fill={displayScore != null ? colors.good : colors.muted}
                color={displayScore != null ? colors.good : colors.muted}
                aria-hidden
              />
              <span>
                <span className="block text-ap-small font-semibold text-ink">
                  {showAll ? t("avgScore") : t("qualityScore")}
                </span>
                <span className="text-ap-body font-extrabold text-ink">
                  {displayScore != null ? displayScore : "—"}
                  <span className="text-ap-small font-medium text-muted-foreground">{t("perHundred")}</span>
                </span>
              </span>
            </Link>
          </div>
        </div>

        <div className="relative h-[58dvh] max-h-[520px] min-h-[280px] w-full shrink-0 md:h-[62dvh] md:max-h-[640px] md:px-6">
          <div className="absolute inset-0 md:inset-x-6 md:inset-y-0">
            {loading ? (
              <div className="flex h-full w-full items-center justify-center bg-[#1a1a1a] md:rounded-[18px]">
                <p className="text-ap-body font-semibold text-white/70">{t("mapLoading")}</p>
              </div>
            ) : (
              <FieldHealthMap
                className="h-full w-full rounded-none md:rounded-[18px]"
                token={token}
                lat={active?.lat}
                lon={active?.lon}
                geom={active?.geom}
                outlines={mapOutlines}
                trees={showAll ? [] : trees}
                selectedId={selectedTreeId}
                onSelect={setSelectedTreeId}
                showHealth={showHealth}
                onToggleHealth={setShowHealth}
                onLocate={() => toast(t("located"))}
                labels={{
                  aiLayer: t("aiLayer"),
                  healthy: t("healthy"),
                  suspicious: t("suspicious"),
                  diseased: t("diseased"),
                  locate: t("myLocation"),
                  zoomIn: t("zoomIn"),
                  zoomOut: t("zoomOut"),
                  tree: (id) => t("treeN", { id }),
                  needToken: t("mapFallback"),
                  loading: t("mapLoading"),
                  failed: t("mapFallback"),
                }}
              />
            )}
          </div>
        </div>

        <div className="shrink-0 space-y-1.5 border-t border-line bg-background px-4 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom))] md:px-6 md:pb-6">
          {active ? (
            <>
              {activeRaw ? (
                <div className="rounded-xl border border-line bg-card px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-ap-body font-extrabold text-ink">{activeRaw.name}</p>
                      <p className="mt-0.5 text-ap-small text-muted-foreground">
                        {[
                          activeRaw.variety_slug || activeRaw.variety
                            ? varietyLabel(activeRaw.variety_slug ?? activeRaw.variety, locale)
                            : null,
                          activeRaw.irrigated ? t("irrigatedYes") : t("irrigatedNo"),
                          activeRaw.tree_count != null ? t("treesCount", { n: activeRaw.tree_count }) : null,
                          active.score != null ? `${active.score}${t("perHundred")}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openEdit}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line px-3 text-ap-pill font-bold text-ink"
                    >
                      {t("editField")}
                    </button>
                  </div>
                </div>
              ) : null}
              <Link
                href={`/farmer/fields/${active.id}/score`}
                className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-line bg-card px-3 text-left"
              >
                <BadgeCheck className="size-4 shrink-0 text-good" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-ap-small font-extrabold text-ink">{t("scoreCta")}</span>
                  <span className="block text-ap-small font-medium text-muted-foreground">{t("scoreCtaHint")}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </>
          ) : showAll && viewFields[0] ? (
            <p className="rounded-xl bg-soft px-3 py-2 text-ap-small text-muted-foreground">{t("pickFieldForScore")}</p>
          ) : null}

          <button
            type="button"
            className="flex min-h-11 w-full items-center rounded-xl bg-risk-soft px-3 text-left"
            onClick={() => {
              const next = trees.find((tr) => tr.status !== "healthy");
              if (next) setSelectedTreeId(next.id);
            }}
          >
            <RefreshCw className="size-4 text-risk" aria-hidden />
            <span className="ml-2 flex-1 text-ap-small font-bold text-ink">
              {t("followUp", { n: showAll ? 0 : followUpCount })}
            </span>
            <span className="text-ap-small font-bold text-risk">{t("view")}</span>
            <ChevronRight className="size-4 text-risk" aria-hidden />
          </button>

          <div className="rounded-2xl border border-line bg-card p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-ap-body font-extrabold text-ink">
                {selectedTree ? t("treeN", { id: selectedTree.id }) : t("treeN", { id: "—" })}
              </p>
              {selectedTree ? (
                <Pill tone={selectedTree.status === "diseased" ? "risk" : selectedTree.status === "suspicious" ? "warn" : "good"}>
                  {selectedTree.status === "diseased"
                    ? t("diseased")
                    : selectedTree.status === "suspicious"
                      ? t("suspicious")
                      : t("healthy")}
                </Pill>
              ) : (
                <span className="rounded-full bg-soft px-2 py-0.5 text-ap-pill font-bold text-muted-foreground">
                  {t("selectTree")}
                </span>
              )}
            </div>
            <p className="mt-1 text-ap-small text-muted-foreground">
              {selectedTree?.issue
                ? threatLabel(selectedTree.issue, tThreats)
                : selectedTree
                  ? t("healthy")
                  : t("noTreeYet")}
            </p>
            <div className="mt-2 flex gap-2">
              <Link
                href="/farmer/scan"
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-ap-pill font-bold text-white"
              >
                <Camera className="size-4" />
                {t("scanTree")}
              </Link>
              <Link
                href={
                  active
                    ? `/farmer/scan?field=${encodeURIComponent(active.id)}`
                    : "/farmer/scan"
                }
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-line bg-card text-ap-pill font-bold text-ink"
              >
                {t("seeScans")}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title={t("fieldMenu")}>
        <button
          type="button"
          onClick={openEdit}
          className="flex h-12 w-full items-center rounded-xl border border-line px-4 text-left text-ap-body font-bold text-ink"
        >
          {t("editField")}
        </button>
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            setDeleteOpen(true);
          }}
          className="flex h-12 w-full items-center rounded-xl border border-risk/30 bg-risk-soft px-4 text-left text-ap-body font-bold text-risk"
        >
          {t("deleteField")}
        </button>
      </BottomSheet>

      <BottomSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t("editField")}
        actionLabel={busy ? t("saving") : t("saveField")}
        onAction={() => void saveEdit()}
      >
        <label className="block text-ap-small font-bold text-muted-foreground">
          {t("fieldName")}
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="mt-1 h-11 w-full rounded-xl border border-line px-3 text-ap-body font-bold text-ink outline-none"
          />
        </label>
        <label className="block text-ap-small font-bold text-muted-foreground">
          {t("numberOfTrees")}
          <input
            value={editTrees}
            inputMode="numeric"
            onChange={(e) => setEditTrees(e.target.value.replace(/[^\d]/g, ""))}
            className="mt-1 h-11 w-full rounded-xl border border-line px-3 text-ap-body font-bold text-ink outline-none"
          />
        </label>
        <div>
          <p className="text-ap-small font-bold text-muted-foreground">{t("oliveVariety")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {varietyGroups.flatMap((g) => g.items).map((v) => (
              <button
                key={v.slug}
                type="button"
                onClick={() => setEditVariety(v.slug)}
                className={cn(
                  "h-9 rounded-full border px-3 text-ap-pill font-bold",
                  editVariety === v.slug ? "border-ink bg-ink text-white" : "border-line bg-card text-ink",
                )}
              >
                {varietyLabel(v, locale)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-ap-small font-bold text-muted-foreground">{t("irrigatedQ")}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setEditIrrigated(true)}
              className={cn(
                "h-9 rounded-full border px-4 text-ap-pill font-bold",
                editIrrigated ? "border-ink bg-ink text-white" : "border-line bg-card text-ink",
              )}
            >
              {t("yes")}
            </button>
            <button
              type="button"
              onClick={() => setEditIrrigated(false)}
              className={cn(
                "h-9 rounded-full border px-4 text-ap-pill font-bold",
                !editIrrigated ? "border-ink bg-ink text-white" : "border-line bg-card text-ink",
              )}
            >
              {t("no")}
            </button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t("deleteField")}
        actionLabel={busy ? t("saving") : t("confirmDelete")}
        onAction={() => void confirmDelete()}
      >
        <p className="text-ap-body text-muted-foreground">
          {t("deleteFieldHint", { name: activeRaw?.name ?? "" })}
        </p>
      </BottomSheet>
    </div>
  );
}
