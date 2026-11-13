"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  ListFilter,
  RefreshCw,
  Scissors,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { AiTag, ApButton, Chip, FieldChips, Pill, PrivacyLine, type PillTone } from "@/shared/components/brand";
import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { FIELD_DOTS } from "@/shared/theme/tokens";

type CaptureMode = "leaf" | "fruit" | "trap";
type PillKey = "healthy" | "watch" | "highRisk";
type ActionKind = "care" | "healthy" | "trap";
type View = "list" | "camera" | "result";

type Presented = {
  mode: CaptureMode;
  title: string;
  latin?: string;
  summary: string;
  tone: PillTone;
  pillKey: PillKey;
  confidence?: number;
  source?: "gemini" | "demo";
  actionKind: ActionKind;
  showNoChemicals: boolean;
};

type SavedScan = {
  id: string;
  fieldId: string | null;
  fieldName: string | null;
  at: string;
  preview: string;
  presented: Presented;
};

type TFn = (key: string, values?: Record<string, string | number>) => string;

const LATIN = {
  peacock: "Spilocaea oleaginea",
  mite: "Aculus olearius",
  fly: "Bactrocera oleae",
} as const;

const BOX: Record<PillTone, string> = {
  good: "bg-good-soft",
  warn: "bg-warn-soft",
  risk: "bg-risk-soft",
  accent: "bg-ap-accent-soft",
  neutral: "bg-soft",
};

