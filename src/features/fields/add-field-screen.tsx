"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  FileText,
  Leaf,
  ShoppingBasket,
  Sparkles,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { hasSupabaseConfig, publicEnv } from "@/core/config/env";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import type { FieldPolygon } from "@/features/fields/field-map-editor";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { colors } from "@/shared/theme/tokens";
import { cn } from "@/shared/lib/utils";

const FieldMapEditor = dynamic(() => import("./field-map-editor").then((m) => m.FieldMapEditor), {
  ssr: false,
  loading: () => <div className="h-48 animate-pulse rounded-xl bg-soft" />,
});

type Stage = "growing" | "almost" | "harvested";
type Sprays = "0" | "1-2" | "3+";
type Records = "none" | "paper" | "brecete";

const STAGES: { key: Stage; icon: LucideIcon }[] = [
  { key: "growing", icon: Sprout },
  { key: "almost", icon: Leaf },
  { key: "harvested", icon: ShoppingBasket },
];

const PROOFS: Record<Stage, { id: string; labelKey: "proofField" | "proofOlives" | "proofQty" | "proofExpected" | "proofSpray" | "proofSales"; note: "REQUIRED" | "OPTIONAL" }[]> = {
  growing: [
    { id: "field-photo", labelKey: "proofField", note: "REQUIRED" },
    { id: "spray-receipt", labelKey: "proofSpray", note: "OPTIONAL" },
  ],
  almost: [
    { id: "olives-photo", labelKey: "proofOlives", note: "REQUIRED" },
    { id: "quantity", labelKey: "proofExpected", note: "REQUIRED" },
    { id: "spray-receipt", labelKey: "proofSpray", note: "OPTIONAL" },
  ],
  harvested: [
    { id: "olives-photo", labelKey: "proofOlives", note: "REQUIRED" },
    { id: "quantity", labelKey: "proofQty", note: "REQUIRED" },
    { id: "spray-receipt", labelKey: "proofSpray", note: "OPTIONAL" },
    { id: "sales-receipt", labelKey: "proofSales", note: "OPTIONAL" },
  ],
};

const STAGE_TITLE: Record<Stage, "stageGrowing" | "stageAlmost" | "stageHarvested"> = {
  growing: "stageGrowing",
  almost: "stageAlmost",
  harvested: "stageHarvested",
};

const SPRAY_POINTS: Record<Sprays, number> = { "0": 8, "1-2": 4, "3+": 0 };
const RECORD_POINTS: Record<Records, number> = { none: 0, paper: 4, brecete: 8 };

function startingScore(stage: Stage, sprays: Sprays, records: Records, proofs: string[]) {
  const valid = proofs.filter((id) => PROOFS[stage].some((p) => p.id === id)).length;
  return Math.min(95, 54 + SPRAY_POINTS[sprays] + RECORD_POINTS[records] + valid * 3);
}

