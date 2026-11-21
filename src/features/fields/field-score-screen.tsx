"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  isPublishStage,
  PROOFS_BY_STAGE,
  STAGE_TITLE_KEY,
  type CropStage,
  type RecordType,
  type SpraysLastSeason,
} from "@/features/fields/field-score";
import { isPhotoProof, uploadFieldProof } from "@/features/fields/upload-proof";
import { resolveOliveCountry, type OliveCountry } from "@/features/fields/olive-varieties";
import { refreshFieldQuality } from "@/features/quality/refresh-field-quality";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { ApCard } from "@/shared/components/brand";
import type { ProofLevel } from "@/shared/types/database";
import { useRouter } from "@/shared/i18n/navigation";
import { colors } from "@/shared/theme/tokens";
import { cn } from "@/shared/lib/utils";
import { useErrorMessage } from "@/shared/lib/error-message";

const STAGES: { key: CropStage; icon: LucideIcon }[] = [
  { key: "growing", icon: Sprout },
  { key: "almost", icon: Leaf },
  { key: "harvested", icon: ShoppingBasket },
];

type Props = { fieldId: string };

/** Field certification — real proof uploads + single quality_scores value (Χ6). */
export function FieldScoreScreen({ fieldId }: Props) {
  const t = useTranslations("farmerFields");
  const errMsg = useErrorMessage();
  const locale = useLocale();
  const router = useRouter();
  const { fields, loading } = useFarmerFields();
  const field = fields.find((f) => f.id === fieldId) ?? null;

  const [profileCountry, setProfileCountry] = useState<OliveCountry | null>(null);
  const [stage, setStage] = useState<CropStage>("growing");
  const [sprays, setSprays] = useState<SpraysLastSeason>("1-2");
  const [records, setRecords] = useState<RecordType>("brecete");
  const [proofs, setProofs] = useState<string[]>([]);
  const [proofFiles, setProofFiles] = useState<Record<string, string>>({});
  const [proofPreviews, setProofPreviews] = useState<Record<string, string>>({});
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
        proof_files?: Record<string, string>;
      };
      if (parsed.crop_stage) setStage(parsed.crop_stage);
      if (parsed.sprays_last_season) setSprays(parsed.sprays_last_season);
      if (parsed.records) setRecords(parsed.records);
      if (parsed.proofs?.length) setProofs(parsed.proofs);
      if (parsed.proof_files) setProofFiles(parsed.proof_files);
    } catch {
      /* ignore legacy notes */
    }
  }, [field?.id, field?.notes]);

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase || !fieldId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("quality_scores")
        .select("score")
        .eq("field_id", fieldId)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data?.score != null) setQualityScore(Number(data.score));
    })();
    return () => {
      cancelled = true;
    };
  }, [fieldId]);

  const proofsForStage = PROOFS_BY_STAGE[stage];
  const added = proofs.filter((id) => {
    if (!proofsForStage.some((p) => p.id === id)) return false;
    if (isPhotoProof(id)) return Boolean(proofFiles[id]);
    return true;
  });
  const level: ProofLevel = added.length >= 2 ? "evidence_based" : "self_reported";
  const publish = isPublishStage(stage);
  const displayScore = qualityScore;

  function toggleNonPhoto(id: string) {
    if (isPhotoProof(id)) return;
    setProofs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onProofFile(id: string, file: File | null) {
    if (!file) return;
    setUploadingId(id);
    try {
      const result = await uploadFieldProof(file, id);
      if (!result.ok) {
        toast.error(t(result.error === "needLogin" || result.error === "needSupabase" ? result.error : "uploadFailed"));
        return;
      }
      setProofFiles((prev) => ({ ...prev, [id]: result.path }));
      setProofPreviews((prev) => ({ ...prev, [id]: result.preview }));
      setProofs((prev) => (prev.includes(id) ? prev : [...prev, id]));
      toast.success(t("proofUploaded"));
    } finally {
      setUploadingId(null);
    }
  }

  function clearProof(id: string) {
    setProofs((prev) => prev.filter((x) => x !== id));
    setProofFiles((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setProofPreviews((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
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
      const filesForStage = Object.fromEntries(
        Object.entries(proofFiles).filter(([id]) => proofsForStage.some((p) => p.id === id)),
      );
      const notes = JSON.stringify({
        ...baseNotes,
        crop_stage: stage,
        sprays_last_season: sprays,
        records,
        proofs: added,
        proof_files: filesForStage,
        scored_at: new Date().toISOString(),
      });

      const { error } = await supabase
        .from("fields")
        .update({ notes, proof_level: level })
        .eq("id", field.id);

      if (error) {
        toast.error(errMsg(error.message, "saveFailed"));
        return;
      }

      const refreshed = await refreshFieldQuality({
        fieldId: field.id,
        proofLevel: level,
        peakRiskScore: 40,
        stage,
      });
      if (refreshed.ok) {
        setQualityScore(refreshed.data.score);
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
    return (
      <div className="mx-auto w-full max-w-lg animate-pulse space-y-3 px-4 py-6">
        <div className="h-10 rounded-full bg-soft" />
        <div className="h-40 rounded-[18px] bg-soft" />
      </div>
    );
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
    <div className="fixed inset-0 z-40 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-background md:left-60">
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-4 pt-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:max-w-2xl md:px-6 md:pb-8">
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            aria-label={t("back")}
            onClick={() => router.push("/farmer/fields")}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card transition-colors hover:bg-soft"
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
                  "flex min-h-[72px] min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-2 transition-colors",
                  on ? "border-good/40 bg-good-soft" : "border-line bg-card hover:bg-soft/50",
                )}
              >
                <Icon className="size-5 shrink-0" color={on ? colors.good : colors.ink} aria-hidden />
                <span
                  className={cn(
                    "text-center text-[12px] leading-tight font-bold sm:text-ap-body",
                    on ? "text-good" : "text-ink",
                  )}
                >
                  {t(key === "growing" ? "growing" : key === "almost" ? "almost" : "harvested")}
                </span>
              </button>
            );
          })}
        </div>

        <Label>{t("prevSeason")}</Label>
        <p className="mb-2 text-ap-small text-muted-foreground">{t("prevSeasonHint")}</p>
        <ApCard className="flex min-h-12 flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="shrink-0 text-ap-body font-extrabold text-ink">{t("sprays")}</span>
          <div className="flex flex-wrap gap-2">
            {sprayOpts.map((opt) => (
              <PillBtn key={opt.key} on={sprays === opt.key} onClick={() => setSprays(opt.key)}>
                {opt.label}
              </PillBtn>
            ))}
          </div>
        </ApCard>
        <ApCard className="mt-2 flex min-h-12 flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="shrink-0 text-ap-body font-extrabold text-ink">{t("records")}</span>
          <div className="flex flex-wrap gap-2">
            {recordOpts.map((opt) => (
              <PillBtn key={opt.key} on={records === opt.key} onClick={() => setRecords(opt.key)}>
                {opt.label}
              </PillBtn>
            ))}
          </div>
        </ApCard>
        <p className="mt-1.5 px-1 text-ap-small font-medium text-muted-foreground">
          {country === "TR" ? t("bNoteTr") : t("bNoteGr")}
        </p>

        <Label>{t("proofFor", { stage: t(STAGE_TITLE_KEY[stage]) })}</Label>
        <div className="grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
          {proofsForStage.map((p) => {
            const on = added.includes(p.id);
            const photo = isPhotoProof(p.id);
            const preview = proofPreviews[p.id];
            return (
<<<<<<< HEAD
              <button
                key={p.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggleProof(p.id)}
                className={cn(
                  "flex min-h-[56px] items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors",
                  on ? "border border-[#A9BE9C] bg-[#F2F8EE]" : "border border-dashed border-[#C9C6BE] bg-card hover:bg-soft/40",
                )}
              >
                {on ? (
                  <Check className="size-[18px] shrink-0 text-good" strokeWidth={2.6} aria-hidden />
                ) : (
                  <FileText className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-ap-body font-bold", on ? "text-good" : "text-[#555]")}>
                    {t(p.labelKey)}
                  </span>
                  <span
                    className={cn(
                      "block text-[12px] font-bold tracking-[0.4px]",
                      on ? "text-good" : p.note === "REQUIRED" ? "text-risk" : "text-muted-foreground",
                    )}
                  >
                    {on ? t("added") : p.note === "REQUIRED" ? t("required") : t("optional")}
                  </span>
                </span>
              </button>
=======
              <div key={p.id} className="relative">
                {photo ? (
                  <input
                    ref={(el) => {
                      fileRefs.current[p.id] = el;
                    }}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      void onProofFile(p.id, f);
                    }}
                  />
                ) : null}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={uploadingId === p.id}
                  onClick={() => {
                    if (photo) {
                      if (on) clearProof(p.id);
                      else fileRefs.current[p.id]?.click();
                    } else {
                      toggleNonPhoto(p.id);
                    }
                  }}
                  className={cn(
                    "flex h-[52px] w-full items-center gap-2 rounded-xl px-3 text-left disabled:opacity-60",
                    on ? "border border-[#A9BE9C] bg-[#F2F8EE]" : "border border-dashed border-[#C9C6BE] bg-card",
                  )}
                >
                  {on ? (
                    <Check className="size-[18px] shrink-0 text-good" strokeWidth={2.6} aria-hidden />
                  ) : (
                    <FileText className="size-[18px] shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-ap-body font-bold", on ? "text-good" : "text-[#555]")}>
                      {t(p.labelKey)}
                    </span>
                    <span
                      className={cn(
                        "text-[12px] font-bold tracking-[0.5px]",
                        on ? "text-good" : p.note === "REQUIRED" ? "text-risk" : "text-muted-foreground",
                      )}
                    >
                      {uploadingId === p.id
                        ? t("uploading")
                        : on
                          ? t("added")
                          : photo
                            ? t("tapToUpload")
                            : p.note === "REQUIRED"
                              ? t("required")
                              : t("optional")}
                    </span>
                  </span>
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="size-9 shrink-0 rounded-md object-cover" />
                  ) : null}
                </button>
              </div>
>>>>>>> bae40a1a4f39f12c467fc4f9db0d6072f0016e03
            );
          })}
        </div>

        <div className="mt-3.5 rounded-[18px] bg-good-soft p-3.5">
          <div className="flex items-center">
            <p className="text-[34px] leading-[38px] font-extrabold text-good">
              {displayScore != null ? displayScore : "—"}
            </p>
            <div className="ml-3 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
