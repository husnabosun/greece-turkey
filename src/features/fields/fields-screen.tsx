"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Layers,
  RefreshCw,
  Star,
} from "lucide-react";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { FieldHealthMap } from "@/features/fields/field-health-map";
import { Chip, FieldChips } from "@/shared/components/brand";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { FIELD_DOTS, colors } from "@/shared/theme/tokens";

export function FieldsScreen() {
  const t = useTranslations("farmerFields");
  const router = useRouter();
  const { fields, loading } = useFarmerFields();
  const [showHealth, setShowHealth] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");

  const viewFields = useMemo(
    () =>
      fields.map((f, i) => ({
        id: f.id,
        name: f.name,
        color: FIELD_DOTS[i % FIELD_DOTS.length],
        trees: f.tree_count,
        ha: f.area_ha,
      })),
    [fields],
  );

  useEffect(() => {
    if (!selectedId && viewFields[0]) setSelectedId(viewFields[0].id);
    if (selectedId && !viewFields.some((f) => f.id === selectedId)) {
      setSelectedId(viewFields[0]?.id ?? "");
    }
  }, [selectedId, viewFields]);

  const active = viewFields.find((f) => f.id === selectedId) ?? viewFields[0];

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background md:left-60">
      <div className="shrink-0 space-y-2.5 px-4 pt-3 pb-2 md:px-6 md:pt-4">
        <div className="flex items-center gap-3">
          <Link
            href="/farmer/dashboard"
            aria-label={t("back")}
            className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <h1 className="flex-1 text-[22px] font-extrabold tracking-tight text-ink">{t("myField")}</h1>
          <button
            type="button"
            aria-label={t("layers")}
            onClick={() => toast(t("layersOn"))}
            className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
          >
            <Layers className="size-[18px]" aria-hidden />
          </button>
        </div>

        {loading ? (
          <div className="h-8 animate-pulse rounded-full bg-soft" />
        ) : (
          <FieldChips
            fields={viewFields.map((f) => ({ id: f.id, name: f.name, color: f.color }))}
            selected={active?.id ?? ""}
            onSelect={(id) => {
              if (id === "all") return;
              setSelectedId(id);
            }}
            trailing={
              <Chip on={false} onClick={() => router.push("/farmer/fields/new")}>
                <span className="text-ap-pill font-bold text-ink">{t("add")}</span>
              </Chip>
            }
          />
        )}

        <div className="flex items-center rounded-[18px] border border-line bg-card p-2.5">
          <div className="flex-1 text-center">
            <p className="text-ap-card text-ink">
              {active?.trees != null ? t("treesCount", { n: active.trees }) : "—"}
            </p>
            <p className="text-ap-small font-medium text-muted-foreground">{t("treeCount")}</p>
          </div>
          <div className="h-8 w-px bg-line" />
          <div className="flex-1 text-center">
            <p className="text-ap-card text-ink">
              {active?.ha != null ? t("haCount", { n: Number(active.ha).toFixed(1) }) : "—"}
            </p>
            <p className="text-ap-small font-medium text-muted-foreground">{t("fieldSize")}</p>
          </div>
          <Link
            href="/farmer/quality"
            className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-soft py-1.5"
          >
            <Star className="size-5" fill={colors.muted} color={colors.muted} aria-hidden />
            <span>
              <span className="block text-ap-small font-semibold text-ink">{t("qualityScore")}</span>
              <span className="text-ap-card text-ink">
                —
                <span className="text-ap-small font-medium text-muted-foreground">{t("perHundred")}</span>
              </span>
            </span>
          </Link>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 px-0 md:px-6">
        <FieldHealthMap
          className="h-full rounded-none md:rounded-[18px]"
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
          }}
        />
      </div>

      <div className="shrink-0 space-y-2.5 border-t border-line bg-background px-4 pt-2.5 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:px-6 md:pb-4">
        <button
          type="button"
          className="flex h-10 w-full items-center rounded-xl bg-risk-soft px-3 text-left"
        >
          <RefreshCw className="size-[18px] text-risk" aria-hidden />
          <span className="ml-2.5 flex-1 text-ap-body font-bold text-ink">{t("followUp", { n: 0 })}</span>
          <span className="text-ap-body font-bold text-risk">{t("view")}</span>
          <ChevronRight className="size-4 text-risk" aria-hidden />
        </button>

        <div className="rounded-[18px] border border-line bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-ap-card text-ink">{t("treeN", { id: "—" })}</p>
            <span className="rounded-full bg-soft px-2.5 py-1 text-ap-pill font-bold text-muted-foreground">
              {t("selectTree")}
            </span>
          </div>
          <p className="mt-2 text-ap-body text-muted-foreground">{t("noTreeYet")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-ap-small text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Camera className="size-3.5" /> —
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5" /> —
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <Link
              href="/farmer/scan"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-ap-btn font-bold text-white"
            >
              <Camera className="size-4" />
              {t("scanTree")}
            </Link>
            <button
              type="button"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-line bg-card text-ap-btn font-bold text-ink"
            >
              {t("seeScans")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
