"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  BadgeCheck,
  Camera,
  ChevronLeft,
  ChevronRight,
  Layers,
  RefreshCw,
  Star,
} from "lucide-react";
import { formatStremmata } from "@/features/fields/area";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { FieldHealthMap } from "@/features/fields/field-health-map";
import { useFieldTrees } from "@/features/fields/use-field-trees";
import { publicEnv } from "@/core/config/env";
import { ApCard, Chip, FieldChips, Pill } from "@/shared/components/brand";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { FIELD_DOTS, colors } from "@/shared/theme/tokens";
import { threatLabel } from "@/features/weather-risk/threat-labels";

function scoreFromNotes(notes: string | null | undefined): number | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as { starting_score?: unknown };
    const n = Number(parsed.starting_score);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function FieldsScreen() {
  const t = useTranslations("farmerFields");
  const tThreats = useTranslations("riskThreats");
  const router = useRouter();
  const { fields, loading } = useFarmerFields();
  const [showHealth, setShowHealth] = useState(true);
  const [selectedId, setSelectedId] = useState<string | "all">("all");
  const [selectedTreeId, setSelectedTreeId] = useState<number | null>(null);
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;

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
        score: scoreFromNotes(f.notes),
      })),
    [fields],
  );

  useEffect(() => {
    if (selectedId === "all") return;
    if (selectedId && !viewFields.some((f) => f.id === selectedId)) {
      setSelectedId(viewFields.length ? "all" : "");
    }
  }, [selectedId, viewFields]);

  const showAll = selectedId === "all";
  const active = showAll ? null : (viewFields.find((f) => f.id === selectedId) ?? viewFields[0] ?? null);
  const { trees, defaultSelectedId } = useFieldTrees(active?.id);

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
            <button
              type="button"
              aria-label={t("layers")}
              onClick={() => toast(t("layersOn"))}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card transition-colors hover:bg-soft"
            >
              <Layers className="size-[18px]" aria-hidden />
            </button>
          </div>

          {loading ? (
            <div className="h-9 animate-pulse rounded-full bg-soft" />
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

          <ApCard className="flex items-center px-2 py-2">
            <div className="min-w-0 flex-1 px-1 text-center">
              <p className="truncate text-ap-body font-extrabold text-ink">
                {displayTrees != null && displayTrees > 0 ? t("treesCount", { n: displayTrees }) : "—"}
              </p>
              <p className="truncate text-[12px] font-medium text-muted-foreground">
                {showAll ? t("treesTotal") : t("treeCount")}
              </p>
            </div>
            <div className="h-8 w-px shrink-0 bg-line" />
            <div className="min-w-0 flex-1 px-1 text-center">
              <p className="truncate text-ap-body font-extrabold text-ink">
                {displayHa != null ? t("haCount", { n: formatStremmata(displayHa) }) : "—"}
              </p>
              <p className="truncate text-[12px] font-medium text-muted-foreground">
                {showAll ? t("areaTotal") : t("fieldSize")}
              </p>
            </div>
            <Link
              href="/farmer/quality"
              className="flex min-h-11 min-w-0 flex-[1.25] items-center justify-center gap-1.5 rounded-xl bg-soft px-2 py-1.5 transition-colors hover:bg-soft/80"
            >
              <Star
                className="size-4 shrink-0"
                fill={displayScore != null ? colors.good : colors.muted}
                color={displayScore != null ? colors.good : colors.muted}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold text-ink">
                  {showAll ? t("avgScore") : t("qualityScore")}
                </span>
                <span className="text-ap-body font-extrabold text-ink">
                  {displayScore != null ? displayScore : "—"}
                  <span className="text-[12px] font-medium text-muted-foreground">{t("perHundred")}</span>
                </span>
              </span>
            </Link>
          </ApCard>
        </div>

        <div className="relative h-[54dvh] max-h-[520px] min-h-[280px] w-full shrink-0 md:h-[62dvh] md:max-h-[640px] md:px-6">
          <div className="absolute inset-0 md:inset-x-6 md:inset-y-0">
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
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-line bg-background px-4 pt-2.5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:pb-6">
          {active ? (
            <Link
              href={`/farmer/fields/${active.id}/score`}
              className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-line bg-card px-3.5 py-2 text-left transition-colors hover:bg-soft/50"
            >
              <BadgeCheck className="size-4 shrink-0 text-good" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-ap-small font-extrabold text-ink">{t("scoreCta")}</span>
                <span className="block text-[12px] font-medium text-muted-foreground">{t("scoreCtaHint")}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          ) : showAll && viewFields[0] ? (
            <p className="rounded-xl bg-soft px-3.5 py-2.5 text-ap-small text-muted-foreground">{t("pickFieldForScore")}</p>
          ) : null}

          <button
            type="button"
            className="flex min-h-11 w-full items-center rounded-xl bg-risk-soft px-3.5 py-2 text-left transition-opacity hover:opacity-95"
            onClick={() => {
              const next = trees.find((tr) => tr.status !== "healthy");
              if (next) setSelectedTreeId(next.id);
            }}
          >
            <RefreshCw className="size-4 shrink-0 text-risk" aria-hidden />
            <span className="ml-2.5 min-w-0 flex-1 truncate text-ap-small font-bold text-ink">
              {t("followUp", { n: showAll ? 0 : followUpCount })}
            </span>
            <span className="shrink-0 text-ap-small font-bold text-risk">{t("view")}</span>
            <ChevronRight className="size-4 shrink-0 text-risk" aria-hidden />
          </button>

          <ApCard className="p-3">
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
                <Pill tone="neutral">{t("selectTree")}</Pill>
              )}
            </div>
            <p className="mt-1 text-ap-small text-muted-foreground">
              {selectedTree?.issue
                ? threatLabel(selectedTree.issue, tThreats)
                : selectedTree
                  ? t("healthy")
                  : t("noTreeYet")}
            </p>
            <div className="mt-2.5 flex gap-2">
              <Link
                href="/farmer/scan"
                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-3 text-[12px] font-bold text-white transition-colors hover:bg-primary/90"
              >
                <Camera className="size-4 shrink-0" />
                <span className="truncate">{t("scanTree")}</span>
              </Link>
              <button
                type="button"
                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-full border border-line bg-card px-3 text-[12px] font-bold text-ink transition-colors hover:bg-soft"
              >
                <span className="truncate">{t("seeScans")}</span>
              </button>
            </div>
          </ApCard>
        </div>
      </div>
    </div>
  );
}