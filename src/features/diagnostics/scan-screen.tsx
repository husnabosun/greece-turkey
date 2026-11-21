"use client";

import { useErrorMessage } from "@/shared/lib/error-message";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Bug,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CloudRain,
  History,
  Image as ImageIcon,
  Leaf,
  Loader2,
  Plus,
  RefreshCw,
  Tag,
  TriangleAlert,
  Scissors,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { saveFarmerScan } from "@/features/diagnostics/save-scan";
import { localizedScanTitle } from "@/features/diagnostics/scan-title";
import type { ActionKind, CaptureMode, PillKey, Presented, SavedScan } from "@/features/diagnostics/scan-types";
import { scanNeedsRecheck, useFarmerScans } from "@/features/diagnostics/use-farmer-scans";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { varietyAgronomyContext } from "@/features/fields/olive-varieties";
import { completeTasksAfterScan } from "@/features/tasks/use-farmer-tasks";
import { AiTag, ApButton, Chip, FieldChips, Pill, PrivacyLine, SectionHeader, type PillTone } from "@/shared/components/brand";
import { Link, usePathname, useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { FIELD_DOTS } from "@/shared/theme/tokens";

type View = "list" | "camera" | "result";

/** Inline guidance shown on the review screen when the AI could not give a result. */
type Notice = "unavailable" | "rateLimited" | "notLeaf" | "lowConfidence";
const NOTICE_RETRY: Record<Notice, boolean> = {
  unavailable: true,
  rateLimited: true,
  notLeaf: false,
  lowConfidence: false,
};

type TFn = (key: string, values?: Record<string, string | number>) => string;

const LATIN = {
  peacock: "Spilocaea oleaginea",
  mite: "Aculus olearius",
  fly: "Bactrocera oleae",
} as const;

export function ScanScreen() {
  const t = useTranslations("farmerScan");
  const tTasks = useTranslations("farmerTasks");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { fields, loading: fieldsLoading } = useFarmerFields();
  const { scans, loading: scansLoading, setScans, error: scansError } = useFarmerScans();
  const [view, setView] = useState<View>("list");
  const [mode, setMode] = useState<CaptureMode>("leaf");
  const [filter, setFilter] = useState<string | "all">("all");
  const [onlyDue, setOnlyDue] = useState(false);
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [treeId, setTreeId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Demo / unsaved result shown once — never written to DB or history. */
  const [ephemeralScan, setEphemeralScan] = useState<SavedScan | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const bootstrappedParams = useRef(false);
  const libraryRef = useRef<HTMLInputElement>(null);
  const shutterRef = useRef<HTMLInputElement>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);

  const viewFields = useMemo(
    () =>
      fields.map((f, i) => ({
        id: f.id,
        name: f.name,
        color: FIELD_DOTS[i % FIELD_DOTS.length],
        variety: f.variety,
        variety_slug: f.variety_slug ?? null,
      })),
    [fields],
  );

  useEffect(() => {
    if (!fieldId && viewFields[0]) setFieldId(viewFields[0].id);
    if (fieldId && !viewFields.some((f) => f.id === fieldId)) setFieldId(viewFields[0]?.id ?? null);
  }, [fieldId, viewFields]);

  useEffect(() => {
    if (filter !== "all" && !viewFields.some((f) => f.id === filter)) setFilter("all");
  }, [filter, viewFields]);

  const syncingUrl = useRef(false);

  /** Deep-link from a task / shareable scan URLs (?view=&id=). */
  useEffect(() => {
    if (bootstrappedParams.current) return;
    if (fieldsLoading) return;

    const wantsCamera = searchParams.get("camera") === "1";
    const qView = searchParams.get("view");
    const qId = searchParams.get("id");
    const qField = searchParams.get("fieldId");
    const qMode = searchParams.get("mode");
    const qTask = searchParams.get("taskId");
    const qTree = searchParams.get("treeId");

    const hasDeepLink = wantsCamera || qView || qId || qField || qMode || qTask || qTree;
    if (!hasDeepLink) {
      bootstrappedParams.current = true;
      return;
    }

    bootstrappedParams.current = true;
    if (qField && viewFields.some((f) => f.id === qField)) {
      setFieldId(qField);
      setFilter(qField);
    }
    if (qMode === "leaf" || qMode === "fruit" || qMode === "trap") setMode(qMode);
    if (qTask) setTaskId(qTask);
    if (qTree) setTreeId(qTree);

    if (qView === "result" && qId) {
      setActiveId(qId);
      setView("result");
      return;
    }
    if (wantsCamera || qView === "camera") {
      setPhotos([]);
      setAnalysing(false);
      setPicking(false);
      setView("camera");
      return;
    }
    if (qView === "list") setView("list");
  }, [searchParams, fieldsLoading, viewFields]);

  /** Keep URL in sync so refresh / back / share work (Σ5). */
  useEffect(() => {
    if (!bootstrappedParams.current) return;
    if (syncingUrl.current) return;
    const params = new URLSearchParams();
    if (view === "camera") {
      params.set("view", "camera");
    } else if (view === "result" && activeId) {
      params.set("view", "result");
      params.set("id", activeId);
    }
    const next = params.toString() ? `${pathname}?${params}` : pathname;
    const current = searchParams.toString() ? `${pathname}?${searchParams}` : pathname;
    if (next === current) return;
    syncingUrl.current = true;
    router.replace(next);
    queueMicrotask(() => {
      syncingUrl.current = false;
    });
  }, [view, activeId, pathname, router, searchParams]);

  const activeField = viewFields.find((f) => f.id === fieldId) ?? null;
  const active =
    (ephemeralScan && ephemeralScan.id === activeId ? ephemeralScan : null) ??
    scans.find((s) => s.id === activeId) ??
    null;

  useEffect(() => {
    if (!scansError) return;
    if (scansError === "needSupabase" || scansError === "needLogin") {
      toast.error(t(scansError === "needLogin" ? "needLogin" : "needSupabase"));
    } else if (process.env.NODE_ENV === "development") {
      console.warn("[scan] load:", scansError);
    }
  }, [scansError, t]);

  const groups = useMemo(() => {
    const list = scans.filter((s) => {
      if (filter !== "all" && s.fieldId !== filter) return false;
      if (onlyDue && !scanNeedsRecheck(s)) return false;
      return true;
    });
    const map = new Map<string, { id: string; name: string; scans: SavedScan[] }>();
    for (const scan of list) {
      const id = scan.fieldId ?? "none";
      const name = viewFields.find((f) => f.id === scan.fieldId)?.name ?? scan.fieldName ?? t("noField");
      const group = map.get(id) ?? { id, name, scans: [] };
      group.scans.push(scan);
      map.set(id, group);
    }
    return [...map.values()];
  }, [scans, filter, onlyDue, viewFields, t]);

  const dueCount = useMemo(() => scans.filter((s) => scanNeedsRecheck(s)).length, [scans]);

  function openCamera() {
    setNotice(null);
    setPhotos([]);
    setAnalysing(false);
    setPicking(false);
    setView("camera");
  }

  async function onFile(file: File | null) {
    if (!file || analysing) return;
    if (photos.length >= 4) {
      toast.error(t("maxPhotos"));
      return;
    }
    if (file.type && !file.type.startsWith("image/")) {
      toast.error(t("notImageFile"), { id: "scan-file" });
      return;
    }
    // Large phone photos are resized in the browser before upload (Σ4).
    if (file.size > 40_000_000) {
      toast.error(t("tooBig"), { id: "scan-file" });
      return;
    }
    try {
      const { compressImageFile } = await import("@/shared/lib/compress-image");
      const url = await compressImageFile(file);
      setNotice(null);
      setPhotos((prev) => (prev.length >= 4 ? prev : [...prev, url]));
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      toast.error(
        code === "tooSmall" ? t("imageTooSmall") : code === "badAspect" ? t("imageBadAspect") : t("notImageFile"),
        { id: "scan-file" },
      );
    }
  }

  function removePhoto(index: number) {
    if (analysing) return;
    setNotice(null);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function analyse(selected: string[]) {
    if (!activeField) {
      toast.error(t("needField"));
      return;
    }
    if (selected.length === 0) {
      toast.error(t("needPhoto"));
      return;
    }
    const primary = selected[0];
    setNotice(null);
    setAnalysing(true);
    try {
      const toBase64 = (dataUrl: string) => (dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl);
      const agro = varietyAgronomyContext(activeField.variety_slug ?? activeField.variety);
      const context = {
        fieldName: activeField.name.slice(0, 60),
        ...(activeField.variety ? { variety: activeField.variety.slice(0, 40) } : {}),
        ...(agro
          ? {
              varietySlug: agro.slug,
              primaryUse: agro.primary_use,
              droughtTolerance: agro.drought_tolerance_1to5,
              diseaseSusceptibility: agro.disease_susceptibility_1to5,
            }
          : {}),
      };
      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          language: locale === "tr" || locale === "en" ? locale : "el",
          imageBase64: toBase64(primary),
          imageBase64List: selected.map(toBase64),
          context,
        }),
      });
      if (res.status === 413) {
        throw new Error(t("payloadTooLarge"));
      }
      if (res.status === 401) {
        throw new Error(t("needLogin"));
      }
      if (res.status === 429) {
        setNotice("rateLimited");
        return;
      }
      const json: unknown = await res.json().catch(() => null);
      if (!isRecord(json) || json.ok !== true) {
        const code = isRecord(json) && typeof json.error === "string" ? json.error : "";
        throw new Error(
          code === "too_small"
            ? t("imageTooSmall")
            : code === "bad_aspect"
              ? t("imageBadAspect")
              : code === "not_image" || code === "invalid_request"
                ? t("notImageFile")
                : t("failed"),
        );
      }
      const payload = json.data;
      // AI temporarily unavailable (quota / timeout): no diagnosis at all, never a demo result (Ν4).
      if (isRecord(payload) && (payload.unavailable === true || payload.source === "demo")) {
        setNotice("unavailable");
        return;
      }
      if (isRecord(payload) && payload.rejected === "not_leaf") {
        setNotice("notLeaf");
        return;
      }

      const presented = buildPresented(payload, t);
      if (!presented) throw new Error(t("failed"));

      const rawResult = isRecord(payload) ? payload.result : null;
      const source =
        isRecord(payload) &&
        (payload.source === "gemini" || payload.source === "demo" || payload.source === "model")
          ? payload.source
          : "demo";

      // Low-confidence leaf results: ask for a better photo, do not save (Σ1/Σ2).
      if (
        mode === "leaf" &&
        source !== "demo" &&
        presented.confidence != null &&
        presented.confidence < 0.8
      ) {
        setNotice("lowConfidence");
        return;
      }

      // Never persist demo / fallback results as real history or quality input.
      if (source === "demo") {
        toast.message(t("demoNotSaved"));
        const local: SavedScan = {
          id: crypto.randomUUID(),
          fieldId: activeField.id,
          fieldName: activeField.name,
          at: new Date().toISOString(),
          preview: primary,
          storagePath: null,
          presented,
        };
        setEphemeralScan(local);
        setActiveId(local.id);
        setPhotos([]);
        setView("result");
        return;
      }

      const persisted = await saveFarmerScan({
        fieldId: activeField.id,
        fieldName: activeField.name,
        mode,
        dataUrl: primary,
        rawResult,
        source,
        presented,
      });

      if (!persisted.ok) {
        toast.error(t(persisted.error === "needLogin" || persisted.error === "needSupabase" ? persisted.error : "saveFailed"));
        const local: SavedScan = {
          id: crypto.randomUUID(),
          fieldId: activeField.id,
          fieldName: activeField.name,
          at: new Date().toISOString(),
          preview: primary,
          storagePath: null,
          presented,
        };
        setScans((prev) => [local, ...prev]);
        setActiveId(local.id);
        setPhotos([]);
        setView("result");
        return;
      }

      const taskResult = await completeTasksAfterScan({
        fieldId: activeField.id,
        taskId,
        treeId,
      });
      setTaskId(null);
      setTreeId(null);

      if (taskResult.ok && taskResult.completedId) {
        toast.success(tTasks("scanCompletedTask"));
      } else {
        toast.success(t("saved"));
      }
      setScans((prev) => [persisted.scan, ...prev.filter((s) => s.id !== persisted.scan.id)]);
      setActiveId(persisted.scan.id);
      setPhotos([]);
      setView("result");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed"));
    } finally {
      setAnalysing(false);
    }
  }

  if (view === "camera") {
    const hint = mode === "fruit" ? t("hintFruit") : mode === "trap" ? t("hintTrap") : t("hintLeaf");
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-ink text-white md:left-60">
        <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            aria-label={t("close")}
            onClick={() => {
              setNotice(null);
              setView("list");
            }}
            className="flex size-11 items-center justify-center rounded-full bg-white/15"
          >
            <X className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className="inline-flex h-11 max-w-[200px] items-center gap-1.5 rounded-full bg-white/15 px-4 text-ap-body font-bold"
          >
            <span className="truncate">{activeField ? activeField.name : t("noField")}</span>
            <ChevronDown className="size-3.5 shrink-0" aria-hidden />
          </button>
          <span className="size-11" />
        </div>

        <div className="mx-auto mt-3 flex h-11 w-fit items-stretch rounded-full bg-white/15 p-1">
          <div className="flex" role="tablist">
          {(["leaf", "fruit", "trap"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={cn(
                "flex w-[72px] items-center justify-center rounded-full text-ap-pill",
                mode === id ? "bg-white text-ink" : "text-white/80",
              )}
            >
              {t(id)}
            </button>
          ))}
          </div>
          <span className="mx-1 my-2 w-px bg-white/25" aria-hidden />
          <Link
            href="/farmer/logbook?add=1&label=1"
            className="flex items-center justify-center gap-1 rounded-full px-3 text-ap-pill text-white/80"
          >
            <Tag className="size-3.5" aria-hidden />
            {t("label")}
          </Link>
        </div>

        <div className="relative mx-4 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] bg-white/5">
          {photos.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photos[0]}
              alt=""
              className={cn("absolute inset-0 size-full object-contain", analysing && "opacity-40")}
            />
          ) : null}

          {analysing ? (
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
              <span className="relative flex size-16 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
                <span className="absolute inset-2 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                <Leaf className="relative size-6 text-white" aria-hidden />
              </span>
              <div>
                <p className="text-ap-card font-extrabold text-white">{t("analysing")}</p>
                <p className="mt-1 text-ap-body font-semibold text-white/70">{t("analysingHint")}</p>
              </div>
            </div>
          ) : photos.length > 0 ? (
            <div className="relative z-10 mt-auto flex flex-col gap-3 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-4 pt-16 pb-4">
              {notice ? (
                <div role="status" className="flex gap-3 rounded-2xl bg-card p-3 text-ink">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn-text">
                    <TriangleAlert className="size-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-ap-body font-extrabold">{t(`notice_${notice}_title`)}</p>
                    <p className="mt-0.5 text-ap-small text-muted-foreground">
                      {t(notice === "unavailable" ? "unavailableNow" : notice)}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="flex gap-3 overflow-x-auto pt-3 pr-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {photos.map((src, i) => (
                  <div key={`${i}-${src.slice(0, 24)}`} className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt=""
                      className={cn(
                        "size-16 rounded-xl object-cover ring-2",
                        i === 0 ? "ring-white" : "ring-white/30",
                      )}
                    />
                    <button
                      type="button"
                      aria-label={t("removePhoto")}
                      onClick={() => removePhoto(i)}
                      className="absolute -top-3.5 -right-3.5 flex size-11 items-center justify-center"
                    >
                      <span className="flex size-6 items-center justify-center rounded-full bg-risk text-white ring-2 ring-ink">
                        <X className="size-3.5" aria-hidden />
                      </span>
                    </button>
                  </div>
                ))}
                {photos.length < 4 ? (
                  <button
                    type="button"
                    onClick={() => addMoreRef.current?.click()}
                    className="flex size-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-white/40 bg-white/10 text-white"
                  >
                    <ImageIcon className="size-4" aria-hidden />
                    <span className="text-[12px] font-bold">{t("addPhoto")}</span>
                  </button>
                ) : null}
              </div>
              {notice ? null : (
                <p className="text-center text-ap-small font-semibold text-white/75">{t("reviewHint")}</p>
              )}
              {notice && !NOTICE_RETRY[notice] ? (
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setPhotos([]);
                    shutterRef.current?.click();
                  }}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-ap-btn text-ink"
                >
                  <Camera className="size-[18px]" aria-hidden />
                  {t("newPhoto")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void analyse(photos)}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-ap-btn text-ink"
                >
                  {notice ? <RefreshCw className="size-[18px]" aria-hidden /> : null}
                  {notice ? t("retry") : t("analyseNow")}
                </button>
              )}
            </div>
          ) : (
            <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
              <button
                type="button"
                onClick={() => shutterRef.current?.click()}
                className="relative flex aspect-square w-[min(62vw,240px)] flex-col items-center justify-center gap-2 rounded-3xl"
              >
                <Corners />
                <Leaf className="size-8 text-white/50" aria-hidden />
                <span className="max-w-[160px] text-ap-body font-semibold text-white/75">{t("cameraEmpty")}</span>
              </button>
              <p className="pointer-events-none absolute bottom-4 left-1/2 max-w-[90%] -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-center text-ap-body font-semibold text-white">
                {hint}
              </p>
            </div>
          )}
        </div>

        <div className="mx-4 mt-2">
          <PrivacyLine className="text-white/55" />
        </div>

        {photos.length === 0 && !analysing ? (
          <div className="flex items-center justify-between px-8 pt-2 pb-4">
            <button
              type="button"
              aria-label={t("gallery")}
              onClick={() => libraryRef.current?.click()}
              className="flex size-12 items-center justify-center rounded-full bg-white/15"
            >
              <ImageIcon className="size-[22px]" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t("shutter")}
              onClick={() => shutterRef.current?.click()}
              className="flex size-[76px] items-center justify-center rounded-full border-4 border-white"
            >
              <span className="size-[58px] rounded-full bg-white" />
            </button>
            <button
              type="button"
              aria-label={t("history")}
              onClick={() => setView("list")}
              className="flex size-12 items-center justify-center rounded-full bg-white/15"
            >
              <History className="size-[22px]" aria-hidden />
            </button>
          </div>
        ) : (
          <div className="h-4 pb-[env(safe-area-inset-bottom)]" />
        )}

        <input
          ref={libraryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <input
          ref={addMoreRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <input
          ref={shutterRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        {picking ? (
          <div className="absolute inset-0 z-20">
            <button type="button" aria-label={t("close")} className="absolute inset-0 bg-black/50" onClick={() => setPicking(false)} />
            <div className="absolute top-16 right-4 left-4 rounded-[18px] bg-card p-3 text-ink">
              <p className="mb-1.5 text-ap-small font-bold tracking-wide text-muted-foreground uppercase">{t("pickField")}</p>
              {viewFields.length === 0 ? (
                <p className="text-ap-body text-muted-foreground">{t("noField")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {viewFields.map((f) => (
                    <Chip
                      key={f.id}
                      on={f.id === fieldId}
                      onClick={() => {
                        setFieldId(f.id);
                        setPicking(false);
                      }}
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: f.color }} />
                      <span className={cn("text-ap-pill font-bold", f.id === fieldId ? "text-white" : "text-ink")}>{f.name}</span>
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (view === "result" && active) {
    return (
      <ResultView
        scan={active}
        locale={locale}
        onBack={() => setView("list")}
        onRecheck={() => {
          setMode(active.presented.mode);
          if (active.fieldId) setFieldId(active.fieldId);
          openCamera();
        }}
      />
    );
  }

  return (
    <div className="relative w-full flex-1 pb-28">
      <h1 className="text-[20px] font-extrabold tracking-tight text-ink">{t("yourScans")}</h1>
      {!scansLoading && scans.length > 0 ? (
        <p className="text-ap-small text-muted-foreground">
          {t("listSummary", { n: scans.length, due: dueCount })}
        </p>
      ) : null}

      <div className="mt-2.5">
        {fieldsLoading ? (
          <div className="h-11 animate-pulse rounded-full bg-soft" />
        ) : (
          <FieldChips
            fields={viewFields.map((f) => ({ id: f.id, name: f.name, color: f.color }))}
            selected={filter}
            onSelect={setFilter}
            showAll
            allLabel={t("allCount", { n: scans.length })}
            trailing={
              <>
                <Chip on={onlyDue} tone="black" onClick={() => setOnlyDue((v) => !v)}>
                  <RefreshCw className={cn("size-3.5", onlyDue ? "text-white" : "text-ink")} aria-hidden />
                  <span className={cn("text-ap-pill font-bold", onlyDue ? "text-white" : "text-ink")}>
                    {t("filterDue")}
                  </span>
                </Chip>
              </>
            }
          />
        )}
      </div>

      {scansLoading ? (
        <div className="mt-3.5 flex flex-col gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex h-[70px] items-center gap-2.5 rounded-2xl border border-line bg-card p-2.5">
              <span className="size-12 shrink-0 animate-pulse rounded-[10px] bg-soft" />
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="h-3.5 w-2/3 animate-pulse rounded-full bg-soft" />
                <span className="h-3 w-1/3 animate-pulse rounded-full bg-soft" />
              </span>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-soft">
            {onlyDue ? (
              <Check className="size-6 text-muted-foreground" aria-hidden />
            ) : (
              <Leaf className="size-6 text-muted-foreground" aria-hidden />
            )}
          </div>
          <p className="mt-3 text-ap-body font-semibold text-ink">
            {onlyDue ? t("emptyDueTitle") : t("emptyScansTitle")}
          </p>
          <p className="mt-1 text-ap-small text-muted-foreground">{onlyDue ? t("emptyDue") : t("emptyScansHint")}</p>
          <div className="mt-4">
            {onlyDue ? (
              <ApButton variant="outline" label={t("showAllScans")} onClick={() => setOnlyDue(false)} />
            ) : (
              <ApButton
                label={t("newScan")}
                icon={<Camera className="size-4" aria-hidden />}
                onClick={openCamera}
              />
            )}
          </div>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.id}>
            <h2 className="mt-3.5 flex items-center gap-2 text-ap-card text-ink">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: viewFields.find((f) => f.id === group.id)?.color ?? "var(--line)" }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{group.name}</span>
              <span className="shrink-0 text-ap-small font-semibold text-muted-foreground">{group.scans.length}</span>
            </h2>
            {group.scans.map((scan) => (
              <button
                key={scan.id}
                type="button"
                onClick={() => {
                  setActiveId(scan.id);
                  setView("result");
                }}
                className="mt-2 flex min-h-14 w-full items-center rounded-2xl border border-line bg-card p-2.5 text-left"
              >
                {scan.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={scan.preview} alt="" className="size-12 shrink-0 rounded-[10px] object-cover" />
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-soft">
                    <Leaf className="size-5 text-muted-foreground" aria-hidden />
                  </span>
                )}
                <span className="mr-2 ml-2.5 min-w-0 flex-1">
                  <span className="block truncate text-ap-body font-extrabold text-ink">
                    {localizedScanTitle(scan.presented, t)}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Pill tone={scan.presented.tone}>{t(scan.presented.pillKey)}</Pill>
                    <span className="text-ap-small text-muted-foreground">
                      {scan.presented.confidence != null
                        ? t("listMeta", {
                            date: formatDay(scan.at, locale),
                            n: Math.round(scan.presented.confidence * 100),
                          })
                        : formatDay(scan.at, locale)}
                    </span>
                    {scanNeedsRecheck(scan) ? (
                      <span className="inline-flex items-center gap-1 text-ap-small font-bold text-warn-text">
                        <RefreshCw className="size-3" aria-hidden />
                        {t("needsRecheck")}
                      </span>
                    ) : null}
                  </span>
                </span>
                <ChevronRight className="ml-1 size-4 shrink-0 self-center text-muted-foreground" aria-hidden />
              </button>
            ))}
          </section>
        ))
      )}

      <button
        type="button"
        onClick={openCamera}
        className="fixed right-4 z-30 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-ap-btn text-white shadow-[0_6px_16px_rgba(0,0,0,0.2)] bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-8"
      >
        <Camera className="size-[18px]" aria-hidden />
        {t("newScan")}
      </button>
    </div>
  );
}

function ResultView({
  scan,
  locale,
  onBack,
  onRecheck,
}: {
  scan: SavedScan;
  locale: string;
  onBack: () => void;
  onRecheck: () => void;
}) {
  const t = useTranslations("farmerScan");
  const errMsg = useErrorMessage();
  const router = useRouter();
  const { presented } = scan;
  const displayTitle = localizedScanTitle(presented, t);
  const parts = splitSummary(presented.summary.trim() || displayTitle);
  const actions = actionSet(presented.actionKind, t);
  const photoLabel = presented.mode === "fruit" ? t("fruitPhoto") : presented.mode === "trap" ? t("trapPhoto") : t("leafPhoto");
  const [pendingTask, setPendingTask] = useState<string | null>(null);
  const meta = [scan.fieldName, formatWhen(scan.at, locale, (time) => t("todayAt", { time }))].filter(Boolean).join(" · ");

  async function createFollowUpTask(title: string) {
    if (pendingTask) return;
    if (!scan.fieldId) {
      toast.message(t("needField"));
      return;
    }
    setPendingTask(title);
    const { createFarmerTask } = await import("@/features/tasks/use-farmer-tasks");
    const result = await createFarmerTask({
      fieldId: scan.fieldId,
      title,
      kind: "recheck",
    }).finally(() => setPendingTask(null));
    if (!result.ok) {
      toast.error(errMsg(result.error, "actionFailed"));
      return;
    }
    toast.success(t("taskCreated"));
    router.push("/farmer/tasks");
  }

  return (
    <div className="w-full flex-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t("back")}
          onClick={onBack}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-extrabold tracking-tight text-ink">{t("scanResult")}</h1>
          <p className="truncate text-ap-small text-muted-foreground">{meta}</p>
        </div>
      </div>

      <div className="relative mt-2.5 h-[clamp(180px,34vh,340px)] overflow-hidden rounded-[18px] bg-ink">
        {scan.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={scan.preview} alt={displayTitle} className="size-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Leaf className="size-10 text-muted-foreground" aria-hidden />
          </div>
        )}
        <span className="absolute bottom-2 left-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-ap-pill text-ink">
          <Camera className="size-4" aria-hidden />
          {photoLabel}
        </span>
      </div>

      <div
        className={cn(
          "mt-2 rounded-[18px] border p-3",
          presented.tone === "risk"
            ? "border-risk/35 bg-risk-soft/45"
            : presented.tone === "good"
              ? "border-good/30 bg-good-soft/40"
              : "border-warn/40 bg-warn-soft/50",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-full",
              presented.tone === "good"
                ? "bg-good-soft text-good"
                : presented.tone === "risk"
                  ? "bg-risk-soft text-risk"
                  : "bg-warn-soft text-warn",
            )}
          >
            {presented.tone === "good" ? (
              <Check className="size-6" aria-hidden />
            ) : presented.tone === "risk" ? (
              <Bug className="size-6" aria-hidden />
            ) : (
              <Leaf className="size-6" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[22px] leading-tight font-extrabold tracking-tight text-ink">{displayTitle}</p>
            {presented.latin ? <p className="mt-0.5 text-ap-body text-muted-foreground italic">{presented.latin}</p> : null}
          </div>
        </div>
        {parts.detail || (parts.headline && parts.headline !== displayTitle) ? (
          <div className="mt-2 rounded-xl bg-card/80 p-2.5">
            {parts.headline && parts.headline !== displayTitle ? (
              <p className="text-ap-body font-bold text-ink">{parts.headline}</p>
            ) : null}
            {parts.detail ? <p className="text-ap-body text-muted-foreground">{parts.detail}</p> : null}
          </div>
        ) : null}
        {presented.source || presented.confidence != null ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {presented.source ? <AiTag source={presented.source} /> : null}
            {presented.source === "demo" ? <Pill tone="neutral">{t("notSaved")}</Pill> : null}
            {presented.confidence != null ? (
              <span className="text-ap-small font-bold text-ink">
                {t(
                  presented.confidence >= 0.85
                    ? "confidenceSure"
                    : presented.confidence >= 0.7
                      ? "confidenceLikely"
                      : "confidenceUnsure",
                  { n: Math.round(presented.confidence * 100) },
                )}
              </span>
            ) : null}
          </div>
        ) : null}
        {presented.confidence != null ? (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-card">
            <div
              className={cn(
                "h-full rounded-full",
                presented.confidence >= 0.85
                  ? "bg-good"
                  : presented.confidence >= 0.7
                    ? "bg-warn"
                    : "bg-risk",
              )}
              style={{ width: `${Math.round(presented.confidence * 100)}%` }}
            />
          </div>
        ) : null}
        {presented.source === "demo" ? (
          <p className="mt-1 text-ap-small text-muted-foreground">
            {demoNoteFor(presented.demoReason, t)}
          </p>
        ) : null}
      </div>

      <SectionHeader
        title={t("whatNow")}
        className="items-center gap-2"
        action={presented.showNoChemicals ? <Pill tone="good">{t("noChemicals")}</Pill> : undefined}
      />
      <div className="mt-2 flex flex-col gap-2">
        {actions.map((action) => (
          <button
            key={action.title}
            type="button"
            disabled={pendingTask !== null}
            onClick={() => void createFollowUpTask(action.title)}
            className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2.5 text-left disabled:opacity-60"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-good-soft">
              <action.icon className={cn("size-[18px]", action.color)} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-ap-body font-bold text-ink">{action.title}</span>
              <span className="block text-ap-small text-muted-foreground">{action.sub}</span>
            </span>
            <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-soft px-2.5 text-ap-pill text-ink">
              {pendingTask === action.title ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-3.5" aria-hidden />
              )}
              {t("taskShort")}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex gap-2">
        <ApButton
          compact
          className="min-w-0 flex-1 px-3"
          variant="dark"
          label={t("recheck")}
          icon={<Camera className="size-4" aria-hidden />}
          onClick={onRecheck}
        />
        <ApButton
          compact
          className="min-w-0 flex-1 px-3"
          variant="outline"
          label={t("addTaskFromScan")}
          disabled={pendingTask !== null}
          icon={
            pendingTask === displayTitle ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <ClipboardList className="size-4" aria-hidden />
            )
          }
          onClick={() => void createFollowUpTask(displayTitle)}
        />
      </div>
    </div>
  );
}

/** Viewfinder corner brackets for the empty capture state. */
function Corners() {
  const base = "pointer-events-none absolute size-7 border-white/80";
  return (
    <>
      <span className={cn(base, "top-0 left-0 rounded-tl-3xl border-t-[3px] border-l-[3px]")} aria-hidden />
      <span className={cn(base, "top-0 right-0 rounded-tr-3xl border-t-[3px] border-r-[3px]")} aria-hidden />
      <span className={cn(base, "bottom-0 left-0 rounded-bl-3xl border-b-[3px] border-l-[3px]")} aria-hidden />
      <span className={cn(base, "right-0 bottom-0 rounded-br-3xl border-r-[3px] border-b-[3px]")} aria-hidden />
    </>
  );
}

function actionSet(kind: ActionKind, t: TFn): { icon: LucideIcon; title: string; sub: string; color: string }[] {
  if (kind === "healthy") {
    return [
      { icon: Check, title: t("keepChecking"), sub: t("keepCheckingSub"), color: "text-good" },
      { icon: CloudRain, title: t("scanAfterRain"), sub: t("scanAfterRainSub"), color: "text-good" },
      { icon: ClipboardList, title: t("keepRecords"), sub: t("keepRecordsSub"), color: "text-ap-accent" },
    ];
  }
  if (kind === "trap") {
    return [
      { icon: Bug, title: t("checkTrap"), sub: t("checkTrapSub"), color: "text-good" },
      { icon: RefreshCw, title: t("replaceCard"), sub: t("replaceCardSub"), color: "text-good" },
      { icon: Camera, title: t("sendPhoto"), sub: t("sendPhotoSub"), color: "text-ap-accent" },
    ];
  }
  return [
    { icon: Scissors, title: t("actionPrune"), sub: t("actionPruneSub"), color: "text-good" },
    { icon: Leaf, title: t("actionLeaves"), sub: t("actionLeavesSub"), color: "text-good" },
    { icon: RefreshCw, title: t("actionRecheck"), sub: t("actionRecheckSub"), color: "text-ap-accent" },
  ];
}

function demoNoteFor(reason: string | undefined, t: TFn): string {
  switch (reason) {
    case "no_key":
      return t("demoReasonNoKey");
    case "timeout":
      return t("demoReasonTimeout");
    case "schema":
      return t("demoReasonSchema");
    case "parse":
    case "empty":
      return t("demoReasonParse");
    case "billing":
      return t("demoReasonBilling");
    case "api":
      return t("demoReasonApi");
    case "space":
      return t("demoReasonSpace");
    case "quota":
      return t("demoReasonQuota");
    case "no_token":
      return t("demoReasonNoToken");
    default:
      return t("demoNote");
  }
}

function buildPresented(data: unknown, t: TFn): Presented | null {
  if (!isRecord(data) || !isRecord(data.result)) return null;
  const result = data.result;
  const source =
    data.source === "gemini" || data.source === "demo" || data.source === "model"
      ? data.source
      : undefined;
  const modelVersion = typeof data.modelVersion === "string" ? data.modelVersion : undefined;
  const demoReason = typeof data.demoReason === "string" ? data.demoReason : undefined;
  const confidence = asConfidence(result.confidence);

  if (data.mode === "leaf" && typeof result.label === "string") {
    const label = result.label;
    let title = label;
    let latin: string | undefined;
    let tone: PillTone = "warn";
    let pillKey: PillKey = "watch";
    const top3 = Array.isArray(result.top3) ? result.top3 : [];
    const second = top3
      .map((row) => (isRecord(row) ? row : null))
      .find((row) => row && typeof row.label === "string" && row.label !== label);
    const secondLabel = second && typeof second.label === "string" ? second.label : null;

    // Never call a leaf "Healthy" below 0.7 — show Uncertain and surface 2nd guess (Σ2).
    if (label === "Healthy" && confidence != null && confidence < 0.7) {
      title = t("uncertain");
      tone = "warn";
      pillKey = "watch";
      const alt =
        secondLabel === "Olive Peacock Spot"
          ? t("peacock")
          : secondLabel === "Aculus Olearius"
            ? t("budMite")
            : secondLabel;
      const summaryParts = [
        t("uncertainHint"),
        alt ? t("alsoPossible", { label: alt }) : null,
        ...strings(result.symptoms),
      ].filter(Boolean);
      return {
        mode: "leaf",
        title,
        titleKey: "uncertain",
        latin: undefined,
        summary: summaryParts.join(" "),
        tone,
        pillKey,
        confidence,
        source,
        modelVersion,
        demoReason,
        actionKind: "care",
        showNoChemicals: true,
      };
    }

    let titleKey: Presented["titleKey"];
    if (label === "Healthy") {
      title = t("healthyLeaf");
      titleKey = "healthyLeaf";
      tone = "good";
      pillKey = "healthy";
    } else if (label === "Olive Peacock Spot") {
      title = t("peacock");
      titleKey = "peacock";
      latin = LATIN.peacock;
      tone = "risk";
      pillKey = "highRisk";
    } else if (label === "Aculus Olearius") {
      title = t("budMite");
      titleKey = "budMite";
      latin = LATIN.mite;
    }
    const toneGood = tone === "good";
    const altHint =
      secondLabel && !toneGood
        ? ` ${t("alsoPossible", {
            label:
              secondLabel === "Healthy"
                ? t("healthyLeaf")
                : secondLabel === "Olive Peacock Spot"
                  ? t("peacock")
                  : secondLabel === "Aculus Olearius"
                    ? t("budMite")
                    : secondLabel,
          })}`
        : "";
    return {
      mode: "leaf",
      title,
      titleKey,
      latin,
      summary: `${strings(result.symptoms).join(" ")}${altHint}`.trim(),
      tone,
      pillKey,
      confidence,
      source,
      modelVersion,
      demoReason,
      actionKind: toneGood ? "healthy" : "care",
      showNoChemicals: !toneGood,
    };
  }

  if (data.mode === "fruit" && typeof result.diagnosis === "string") {
    const dx = result.diagnosis;
    let title = dx;
    let titleKey: Presented["titleKey"];
    let latin: string | undefined;
    let tone: PillTone = "warn";
    let pillKey: PillKey = "watch";
    if (dx === "healthy") {
      title = t("healthyFruit");
      titleKey = "healthyFruit";
      tone = "good";
      pillKey = "healthy";
    } else if (dx === "olive fly sting") {
      title = t("oliveFly");
      titleKey = "oliveFly";
      latin = LATIN.fly;
      tone = "risk";
      pillKey = "highRisk";
    } else if (dx === "other damage") {
      title = t("otherDamage");
      titleKey = "otherDamage";
    } else if (dx === "unclear") {
      title = t("notClear");
      titleKey = "notClear";
    }
    const toneGood = tone === "good";
    return {
      mode: "fruit",
      title,
      titleKey,
      latin,
      summary: strings(result.symptoms).join(" "),
      tone,
      pillKey,
      confidence,
      source,
      demoReason,
      actionKind: toneGood ? "healthy" : "care",
      showNoChemicals: !toneGood,
    };
  }

  if (data.mode === "trap" && typeof result.flyCount === "number") {
    const n = result.flyCount;
    const tone: PillTone = n <= 0 ? "good" : n > 10 ? "risk" : "warn";
    const pillKey: PillKey = tone === "good" ? "healthy" : tone === "risk" ? "highRisk" : "watch";
    return {
      mode: "trap",
      title: t("trapTitle", { n }),
      titleKey: "trapTitle",
      summary: typeof result.notes === "string" ? result.notes : "",
      tone,
      pillKey,
      confidence,
      source,
      demoReason,
      actionKind: "trap",
      showNoChemicals: tone !== "good",
    };
  }

  return null;
}

function splitSummary(summary: string): { headline: string; detail: string } {
  const trimmed = summary.trim();
  const idx = trimmed.indexOf(". ");
  if (idx === -1 || idx > 160) return { headline: trimmed, detail: "" };
  return { headline: trimmed.slice(0, idx + 1), detail: trimmed.slice(idx + 2) };
}

function formatDay(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function formatWhen(iso: string, locale: string, todayAt: (time: string) => string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) return todayAt(time);
  return `${formatDay(iso, locale)}, ${time}`;
}

function asConfidence(v: unknown): number | undefined {
  if (typeof v !== "number" || Number.isNaN(v)) return undefined;
  const n = v > 1 ? v / 100 : v;
  return Math.min(1, Math.max(0, n));
}

function strings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
