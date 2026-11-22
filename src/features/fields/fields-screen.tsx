"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Layers,
  MoreHorizontal,
  RefreshCw,
  Star,
} from "lucide-react";
import { formatAreaValue } from "@/features/fields/area";
import {
  TREE_SOURCE_MESSAGE_KEY,
  parseTreeCountSource,
  sourceAfterEdit,
  withTreeCountSource,
} from "@/features/fields/tree-count-source";
import { formatRelativeAge, relativeAge } from "@/features/fields/field-summary";
import { useFieldSummary } from "@/features/fields/use-field-summary";
import { LOCATION_FAILURE_MESSAGE_KEY } from "@/features/fields/map-location";
import { useMapStartView } from "@/features/fields/use-map-start-view";
import { deleteFarmerField, updateFarmerField } from "@/features/fields/field-mutations";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
// Mapbox (~1 MB) is only fetched when a map is actually on screen.
const FieldHealthMap = dynamic(() => import("@/features/fields/field-health-map").then((m) => m.FieldHealthMap), {
  ssr: false,
  loading: () => <div className="w-full animate-pulse rounded-[18px] bg-soft" style={{ height: 320 }} />,
});
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
import { ApCard, Chip, FieldChips, Pill } from "@/shared/components/brand";
import { Link, useRouter } from "@/shared/i18n/navigation";
import type { Field } from "@/shared/types/database";
import { FIELD_DOTS, colors } from "@/shared/theme/tokens";
import { threatLabel } from "@/features/weather-risk/threat-labels";
import { cn } from "@/shared/lib/utils";
import { parseTreeCount, useErrorMessage } from "@/shared/lib/error-message";

