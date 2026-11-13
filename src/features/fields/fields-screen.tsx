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
import { publicEnv } from "@/core/config/env";
import { Chip, FieldChips } from "@/shared/components/brand";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { FIELD_DOTS, colors } from "@/shared/theme/tokens";

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
  const router = useRouter();
  const { fields, loading } = useFarmerFields();
  const [showHealth, setShowHealth] = useState(true);
  const [selectedId, setSelectedId] = useState<string | "all">("all");
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
            <button
              type="button"
              aria-label={t("layers")}
              onClick={() => toast(t("layersOn"))}
              className="flex size-9 items-center justify-center rounded-full border border-line bg-card"
            >
              <Layers className="size-[18px]" aria-hidden />
            </button>
          </div>

          {loading ? (
            <div className="h-8 animate-pulse rounded-full bg-soft" />
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

          <div className="flex items-center rounded-2xl border border-line bg-card px-2.5 py-1.5">
            <div className="flex-1 text-center">
              <p className="text-ap-body font-extrabold text-ink">
                {displayTrees != null && displayTrees > 0 ? t("treesCount", { n: displayTrees }) : "—"}
              </p>
              <p className="text-[10px] font-medium text-muted-foreground">
                {showAll ? t("treesTotal") : t("treeCount")}
              </p>
            </div>
            <div className="h-7 w-px bg-line" />
            <div className="flex-1 text-center">
              <p className="text-ap-body font-extrabold text-ink">
                {displayHa != null ? t("haCount", { n: formatStremmata(displayHa) }) : "—"}
              </p>
              <p className="text-[10px] font-medium text-muted-foreground">
                {showAll ? t("areaTotal") : t("fieldSize")}
              </p>
            </div>
            <Link
              href="/farmer/quality"
              className="flex flex-[1.3] items-center justify-center gap-1.5 rounded-xl bg-soft py-1"
            >
              <Star
                className="size-4"
                fill={displayScore != null ? colors.good : colors.muted}
                color={displayScore != null ? colors.good : colors.muted}
                aria-hidden
              />
              <span>
                <span className="block text-[10px] font-semibold text-ink">
                  {showAll ? t("avgScore") : t("qualityScore")}
                </span>
                <span className="text-ap-body font-extrabold text-ink">
                  {displayScore != null ? displayScore : "—"}
                  <span className="text-[10px] font-medium text-muted-foreground">{t("perHundred")}</span>
                </span>
              </span>
            </Link>
          </div>
        </div>

        <div className="relative h-[58dvh] max-h-[520px] min-h-[280px] w-full shrink-0 md:h-[62dvh] md:max-h-[640px] md:px-6">
          <div className="absolute inset-0 md:inset-x-6 md:inset-y-0">
            <FieldHealthMap
              className="h-full w-full rounded-none md:rounded-[18px]"
              token={token}
              lat={active?.lat}
              lon={active?.lon}
              geom={active?.geom}
              outlines={mapOutlines}
              trees={[]}
              selectedId={null}
              onSelect={() => undefined}
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
                needToken: t("needMapboxBody"),
              }}
            />
          </div>
        </div>

        <div className="shrink-0 space-y-1.5 border-t border-line bg-background px-4 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom))] md:px-6 md:pb-6">
          {active ? (
            <Link
              href={`/farmer/fields/${active.id}/score`}
              className="flex h-10 w-full items-center gap-2 rounded-xl border border-line bg-card px-3 text-left"
            >
              <BadgeCheck className="size-4 shrink-0 text-good" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-ap-small font-extrabold text-ink">{t("scoreCta")}</span>
                <span className="block text-[10px] font-medium text-muted-foreground">{t("scoreCtaHint")}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          ) : showAll && viewFields[0] ? (
            <p className="rounded-xl bg-soft px-3 py-2 text-ap-small text-muted-foreground">{t("pickFieldForScore")}</p>
          ) : null}

          <button
            type="button"
            className="flex h-9 w-full items-center rounded-xl bg-risk-soft px-3 text-left"
          >
            <RefreshCw className="size-4 text-risk" aria-hidden />
            <span className="ml-2 flex-1 text-ap-small font-bold text-ink">{t("followUp", { n: 0 })}</span>
            <span className="text-ap-small font-bold text-risk">{t("view")}</span>
            <ChevronRight className="size-4 text-risk" aria-hidden />
          </button>

          <div className="rounded-2xl border border-line bg-card p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-ap-body font-extrabold text-ink">{t("treeN", { id: "—" })}</p>
              <span className="rounded-full bg-soft px-2 py-0.5 text-ap-pill font-bold text-muted-foreground">
                {t("selectTree")}
              </span>
            </div>
            <p className="mt-1 text-ap-small text-muted-foreground">{t("noTreeYet")}</p>
            <div className="mt-2 flex gap-2">
              <Link
                href="/farmer/scan"
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-ap-pill font-bold text-white"
              >
                <Camera className="size-4" />
                {t("scanTree")}
              </Link>
              <button
                type="button"
                className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-line bg-card text-ap-pill font-bold text-ink"
              >
                {t("seeScans")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
