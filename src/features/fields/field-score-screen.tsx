"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { hasSupabaseConfig } from "@/core/config/env";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import {
  estimateTrustScore,
  isPublishStage,
  PROOFS_BY_STAGE,
  STAGE_TITLE_KEY,
  type CropStage,
  type RecordType,
  type SpraysLastSeason,
} from "@/features/fields/field-score";
import { resolveOliveCountry, type OliveCountry } from "@/features/fields/olive-varieties";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import type { ProofLevel } from "@/shared/types/database";
import { useRouter } from "@/shared/i18n/navigation";
import { colors } from "@/shared/theme/tokens";
import { cn } from "@/shared/lib/utils";

const STAGES: { key: CropStage; icon: LucideIcon }[] = [
  { key: "growing", icon: Sprout },
  { key: "almost", icon: Leaf },
  { key: "harvested", icon: ShoppingBasket },
];

type Props = { fieldId: string };

/** Field certification / trust score — separate from field onboarding. */
export function FieldScoreScreen({ fieldId }: Props) {
  const t = useTranslations("farmerFields");
  const locale = useLocale();
  const router = useRouter();
  const { fields, loading } = useFarmerFields();
  const field = fields.find((f) => f.id === fieldId) ?? null;

  const [profileCountry, setProfileCountry] = useState<OliveCountry | null>(null);
  const [stage, setStage] = useState<CropStage>("growing");
  const [sprays, setSprays] = useState<SpraysLastSeason>("1-2");
  const [records, setRecords] = useState<RecordType>("brecete");
  const [proofs, setProofs] = useState<string[]>(["field-photo"]);
  const [saving, setSaving] = useState(false);

  const country = useMemo(
    () =>
      resolveOliveCountry({
        locale,
        lon: field?.lon,
        profileCountry,
      }).country,
    [locale, field?.lon, profileCountry],
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
      if (data?.country === "GR" || data?.country === "TR") setProfileCountry(data.country);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!field?.notes) return;
    try {
      const parsed = JSON.parse(field.notes) as {
        crop_stage?: CropStage;
        sprays_last_season?: SpraysLastSeason;
        records?: RecordType;
        proofs?: string[];
      };
      if (parsed.crop_stage) setStage(parsed.crop_stage);
      if (parsed.sprays_last_season) setSprays(parsed.sprays_last_season);
      if (parsed.records) setRecords(parsed.records);
      if (parsed.proofs?.length) setProofs(parsed.proofs);
    } catch {
      /* ignore legacy notes */
    }
  }, [field?.id, field?.notes]);

  const proofsForStage = PROOFS_BY_STAGE[stage];
  const added = proofs.filter((id) => proofsForStage.some((p) => p.id === id));
  const score = estimateTrustScore(stage, sprays, records, proofs);
  const level: ProofLevel = added.length >= 2 ? "evidence_based" : "self_reported";
  const publish = isPublishStage(stage);

  function toggleProof(id: string) {
    setProofs((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function submit() {
    const missing = proofsForStage.filter((p) => p.note === "REQUIRED" && !added.includes(p.id));
    if (missing.length) {
      toast.error(t("missingProof", { items: missing.map((m) => t(m.labelKey)).join(", ") }));
      return;
    }
    if (!field) {
      toast.error(t("needField"));
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
      let baseNotes: Record<string, unknown> = {};
      if (field.notes) {
        try {
          baseNotes = JSON.parse(field.notes) as Record<string, unknown>;
        } catch {
          baseNotes = {};
        }
      }
      const notes = JSON.stringify({
        ...baseNotes,
        crop_stage: stage,
        sprays_last_season: sprays,
        records,
        proofs: added,
        starting_score: score,
        scored_at: new Date().toISOString(),
      });

      const { error } = await supabase
        .from("fields")
        .update({ notes, proof_level: level })
        .eq("id", field.id);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(t(publish ? "publishOk" : "scoreSaved"));
      if (publish) {
        router.push(`/farmer/market/new?field=${field.id}`);
      } else {
        router.push("/farmer/fields");
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const sprayOpts: { key: SpraysLastSeason; label: string }[] = [
    { key: "0", label: t("spray0") },
    { key: "1-2", label: t("spray12") },
    { key: "3+", label: t("spray3") },
  ];
  const recordOpts: { key: RecordType; label: string }[] = [
    { key: "none", label: t("recNone") },
    { key: "paper", label: t("recPaper") },
    { key: "brecete", label: t("recB") },
  ];

  if (loading) {
    return <div className="mx-auto w-full max-w-lg animate-pulse space-y-3 px-4 py-6"><div className="h-10 rounded-full bg-soft" /><div className="h-40 rounded-[18px] bg-soft" /></div>;
  }

  if (!field) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <p className="text-ap-body text-muted-foreground">{t("needField")}</p>
        <button
          type="button"
          onClick={() => router.push("/farmer/fields")}
          className="mt-4 inline-flex h-11 items-center rounded-full bg-ink px-5 text-ap-btn font-bold text-white"
        >
          {t("back")}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto overscroll-y-contain bg-background md:left-60">
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-4 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom))] md:max-w-2xl md:px-6 md:pb-8">
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            aria-label={t("back")}
            onClick={() => router.push("/farmer/fields")}
            className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[20px] font-extrabold tracking-tight text-ink">{t("scoreTitle")}</h1>
            <p className="truncate text-ap-small text-muted-foreground">{field.name}</p>
          </div>
        </div>

        <Label>{t("cropNow")}</Label>
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

        <Label>{t("prevSeason")}</Label>
        <p className="mb-1.5 text-ap-small text-muted-foreground">{t("prevSeasonHint")}</p>
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
        <p className="mt-1 px-1 text-ap-small font-medium text-muted-foreground">
          {country === "TR" ? t("bNoteTr") : t("bNoteGr")}
        </p>

        <Label>{t("proofFor", { stage: t(STAGE_TITLE_KEY[stage]) })}</Label>
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
                ["self_reported", t("selfReported")],
                ["evidence_based", t("evidenceBased")],
                ["lab_verified", t("labVerified")],
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
            {publish ? t("shownBuyers") : t("scorePrivateHint")}
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-ap-btn font-bold text-white disabled:opacity-50"
        >
          <ArrowRight className="size-[18px]" aria-hidden />
          {saving ? t("saving") : publish ? t("ctaPublishLot") : t("ctaSaveScore")}
        </button>
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