export function FieldsScreen() {
  const t = useTranslations("farmerFields");
  const errMsg = useErrorMessage();
  const tThreats = useTranslations("riskThreats");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { fields, loading, reload } = useFarmerFields();
  const { view: startView, ready: startReady } = useMapStartView(locale, fields);
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
  const summary = useFieldSummary(active?.id);

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
    const trees = editTrees.trim() === "" ? null : parseTreeCount(editTrees);
    if (editTrees.trim() !== "" && trees == null) {
      toast.error(t("invalidTrees"));
      return;
    }
    setBusy(true);
    try {
      const nextSource = sourceAfterEdit(
        activeRaw.tree_count,
        trees == null ? null : Math.round(trees),
        parseTreeCountSource(activeRaw.notes),
      );
      const res = await updateFarmerField({
        notes: nextSource ? withTreeCountSource(activeRaw.notes, nextSource) : undefined,
        fieldId: activeRaw.id,
        name: editName,
        treeCount: trees == null ? null : Math.round(trees),
        varietySlug: editVariety,
        irrigated: editIrrigated,
      });
      if (!res.ok) {
        toast.error(res.error === "needName" ? t("needName") : errMsg(res.error, "saveFailed"));
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
        toast.error(errMsg(res.error, "saveFailed"));
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
  const lastScanAge = relativeAge(summary.lastScanAt);
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

  const mapPoints = useMemo(
    () => (showAll ? viewFields.map((f) => ({ lat: f.lat, lon: f.lon })) : undefined),
    [showAll, viewFields],
  );

  const displayTrees = showAll ? totals.trees : active?.trees;
  const activeTreeSource = parseTreeCountSource(activeRaw?.notes);
  const displayHa = showAll ? (totals.ha > 0 ? totals.ha : null) : active?.ha != null ? Number(active.ha) : null;
  const displayScore = showAll ? totals.avgScore : active?.score ?? null;
  const area = displayHa != null ? formatAreaValue(displayHa, locale) : null;
  // Where a score comes from: the Certify & sell flow of the selected (or first) field.
  const scoreTargetId = active?.id ?? viewFields[0]?.id ?? null;
  const scoreHref = displayScore != null || !scoreTargetId ? "/farmer/quality" : `/farmer/fields/${scoreTargetId}/score`;

  return (
    <div className="fixed inset-0 z-40 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-background md:left-60">
      <div className="flex min-h-full flex-col">
        <div className="shrink-0 space-y-2 px-4 pt-2 pb-2 md:px-6 md:pt-3">
          <div className="flex items-center gap-3">
            <Link
              href="/farmer/dashboard"
              aria-label={t("back")}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card transition-colors hover:bg-soft"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </Link>
            <h1 className="min-w-0 flex-1 truncate text-[20px] font-extrabold tracking-tight text-ink">
              {showAll ? t("allFieldsTitle") : t("myField")}
            </h1>
            {activeRaw ? (
              <button
                type="button"
                aria-label={t("fieldMenu")}
                onClick={() => setMenuOpen(true)}
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card transition-colors hover:bg-soft"
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
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card transition-colors hover:bg-soft"
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
                <Chip on={false} onClick={() => router.push("/farmer/fields/new")} className="min-h-9">
                  <span className="text-ap-pill font-bold text-ink">{t("add")}</span>
                </Chip>
              }
            />
          )}

          <ApCard className="grid grid-cols-3 items-stretch gap-1 px-1.5 py-2">
            <div className="flex min-w-0 flex-col items-center justify-center px-1 text-center">
              <p className="text-ap-body font-extrabold whitespace-nowrap text-ink">
                {displayTrees != null && displayTrees > 0 ? displayTrees.toLocaleString(locale) : "—"}
              </p>
              <p className="text-[11px] leading-tight font-medium text-muted-foreground">
                {showAll ? t("treesTotal") : t("treeCount")}
              </p>
              {!showAll && activeTreeSource && displayTrees != null && displayTrees > 0 ? (
                <p className="mt-0.5 text-[10px] leading-tight font-semibold text-ap-accent">
                  {t(TREE_SOURCE_MESSAGE_KEY[activeTreeSource])}
                </p>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col items-center justify-center border-x border-line px-1 text-center">
              <p className="text-ap-body font-extrabold whitespace-nowrap text-ink">
                {area ? (
                  <>
                    {area.value}
                    <span className="ml-1 text-ap-small font-bold text-muted-foreground">{t(`unit_${area.unit}`)}</span>
                  </>
                ) : (
                  "—"
                )}
              </p>
              <p className="text-[11px] leading-tight font-medium text-muted-foreground">
                {showAll ? t("areaTotal") : t("fieldSize")}
              </p>
            </div>
            <Link
              href={scoreHref}
              className="flex min-w-0 flex-col items-center justify-center rounded-xl bg-soft px-1.5 py-1 text-center transition-colors hover:bg-soft/80"
            >
              <p className="flex items-center gap-1 text-ap-body font-extrabold whitespace-nowrap text-ink">
                <Star
                  className="size-3.5 shrink-0"
                  fill={displayScore != null ? colors.good : colors.muted}
                  color={displayScore != null ? colors.good : colors.muted}
                  aria-hidden
                />
                {displayScore != null ? (
                  <span>
                    {displayScore}
                    <span className="text-ap-small font-medium text-muted-foreground">{t("perHundred")}</span>
                  </span>
                ) : (
                  <span className="text-ap-small font-bold text-muted-foreground">{t("noScoreYet")}</span>
                )}
              </p>
              <p className="text-[11px] leading-tight font-medium text-muted-foreground">
                {showAll ? t("avgScore") : t("qualityScore")}
              </p>
            </Link>
          </ApCard>

          {displayScore == null && viewFields.length > 0 ? (
            <Link
              href={scoreHref}
              className="flex items-start gap-2 rounded-xl bg-soft px-3 py-2 text-ap-small text-muted-foreground transition-colors hover:bg-soft/70"
            >
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-good" aria-hidden />
              <span>{t("noScoreHow", { cta: t("scoreCta") })}</span>
            </Link>
          ) : null}
        </div>

        <div className="relative h-[50dvh] max-h-[520px] min-h-[260px] w-full shrink-0 overflow-hidden md:h-[62dvh] md:max-h-[640px] md:px-6">
          <div className="absolute inset-0 md:inset-x-6 md:inset-y-0">
            {loading || !startReady ? (
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
                points={mapPoints}
                startView={startView}
                areaHa={active?.ha != null ? Number(active.ha) : null}
                trees={showAll ? [] : trees}
                selectedId={selectedTreeId}
                onSelect={setSelectedTreeId}
                showHealth={showHealth}
                onToggleHealth={setShowHealth}
                onLocate={() => toast(t("located"))}
                onLocateError={(reason) => toast.error(tCommon(LOCATION_FAILURE_MESSAGE_KEY[reason]))}
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

        <div className="shrink-0 space-y-2 border-t border-line bg-background px-4 pt-2.5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:pb-6">
          {active ? (
            <>
              {activeRaw ? (
                <div className="rounded-xl border border-line bg-card px-3.5 py-2.5">
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
                      {activeRaw.tree_count != null && activeTreeSource ? (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-ap-small font-semibold text-muted-foreground">
                          <span className={activeTreeSource === "farmer" ? "text-good" : undefined}>
                            {t(TREE_SOURCE_MESSAGE_KEY[activeTreeSource])}
                          </span>
                          <button
                            type="button"
                            onClick={openEdit}
                            className="min-h-11 font-bold text-ap-accent"
                          >
                            {t("editTreeCount")}
                          </button>
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={openEdit}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line px-3 text-ap-pill font-bold text-ink transition-colors hover:bg-soft"
                    >
                      {t("editField")}
                    </button>
                  </div>
                </div>
              ) : null}
              <Link
                href={`/farmer/fields/${active.id}/score`}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-line bg-card px-3.5 py-2 text-left transition-colors hover:bg-soft/50"
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
            <p className="rounded-xl bg-soft px-3.5 py-2.5 text-ap-small text-muted-foreground">{t("pickFieldForScore")}</p>
          ) : null}

          {!showAll && trees.length > 0 ? (
            followUpCount > 0 ? (
              <button
                type="button"
                className="flex min-h-11 w-full items-center rounded-xl bg-risk-soft px-3.5 py-2 text-left transition-opacity hover:opacity-95"
                onClick={() => {
                  const next = trees.find((tr) => tr.status !== "healthy");
                  if (next) setSelectedTreeId(next.id);
                }}
              >
                <RefreshCw className="size-4 shrink-0 text-risk" aria-hidden />
                <span className="ml-2.5 min-w-0 flex-1 text-ap-small font-bold text-ink">
                  {t("followUp", { n: followUpCount })}
                </span>
                <span className="shrink-0 text-ap-small font-bold text-risk">{t("view")}</span>
                <ChevronRight className="size-4 shrink-0 text-risk" aria-hidden />
              </button>
            ) : (
              <div className="flex min-h-11 w-full items-center rounded-xl bg-good-soft px-3.5 py-2">
                <CheckCircle2 className="size-4 shrink-0 text-good" aria-hidden />
                <span className="ml-2.5 min-w-0 flex-1 text-ap-small font-bold text-ink">{t("allTreesHealthy")}</span>
              </div>
            )
          ) : null}

          {active ? (
            <ApCard className="p-3">
              {selectedTree ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-ap-body font-extrabold text-ink">{t("treeN", { id: selectedTree.id })}</p>
                    <Pill
                      tone={
                        selectedTree.status === "diseased"
                          ? "risk"
                          : selectedTree.status === "suspicious"
                            ? "warn"
                            : "good"
                      }
                    >
                      {selectedTree.status === "diseased"
                        ? t("diseased")
                        : selectedTree.status === "suspicious"
                          ? t("suspicious")
                          : t("healthy")}
                    </Pill>
                  </div>
                  <p className="mt-1 text-ap-small text-muted-foreground">
                    {selectedTree.issue ? threatLabel(selectedTree.issue, tThreats) : t("healthy")}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-ap-body font-extrabold text-ink">{t("fieldSummary")}</p>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="min-w-0 rounded-lg bg-soft px-1.5 py-2">
                      <dd className="text-ap-body font-extrabold text-ink">
                        {active.score != null ? active.score : "—"}
                      </dd>
                      <dt className="text-[11px] leading-tight font-medium text-muted-foreground">{t("qualityScore")}</dt>
                    </div>
                    <div className="min-w-0 rounded-lg bg-soft px-1.5 py-2">
                      <dd className="text-ap-small font-extrabold text-ink">
                        {lastScanAge ? formatRelativeAge(lastScanAge, locale) : "—"}
                      </dd>
                      <dt className="text-[11px] leading-tight font-medium text-muted-foreground">{t("lastScan")}</dt>
                    </div>
                    <div className="min-w-0 rounded-lg bg-soft px-1.5 py-2">
                      <dd className="text-ap-body font-extrabold text-ink">
                        {summary.openTasks != null ? summary.openTasks : "—"}
                      </dd>
                      <dt className="text-[11px] leading-tight font-medium text-muted-foreground">{t("openTasks")}</dt>
                    </div>
                  </dl>
                  <p className="mt-2 text-ap-small text-muted-foreground">
                    {trees.length > 0 ? t("tapTreeHint") : t("noTreeYet")}
                  </p>
                </>
              )}
              <div className="mt-2.5 flex gap-2">
                <Link
                  href={`/farmer/scan?field=${encodeURIComponent(active.id)}`}
                  className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-3 text-[12px] font-bold text-white transition-colors hover:bg-primary/90"
                >
                  <Camera className="size-4 shrink-0" />
                  <span className="truncate">{selectedTree ? t("scanTree") : t("scanField")}</span>
                </Link>
                <Link
                  href={`/farmer/scan?field=${encodeURIComponent(active.id)}`}
                  className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-full border border-line bg-card px-3 text-[12px] font-bold text-ink transition-colors hover:bg-soft"
                >
                  <span className="truncate">{t("seeScans")}</span>
                </Link>
              </div>
            </ApCard>
          ) : null}
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
        onAction={() => saveEdit()}
      >
        <label className="block text-ap-small font-bold text-muted-foreground">
          {t("fieldName")}
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            maxLength={80}
            className="mt-1 h-11 w-full rounded-xl border border-line px-3 text-ap-body font-bold text-ink outline-none"
          />
        </label>
        <label className="block text-ap-small font-bold text-muted-foreground">
          {t("numberOfTrees")}
          <input
            value={editTrees}
            inputMode="numeric"
            onChange={(e) => setEditTrees(e.target.value.slice(0, 7))}
            aria-invalid={editTrees.trim() !== "" && parseTreeCount(editTrees) == null}
            className="mt-1 h-11 w-full rounded-xl border border-line px-3 text-ap-body font-bold text-ink outline-none"
          />
          {activeRaw && parseTreeCount(editTrees) != null ? (
            <span className="mt-1 block text-ap-small font-bold text-muted-foreground">
              {(() => {
                const s = sourceAfterEdit(
                  activeRaw.tree_count,
                  Math.round(parseTreeCount(editTrees) as number),
                  parseTreeCountSource(activeRaw.notes),
                );
                return s ? t(TREE_SOURCE_MESSAGE_KEY[s]) : null;
              })()}
            </span>
          ) : null}
          {editTrees.trim() !== "" && parseTreeCount(editTrees) == null ? (
            <span className="mt-1 block text-ap-small font-semibold text-risk" role="alert">
              {t("invalidTrees")}
            </span>
          ) : null}
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
        onAction={() => confirmDelete()}
      >
        <p className="text-ap-body text-muted-foreground">
          {t("deleteFieldHint", { name: activeRaw?.name ?? "" })}
        </p>
      </BottomSheet>
    </div>
  );
}