<<<<<<< HEAD
                <p className="text-ap-card text-ink">{t("startingScore")}</p>
                <span className="inline-flex min-h-6 items-center rounded-md bg-warn-soft px-2 text-[12px] font-bold text-warn-text">
                  {t("estimated")}
                </span>
=======
                <p className="text-ap-card text-ink">{t("qualityScore")}</p>
>>>>>>> bae40a1a4f39f12c467fc4f9db0d6072f0016e03
              </div>
              <p className="text-ap-small font-medium text-muted-foreground">
                {displayScore != null ? t("scoreFromQuality") : t("scoreAfterSave")}
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex gap-1.5">
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
<<<<<<< HEAD
                    "flex min-h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1.5 text-[12px] font-bold",
=======
                    "flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-0.5 text-[12px] font-bold sm:text-[10.5px]",
>>>>>>> bae40a1a4f39f12c467fc4f9db0d6072f0016e03
                    on ? "bg-warn-soft text-warn-text" : "bg-black/5 text-muted-foreground",
                  )}
                >
                  {on ? <Check className="size-3.5 shrink-0" strokeWidth={3} aria-hidden /> : null}
                  <span className="truncate">{label}</span>
                </span>
              );
            })}
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-ap-small font-medium text-good">
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
            {publish ? t("shownBuyers") : t("scorePrivateHint")}
          </p>
        </div>

        <button
          type="button"
          disabled={saving || uploadingId != null}
          onClick={() => void submit()}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-ap-btn font-bold text-white transition-opacity disabled:opacity-50"
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
        "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-ap-pill font-bold transition-colors",
        on ? "border-ink bg-ink text-white" : "border-line bg-card text-ink hover:bg-soft",
      )}
    >
      {children}
    </button>
  );
}