export function ScanScreen() {
  const t = useTranslations("farmerScan");
  const locale = useLocale();
  const { fields, loading: fieldsLoading } = useFarmerFields();
  const [view, setView] = useState<View>("list");
  const [mode, setMode] = useState<CaptureMode>("leaf");
  const [filter, setFilter] = useState<string | "all">("all");
  const [onlyDue, setOnlyDue] = useState(false);
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [scans, setScans] = useState<SavedScan[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [picking, setPicking] = useState(false);
  const libraryRef = useRef<HTMLInputElement>(null);
  const shutterRef = useRef<HTMLInputElement>(null);

  const viewFields = useMemo(
    () =>
      fields.map((f, i) => ({
        id: f.id,
        name: f.name,
        color: FIELD_DOTS[i % FIELD_DOTS.length],
        variety: f.variety,
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

  const activeField = viewFields.find((f) => f.id === fieldId) ?? null;
  const active = scans.find((s) => s.id === activeId) ?? null;

  const groups = useMemo(() => {
    const list = scans.filter((s) => filter === "all" || s.fieldId === filter);
    const map = new Map<string, { id: string; name: string; scans: SavedScan[] }>();
    for (const scan of list) {
      const id = scan.fieldId ?? "none";
      const name = viewFields.find((f) => f.id === scan.fieldId)?.name ?? scan.fieldName ?? t("noField");
      const group = map.get(id) ?? { id, name, scans: [] };
      group.scans.push(scan);
      map.set(id, group);
    }
    return [...map.values()];
  }, [scans, filter, viewFields, t]);

  function openCamera() {
    setPreview(null);
    setAnalysing(false);
    setPicking(false);
    setView("camera");
  }

  function onFile(file: File | null) {
    if (!file || analysing) return;
    if (file.size > 1_000_000) {
      toast.error(t("tooBig"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setPreview(url);
      void analyse(url);
    };
    reader.readAsDataURL(file);
  }

  async function analyse(dataUrl: string) {
    setAnalysing(true);
    try {
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      const context = activeField
        ? {
            fieldName: activeField.name.slice(0, 60),
            ...(activeField.variety ? { variety: activeField.variety.slice(0, 40) } : {}),
          }
        : undefined;
      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, imageBase64: base64, context }),
      });
      const json: unknown = await res.json();
      if (!isRecord(json) || json.ok !== true) {
        const message = isRecord(json) && typeof json.error === "string" ? json.error : t("failed");
        throw new Error(message);
      }
      const presented = buildPresented(json.data, t);
      if (!presented) throw new Error(t("failed"));
      const saved: SavedScan = {
        id: crypto.randomUUID(),
        fieldId: activeField?.id ?? null,
        fieldName: activeField?.name ?? null,
        at: new Date().toISOString(),
        preview: dataUrl,
        presented,
      };
      setScans((prev) => [saved, ...prev]);
      setActiveId(saved.id);
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
      <div className="fixed inset-0 z-50 flex flex-col bg-[#0B0B0B] text-white md:left-60">
        <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            aria-label={t("close")}
            onClick={() => setView("list")}
            className="flex size-10 items-center justify-center rounded-full bg-white/15"
          >
            <X className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className="inline-flex h-9 max-w-[220px] items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-ap-body font-bold"
          >
            <span className="truncate">{activeField ? activeField.name : t("noField")}</span>
            <ChevronDown className="size-3.5 shrink-0" aria-hidden />
          </button>
          <span className="size-10" />
        </div>

        <div className="mx-auto mt-3 flex h-9 w-fit rounded-full bg-white/15 p-1" role="tablist">
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
          <Link
            href="/farmer/logbook?add=1&label=1"
            className="flex w-[72px] items-center justify-center rounded-full text-ap-pill text-white/80"
          >
            {t("label")}
          </Link>
        </div>

        <div className="relative mx-4 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] bg-[#1B1B1B]">
          {preview && analysing ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="absolute inset-0 size-full object-cover opacity-50" />
          ) : null}
          <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <Camera className="size-8 text-[#8A8A8A]" aria-hidden />
            {analysing ? (
              <p className="text-ap-body font-semibold text-white/70">{t("analysing")}</p>
            ) : (
              <>
                <p className="text-ap-body font-semibold text-white/70">{t("cameraOff")}</p>
                <button
                  type="button"
                  onClick={() => libraryRef.current?.click()}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-ap-btn text-ink"
                >
                  {t("choosePhoto")}
                </button>
              </>
            )}
          </div>
          <p className="pointer-events-none absolute bottom-4 left-1/2 max-w-[90%] -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-center text-ap-body font-semibold text-white">
            {hint}
          </p>
        </div>

        <div className="mx-4 mt-2">
          <PrivacyLine className="text-white/55" />
        </div>

        <div className="flex items-center justify-between px-8 pt-2 pb-4">
          <button
            type="button"
            aria-label={t("gallery")}
            onClick={() => libraryRef.current?.click()}
            disabled={analysing}
            className="flex size-12 items-center justify-center rounded-full bg-white/15 disabled:opacity-40"
          >
            <ImageIcon className="size-[22px]" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("shutter")}
            onClick={() => shutterRef.current?.click()}
            disabled={analysing}
            className="flex size-[76px] items-center justify-center rounded-full border-4 border-white disabled:opacity-40"
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

        <input
          ref={libraryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0] ?? null);
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
            onFile(e.target.files?.[0] ?? null);
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
    <div className="relative w-full flex-1">
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-ap-title text-ink">{t("yourScans")}</h1>
        <button
          type="button"
          aria-label={t("filterDue")}
          aria-pressed={onlyDue}
          onClick={() => setOnlyDue((v) => !v)}
          className={cn(
            "flex size-10 items-center justify-center rounded-full border",
            onlyDue ? "border-ink bg-ink text-white" : "border-line bg-card text-ink",
          )}
        >
          <ListFilter className="size-[18px]" aria-hidden />
        </button>
      </div>

      <div className="mt-2.5">
        {fieldsLoading ? (
          <div className="h-8 animate-pulse rounded-full bg-soft" />
        ) : (
          <FieldChips
            fields={viewFields.map((f) => ({ id: f.id, name: f.name, color: f.color }))}
            selected={filter}
            onSelect={setFilter}
            showAll
            allLabel={t("allCount", { n: scans.length })}
          />
        )}
      </div>

      {onlyDue || groups.length === 0 ? (
        <div className="mt-2 rounded-[18px] border border-line bg-card p-5 text-center text-ap-body font-semibold text-muted-foreground">
          {onlyDue ? t("emptyDue") : t("emptyScans")}
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.id}>
            <h2 className="mt-3.5 text-ap-card text-ink">{group.name}</h2>
            {group.scans.map((scan) => (
              <button
                key={scan.id}
                type="button"
                onClick={() => {
                  setActiveId(scan.id);
                  setView("result");
                }}
                className="mt-2 flex w-full items-center rounded-[18px] border border-line bg-card p-2.5 text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scan.preview} alt="" className="size-12 shrink-0 rounded-[10px] object-cover" />
                <span className="mr-2 ml-2.5 min-w-0 flex-1">
                  <span className="block truncate text-ap-body font-extrabold text-ink">{scan.presented.title}</span>
                  <span className="block text-ap-small text-muted-foreground">
                    {scan.presented.confidence != null
                      ? t("listMeta", {
                          date: formatDay(scan.at, locale),
                          n: Math.round(scan.presented.confidence * 100),
                        })
                      : formatDay(scan.at, locale)}
                  </span>
                </span>
                <Pill tone={scan.presented.tone}>{t(scan.presented.pillKey)}</Pill>
                <ChevronRight className="ml-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </section>
        ))
      )}

      <button
        type="button"
        onClick={openCamera}
        className="fixed right-4 z-30 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-ap-btn text-white shadow-[0_6px_16px_rgba(0,0,0,0.2)] bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-8"
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
  const { presented } = scan;
  const parts = splitSummary(presented.summary.trim() || presented.title);
  const actions = actionSet(presented.actionKind, t);
  const photoLabel = presented.mode === "fruit" ? t("fruitPhoto") : presented.mode === "trap" ? t("trapPhoto") : t("leafPhoto");
  const meta = [scan.fieldName, formatWhen(scan.at, locale, (time) => t("todayAt", { time }))].filter(Boolean).join(" · ");

  return (
    <div className="w-full flex-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t("back")}
          onClick={onBack}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-card"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-ap-title text-ink">{t("scanResult")}</h1>
          <p className="text-ap-body text-muted-foreground">{meta}</p>
        </div>
      </div>

      <div className="relative mt-2.5 h-[200px] overflow-hidden rounded-[18px] bg-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={scan.preview} alt={presented.title} className="size-full object-cover" />
        <span className="absolute bottom-2 left-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-ap-pill text-ink">
          <Camera className="size-4" aria-hidden />
          {photoLabel}
        </span>
      </div>

      <div className="mt-2 rounded-[18px] border border-line bg-card p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 pr-2">
            <p className="text-ap-card text-ink">{presented.title}</p>
            {presented.latin ? <p className="text-ap-body text-muted-foreground italic">{presented.latin}</p> : null}
          </div>
          <Pill tone={presented.tone}>{t(presented.pillKey)}</Pill>
        </div>
        <div className={cn("mt-2 rounded-xl p-2.5", BOX[presented.tone])}>
          <p className="text-ap-body font-bold text-ink">{parts.headline}</p>
          {parts.detail ? <p className="text-ap-body text-muted-foreground">{parts.detail}</p> : null}
        </div>
        {presented.source || presented.confidence != null ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {presented.source ? <AiTag source={presented.source} /> : null}
            {presented.confidence != null ? (
              <span className="text-ap-small font-bold text-ink">
                {t("confidence", { n: Math.round(presented.confidence * 100) })}
              </span>
            ) : null}
          </div>
        ) : null}
        {presented.source === "demo" ? <p className="mt-1 text-ap-small text-muted-foreground">{t("demoNote")}</p> : null}
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-2">
        <h2 className="text-ap-card text-ink">{t("whatNow")}</h2>
        {presented.showNoChemicals ? <Pill tone="good">{t("noChemicals")}</Pill> : null}
      </div>
      <div className="mt-2 flex gap-2">
        {actions.map((action) => (
          <button
            key={action.title}
            type="button"
            onClick={() => toast(action.title)}
            className="flex-1 rounded-[18px] border border-line bg-card p-2.5"
          >
            <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-good-soft">
              <action.icon className={cn("size-[18px]", action.color)} aria-hidden />
            </span>
            <span className="mt-1.5 block text-center text-ap-body font-bold text-ink">{action.title}</span>
            <span className="block text-center text-ap-small text-muted-foreground">{action.sub}</span>
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex gap-2">
        <ApButton
          compact
          className="min-w-0 flex-1 px-3"
          variant="primary"
          label={t("recheck")}
          icon={<Camera className="size-4" aria-hidden />}
          onClick={onRecheck}
        />
        <ApButton
          compact
          className="min-w-0 flex-1 px-3"
          variant="outline"
          label={t("askAgronomist")}
          icon={<User className="size-4" aria-hidden />}
          onClick={() => toast(t("askSent"))}
        />
      </div>
    </div>
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

function buildPresented(data: unknown, t: TFn): Presented | null {
  if (!isRecord(data) || !isRecord(data.result)) return null;
  const result = data.result;
  const source = data.source === "gemini" || data.source === "demo" ? data.source : undefined;
  const confidence = asConfidence(result.confidence);

  if (data.mode === "leaf" && typeof result.label === "string") {
    const label = result.label;
    let title = label;
    let latin: string | undefined;
    let tone: PillTone = "warn";
    let pillKey: PillKey = "watch";
    if (label === "Healthy") {
      title = t("healthyLeaf");
      tone = "good";
      pillKey = "healthy";
    } else if (label === "Olive Peacock Spot") {
      title = t("peacock");
      latin = LATIN.peacock;
      tone = "risk";
      pillKey = "highRisk";
    } else if (label === "Aculus Olearius") {
      title = t("budMite");
      latin = LATIN.mite;
    }
    const toneGood = tone === "good";
    return {
      mode: "leaf",
      title,
      latin,
      summary: strings(result.symptoms).join(" "),
      tone,
      pillKey,
      confidence,
      source,
      actionKind: toneGood ? "healthy" : "care",
      showNoChemicals: !toneGood,
    };
  }

  if (data.mode === "fruit" && typeof result.diagnosis === "string") {
    const dx = result.diagnosis;
    let title = dx;
    let latin: string | undefined;
    let tone: PillTone = "warn";
    let pillKey: PillKey = "watch";
    if (dx === "healthy") {
      title = t("healthyFruit");
      tone = "good";
      pillKey = "healthy";
    } else if (dx === "olive fly sting") {
      title = t("oliveFly");
      latin = LATIN.fly;
      tone = "risk";
      pillKey = "highRisk";
    } else if (dx === "other damage") {
      title = t("otherDamage");
    } else if (dx === "unclear") {
      title = t("notClear");
    }
    const toneGood = tone === "good";
    return {
      mode: "fruit",
      title,
      latin,
      summary: strings(result.symptoms).join(" "),
      tone,
      pillKey,
      confidence,
      source,
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
      summary: typeof result.notes === "string" ? result.notes : "",
      tone,
      pillKey,
      confidence,
      source,
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