export function AddFieldScreen() {
  const t = useTranslations("farmerFields");
  const router = useRouter();
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [stage, setStage] = useState<Stage>("harvested");
  const [sprays, setSprays] = useState<Sprays>("1-2");
  const [records, setRecords] = useState<Records>("brecete");
  const [proofs, setProofs] = useState<string[]>(["olives-photo", "spray-receipt"]);
  const [name, setName] = useState("");
  const [polygon, setPolygon] = useState<FieldPolygon | null>(null);
  const [drawOpen, setDrawOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const proofsForStage = PROOFS[stage];
  const added = proofs.filter((id) => proofsForStage.some((p) => p.id === id));
  const score = startingScore(stage, sprays, records, proofs);
  const level = added.length >= 2 ? "evidence" : "self";

  function toggleProof(id: string) {
    setProofs((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function savePolygon() {
    if (!polygon || !hasSupabaseConfig()) return false;
    const supabase = tryCreateBrowserClient();
    if (!supabase) return false;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t("needLogin"));
      return false;
    }
    const { error } = await supabase.rpc("create_field_from_geojson", {
      p_name: name.trim() || t("defaultName"),
      p_geojson: JSON.stringify(polygon),
      p_variety: null,
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    return true;
  }

  async function start() {
    const missing = proofsForStage.filter((p) => p.note === "REQUIRED" && !added.includes(p.id));
    if (missing.length) {
      toast(t("missingProof", { items: missing.map((m) => t(m.labelKey)).join(", ") }));
      return;
    }
    setSaving(true);
    const saved = polygon ? await savePolygon() : false;
    setSaving(false);
    if (saved) toast.success(t("saveOk"));
    else toast.success(t("noted", { score }));
    router.push("/farmer/market");
  }

  const sprayOpts: { key: Sprays; label: string }[] = [
    { key: "0", label: t("spray0") },
    { key: "1-2", label: t("spray12") },
    { key: "3+", label: t("spray3") },
  ];
  const recordOpts: { key: Records; label: string }[] = [
    { key: "none", label: t("recNone") },
    { key: "paper", label: t("recPaper") },
    { key: "brecete", label: t("recB") },
  ];

  return (
    <div className="w-full flex-1">
      <div className="flex items-center gap-3">
        <Link
          href="/farmer/fields"
          aria-label={t("back")}
          className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="flex-1 text-[22px] font-extrabold tracking-tight text-ink">{t("addTitle")}</h1>
        <div className="flex gap-1" aria-hidden>
          <span className="h-1 w-6 rounded-full bg-ink" />
          <span className="h-1 w-6 rounded-full bg-ink" />
          <span className="h-1 w-6 rounded-full bg-line" />
        </div>
      </div>

      <p className="mt-4 mb-1.5 text-ap-small font-bold tracking-[1px] text-muted-foreground uppercase">
        {t("cropNow")}
      </p>
      <div className="flex gap-2">
        {STAGES.map(({ key, icon: Icon }) => {
          const on = stage === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStage(key)}
              className={cn(
                "flex h-[68px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl border",
                on ? "border-good/40 bg-good-soft" : "border-line bg-card",
              )}
            >
              <Icon className="size-5" color={on ? colors.good : colors.ink} aria-hidden />
              <span className={cn("text-ap-body font-bold", on ? "text-good" : "text-ink")}>
                {t(key === "growing" ? "growing" : key === "almost" ? "almost" : "harvested")}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 mb-1.5 text-ap-small font-bold tracking-[1px] text-muted-foreground uppercase">
        {t("lastSeason")}
      </p>
      <div className="flex h-12 items-center justify-between gap-2 rounded-[18px] border border-line bg-card px-3">
        <span className="text-ap-body font-extrabold text-ink">{t("sprays")}</span>
        <div className="flex gap-1.5">
          {sprayOpts.map((opt) => (
            <PillBtn key={opt.key} on={sprays === opt.key} onClick={() => setSprays(opt.key)}>
              {opt.label}
            </PillBtn>
          ))}
        </div>
      </div>
      <div className="mt-2 flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-[18px] border border-line bg-card px-3 py-2">
        <span className="text-ap-body font-extrabold text-ink">{t("records")}</span>
        <div className="flex flex-wrap justify-end gap-1.5">
          {recordOpts.map((opt) => (
            <PillBtn key={opt.key} on={records === opt.key} onClick={() => setRecords(opt.key)}>
              {opt.label}
            </PillBtn>
          ))}
        </div>
      </div>
      <p className="mt-1 px-1 text-ap-small font-medium text-muted-foreground">{t("bNote")}</p>

      <p className="mt-4 mb-1.5 text-ap-small font-bold tracking-[1px] text-muted-foreground uppercase">
        {t("proofFor", { stage: t(STAGE_TITLE[stage]) })}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {proofsForStage.map((p) => {
          const on = added.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggleProof(p.id)}
              className={cn(
                "flex h-[52px] items-center gap-2 rounded-xl px-3 text-left",
                on ? "border border-[#A9BE9C] bg-[#F2F8EE]" : "border border-dashed border-[#C9C6BE] bg-card",
              )}
            >
              {on ? (
                <Check className="size-[18px] shrink-0 text-good" strokeWidth={2.6} aria-hidden />
              ) : (
                <FileText className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="min-w-0">
                <span className={cn("block truncate text-ap-body font-bold", on ? "text-good" : "text-[#555]")}>
                  {t(p.labelKey)}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-bold tracking-[0.5px]",
                    on ? "text-good" : p.note === "REQUIRED" ? "text-risk" : "text-muted-foreground",
                  )}
                >
                  {on ? t("added") : p.note === "REQUIRED" ? t("required") : t("optional")}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-[18px] bg-good-soft p-3">
        <div className="flex items-center">
          <p className="text-[34px] leading-[38px] font-extrabold text-good">{score}</p>
          <div className="ml-3 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-ap-card text-ink">{t("startingScore")}</p>
              <span className="inline-flex h-5 items-center rounded-md bg-warn-soft px-1.5 text-[10px] font-bold text-warn-text">
                {t("estimated")}
              </span>
            </div>
            <p className="text-ap-small font-medium text-muted-foreground">{t("scoreFrom")}</p>
          </div>
        </div>
        <div className="mt-2 flex gap-1.5">
          {(
            [
              ["self", t("selfReported")],
              ["evidence", t("evidenceBased")],
              ["lab", t("labVerified")],
            ] as const
          ).map(([key, label]) => {
            const on = level === key;
            return (
              <span
                key={key}
                className={cn(
                  "flex h-7 flex-1 items-center justify-center gap-1 rounded-lg text-[10.5px] font-bold",
                  on ? "bg-warn-soft text-warn-text" : "bg-black/5 text-muted-foreground",
                )}
              >
                {on ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
                {label}
              </span>
            );
          })}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-ap-small font-medium text-good">
          <Sparkles className="size-3.5 shrink-0" aria-hidden />
          {t("shownBuyers")}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setDrawOpen((v) => !v)}
        className="mt-4 text-ap-body font-bold text-ap-accent"
      >
        {t("drawBoundary")}
      </button>
      {drawOpen ? (
        <div className="mt-2 space-y-2">
          {!token ? (
            <p className="text-ap-small text-muted-foreground">{t("needMapboxBody")}</p>
          ) : (
            <FieldMapEditor token={token} onPolygonChange={(next) => setPolygon(next)} />
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className="h-11 w-full rounded-xl border border-line bg-card px-3 text-ap-body"
          />
        </div>
      ) : null}

      <button
        type="button"
        disabled={saving}
        onClick={() => void start()}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-ap-btn text-white disabled:opacity-50"
      >
        {saving ? t("saving") : t("startSelling")}
        <ArrowRight className="size-[18px]" aria-hidden />
      </button>
    </div>
  );
}

function PillBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-[30px] items-center rounded-full border px-3 text-ap-pill",
        on ? "border-ink bg-ink text-white" : "border-line bg-card text-ink",
      )}
    >
      {children}
    </button>
  );
}
