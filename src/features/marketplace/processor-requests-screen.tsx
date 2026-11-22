"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronRight, Minus, MoreHorizontal, Plus, X } from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Chip } from "@/shared/components/brand/chip";
import { Pill } from "@/shared/components/brand/pill";
import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import {
  MARKET_LIMITS,
  euroPrice,
  euroTotal,
  formatQuantity,
  kgToTons,
  parseBounded,
  parseLocaleNumber,
  saleTotal,
  tonsToKg,
} from "@/features/marketplace/pricing";
import {
  OIL_CATEGORIES,
  ProductBadge,
  oilCategoryI18nKey,
  productI18nKey,
} from "@/features/marketplace/product-badge";
import type { OilCategory, ProductKind } from "@/shared/types/database";
import {
  defaultVarietySlug,
  marketplaceVarietyOptions,
  resolveOliveCountry,
  resolveOliveVariety,
} from "@/features/fields/olive-varieties";
import {
  ChipGroup,
  DayChipPicker,
  Dialog,
  Initials,
  initialsOf,
  PageHeader,
  Panel,
  Segmented,
  Switch,
  TextField,
  useAsyncDialog,
} from "./processor-kit";
import { RangeCalendar } from "./range-calendar";
import {
  SCORE_SLIDER_MAX,
  SCORE_SLIDER_MIN,
  ScoreSlider,
  scoreBand,
  scoreToneClassName,
} from "./score-slider";
import { marketRegionOptions, regionLabel, resolveMarketRegion } from "./regions";

const RegionMap = dynamic(() => import("./region-map").then((m) => m.RegionMap), {
  ssr: false,
  loading: () => <div className="h-[260px] w-full animate-pulse rounded-[18px] bg-soft" />,
});
import {
  DEFAULT_DELIVERY_IN_DAYS,
  addDaysIso,
  formatWindowLabel,
  localizeStoredWindowLabel,
  nextSevenDays,
  todayIsoDate,
} from "./schedule";
import {
  acceptIncomingOffer,
  counterIncomingOffer,
  createBuyRequest,
  deactivateBuyRequest,
  rejectOffer,
  updateBuyRequest,
  useProcessorMarket,
  type ProcessorOffer,
  type ProcessorRequest,
} from "./use-processor-market";
import { useVarietyLabel } from "./processor-shared";
import { useBoundsMessage, useErrorMessage } from "@/shared/lib/error-message";

const SCORE_MIN = SCORE_SLIDER_MIN;
const SCORE_MAX = SCORE_SLIDER_MAX;

/* ---------- local helpers (requests screen only) ---------- */

const MONTH_LOCALES = ["el", "en", "tr"] as const;

const foldMonth = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ.]/g, "")
    .toLocaleLowerCase("en")
    .trim();

let monthIndexCache: Map<string, number> | null = null;
/** Short month names (el / en / tr) → 0-based month index. */
function monthIndex(): Map<string, number> {
  if (monthIndexCache) return monthIndexCache;
  const map = new Map<string, number>();
  for (const loc of MONTH_LOCALES) {
    for (let m = 0; m < 12; m++) {
      const d = new Date(2026, m, 15, 12);
      const standalone = d.toLocaleDateString(loc, { month: "short" });
      const withDay = d.toLocaleDateString(loc, { day: "numeric", month: "short" }).replace(/\d+/g, "");
      for (const name of [standalone, withDay]) {
        const key = foldMonth(name);
        if (key) map.set(key, m);
        if (key.length > 3) map.set(key.slice(0, 3), m);
      }
    }
  }
  monthIndexCache = map;
  return map;
}

/** Pick the year that puts a day/month closest to today (windows are near-term). */
function nearestDate(day: number, month: number, today = new Date()): Date {
  const candidates = [-1, 0, 1].map((dy) => new Date(today.getFullYear() + dy, month, day, 12));
  return candidates.reduce((a, b) =>
    Math.abs(b.getTime() - today.getTime()) < Math.abs(a.getTime() - today.getTime()) ? b : a,
  );
}

/**
 * Parse a stored window label ("15–24 Nov", "15 Νοε–24 Νοε", "28 Kas–7 Ara") written
 * in any UI language into real dates.
 */
function parseWindowLabel(label: string | null | undefined): { start: Date; end: Date } | null {
  if (!label?.trim()) return null;
  // Day-first ("15 Nov–24 Nov", "15–24 Νοε") or month-first ("Nov 15–Nov 24", "Nov 15 – 24").
  const dayFirst = /^\s*(\d{1,2})\s*([^\d–\-]*?)\s*[–\-]\s*(\d{1,2})\s*([^\d–\-]*?)\s*$/.exec(label);
  const monthFirst = dayFirst
    ? null
    : /^\s*([^\d–\-]+?)\s*(\d{1,2})\s*[–\-]\s*([^\d–\-]*?)\s*(\d{1,2})\s*$/.exec(label);
  const m = dayFirst ?? (monthFirst ? [monthFirst[0], monthFirst[2], monthFirst[1], monthFirst[4], monthFirst[3] || monthFirst[1]] : null);
  if (!m) return null;
  const months = monthIndex();
  const endMonth = months.get(foldMonth(m[4] ?? "")) ?? months.get(foldMonth(m[4] ?? "").slice(0, 3));
  if (endMonth == null) return null;
  const startMonthRaw = m[2] ? months.get(foldMonth(m[2])) ?? months.get(foldMonth(m[2]).slice(0, 3)) : undefined;
  const end = nearestDate(Number(m[3]), endMonth);
  let start = new Date(end.getFullYear(), startMonthRaw ?? endMonth, Number(m[1]), 12);
  if (start.getTime() > end.getTime()) start = new Date(end.getFullYear() - 1, start.getMonth(), start.getDate(), 12);
  return { start, end };
}

/** "15–25 Νοε" / "Nov 15 – 25" / "15-25 Kas" in the UI locale. */
function formatDateRange(start: Date, end: Date, locale: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  try {
    const fmt = new Intl.DateTimeFormat(locale, opts);
    if (typeof fmt.formatRange === "function") return fmt.formatRange(start, end);
  } catch {
    /* fall through */
  }
  return `${start.toLocaleDateString(locale, opts)}–${end.toLocaleDateString(locale, opts)}`;
}

function windowLabelForLocale(label: string | null | undefined, locale: string): string {
  const parsed = parseWindowLabel(label);
  if (!parsed) return localizeStoredWindowLabel(label, locale);
  return formatDateRange(parsed.start, parsed.end, locale);
}

const isoOf = (d: Date) => todayIsoDate(d);

/** Two Greek capital letters from the variety's Greek name: Κορωνέικη → ΚΟ. */
function varietyMonogram(stored: string, fallbackLabel: string): string {
  const greek = resolveOliveVariety(stored)?.name_el;
  if (!greek) return initialsOf(fallbackLabel);
  const letters = Array.from(greek.replace(/[^\p{L}\p{M}]/gu, "").normalize("NFC")).slice(0, 2).join("");
  return letters.toLocaleUpperCase("el");
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-[13px] leading-[18px] font-semibold text-muted-foreground">{children}</span>;
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function splitStoredList(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function joinStoredList(values: string[]): string {
  return values.join(", ");
}

function FormChips({
  label,
  ariaLabel,
  options,
  values,
  onChange,
}: {
  label?: string;
  ariaLabel?: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label={label ?? ariaLabel}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = values.includes(o.value);
          return (
            <Chip key={o.value} tone="black" on={on} onClick={() => onChange(toggleValue(values, o.value))}>
              <span className={cn("text-[12px] leading-4 font-bold", on ? "text-white" : "text-ink")}>{o.label}</span>
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

function FormSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
      <span className="text-[14px] leading-5 font-semibold text-ink">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} label={label} />
    </label>
  );
}

/* ---------- region map (new-request form) ---------- */

/* ---------- tonnes stepper ---------- */

function TonsStepper({
  label,
  value,
  onChange,
  decLabel,
  incLabel,
  suffix = "t",
  stepBy = 1,
  min = 1,
  max = MARKET_LIMITS.requestTons.max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  decLabel: string;
  incLabel: string;
  suffix?: string;
  stepBy?: number;
  min?: number;
  max?: number;
}) {
  const n = parseLocaleNumber(value);
  const step = (delta: number) => {
    const base = n ?? 0;
    onChange(String(Math.min(max, Math.max(min, Math.round(base + delta)))));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex h-12 max-w-[260px] items-stretch overflow-hidden rounded-xl border border-line bg-card focus-within:border-ink">
        <button
          type="button"
          aria-label={decLabel}
          onClick={() => step(-stepBy)}
          className="flex w-12 items-center justify-center border-r border-line text-ink hover:bg-soft"
        >
          <Minus className="size-4" />
        </button>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent text-center text-[18px] font-extrabold text-ink outline-none"
        />
        <span className="flex items-center pr-3 text-[14px] font-semibold text-muted-foreground">{suffix}</span>
        <button
          type="button"
          aria-label={incLabel}
          onClick={() => step(stepBy)}
          className="flex w-12 items-center justify-center border-l border-line text-ink hover:bg-soft"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

const isoToDate = (iso: string) => new Date(`${iso}T12:00:00`);
const daysBetween = (a: string, b: string) =>
  Math.round((isoToDate(b).getTime() - isoToDate(a).getTime()) / 86_400_000);

/* ---------- full-screen request composer ---------- */

function SectionCard({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[18px] border border-line bg-card p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-extrabold text-white">
          {step}
        </span>
        <h3 className="text-[18px] leading-6 font-extrabold text-ink">{title}</h3>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

function SummaryRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
      <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
      <span className={cn("text-right text-[14px] font-extrabold", muted ? "text-muted-foreground" : "text-ink")}>
        {value}
      </span>
    </div>
  );
}

function FullScreenPanel({
  open,
  onClose,
  title,
  subtitle,
  closeLabel,
  footer,
  headerActions,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  closeLabel: string;
  footer: ReactNode;
  headerActions: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[60] flex flex-col bg-background min-[900px]:left-[240px]">
      <header className="shrink-0 border-b border-line bg-card">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-card hover:bg-soft"
          >
            <X className="size-[18px] text-ink" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[20px] leading-6 font-extrabold text-ink sm:text-[22px]">{title}</h2>
            <p className="hidden truncate text-[13px] font-medium text-muted-foreground sm:block">{subtitle}</p>
          </div>
          <div className="hidden items-center gap-2 lg:flex">{headerActions}</div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <footer className="shrink-0 border-t border-line bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        {footer}
      </footer>
    </div>
  );
}

function RequestMenu({
  label,
  editLabel,
  closeLabel,
  disabled,
  onEdit,
  onCloseRequest,
}: {
  label: string;
  editLabel: string;
  closeLabel: string;
  disabled: boolean;
  onEdit: () => void;
  onCloseRequest: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex size-10 items-center justify-center rounded-full text-ink hover:bg-soft disabled:opacity-50"
      >
        <MoreHorizontal className="size-5" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} role="presentation" />
          <div
            role="menu"
            className="absolute top-11 right-0 z-50 min-w-[200px] overflow-hidden rounded-xl border border-line bg-card py-1 shadow-[0_12px_32px_rgba(0,0,0,0.16)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="flex h-11 w-full items-center px-4 text-left text-[14px] font-semibold text-ink hover:bg-soft"
            >
              {editLabel}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onCloseRequest();
              }}
              className="flex h-11 w-full items-center px-4 text-left text-[14px] font-semibold text-risk hover:bg-risk-soft"
            >
              {closeLabel}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Max free acidity (% oleic) per grade; lampante has no upper cap. */
const ACIDITY_CAP: Record<OilCategory, number | null> = {
  extra_virgin: 0.8,
  virgin: 2.0,
  lampante: null,
};

function acidityCapLabel(c: OilCategory, locale: string): string {
  const cap = ACIDITY_CAP[c];
  if (cap == null) return "";
  return cap.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export function ProcessorRequestsScreen() {
  const t = useTranslations("processor");
  const errMsg = useErrorMessage();
  const boundsMsg = useBoundsMessage();
  const { confirm: confirmDialog, prompt: promptDialog, dialog: asyncDialog } = useAsyncDialog();
  const locale = useLocale();
  const varietyLabel = useVarietyLabel();
  // Mills buy across the border too: show both countries' varieties (locale's country first), deduped.
  const varietyOptions = useMemo(() => {
    const own = resolveOliveCountry({ locale }).country;
    const other = own === "GR" ? "TR" : "GR";
    const seen = new Set<string>();
    return [
      ...marketplaceVarietyOptions(locale, { profileCountry: own }),
      ...marketplaceVarietyOptions(locale, { profileCountry: other }),
    ].filter((v) => (seen.has(v.value) ? false : (seen.add(v.value), true)));
  }, [locale]);
  const { requests, offers, loading, error, reload } = useProcessorMarket();
  const [open, setOpen] = useState(false);
  const [varieties, setVarieties] = useState<string[]>(() => [
    defaultVarietySlug(resolveOliveCountry({ locale }).country),
  ]);
  const [tons, setTons] = useState("10");
  const [minScore, setMinScore] = useState(75);
  const todayIso = useMemo(() => todayIsoDate(), []);
  const [rangeStart, setRangeStart] = useState<string | null>(() => todayIso);
  const [rangeEnd, setRangeEnd] = useState<string | null>(() => addDaysIso(todayIso, 9));
  const [calendarKey, setCalendarKey] = useState(0);
  const [provinces, setProvincesRaw] = useState<string[]>([]);
  // Chips and map can both add a region — keep one canonical entry per region (no duplicate «Πελοπόννησος»).
  const setProvinces = useCallback(
    (next: string[]) =>
      setProvincesRaw([...new Set(next.map((r) => resolveMarketRegion(r) ?? r))]),
    [],
  );
  const [noBanned, setNoBanned] = useState(true);
  const [product, setProduct] = useState<ProductKind>("oil");
  const [maxAcidity, setMaxAcidity] = useState("");
  const [oilCategory, setOilCategory] = useState<OilCategory | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [acceptOffer, setAcceptOffer] = useState<ProcessorOffer | null>(null);
  const [acceptDate, setAcceptDate] = useState(() => addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS));
  const weekDates = useMemo(() => nextSevenDays(), []);
  const regionOptions = useMemo(() => marketRegionOptions(locale), [locale]);

  const openRequests = requests.filter((r) => r.active);
  const offersForRequest = (requestId: string) =>
    offers.filter(
      (o) =>
        o.buyRequestId === requestId &&
        o.initiatedBy === "farmer" &&
        (o.status === "pending" || o.status === "countered"),
    );

  const resetForm = () => {
    setVarieties([defaultVarietySlug(resolveOliveCountry({ locale }).country)]);
    setProduct("oil");
    setTons("500");
    setMinScore(75);
    setRangeStart(todayIso);
    setRangeEnd(addDaysIso(todayIso, 9));
    setCalendarKey((k) => k + 1);
    setProvinces([]);
    setNoBanned(true);
    setMaxAcidity("");
    setOilCategory(null);
  };

  const openNew = () => {
    setEditingId(null);
    resetForm();
    setOpen(true);
  };

  const openEdit = (req: ProcessorRequest) => {
    setEditingId(req.id);
    const parsedVarieties = splitStoredList(req.variety).map(
      (v) => resolveOliveVariety(v)?.slug ?? v,
    );
    setVarieties(
      parsedVarieties.length > 0
        ? parsedVarieties
        : [resolveOliveVariety(req.variety)?.slug ?? req.variety],
    );
    setProduct(req.product ?? "olives");
    setTons(req.product === "oil" ? String(tonsToKg(req.tons)) : String(req.tons));
    setMaxAcidity(req.maxAcidity != null ? String(req.maxAcidity) : "");
    setOilCategory(req.oilCategory);
    setMinScore(Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(req.minScore || 75))));
    const parsed = parseWindowLabel(req.windowLabel);
    setRangeStart(parsed ? isoOf(parsed.start) : todayIso);
    setRangeEnd(parsed ? isoOf(parsed.end) : addDaysIso(todayIso, 9));
    setCalendarKey((k) => k + 1);
    const parsedRegions = splitStoredList(req.region)
      .map((r) => resolveMarketRegion(r))
      .filter((r): r is NonNullable<typeof r> => r != null);
    setProvinces(parsedRegions);
    setNoBanned(req.noBanned);
    setOpen(true);
  };

  const closeForm = () => {
    setOpen(false);
    setEditingId(null);
  };

  const onSubmit = async () => {
    if (saving) return;
    const isOil = product === "oil";
    const tc = parseBounded(tons, isOil ? MARKET_LIMITS.oilRequestKg : MARKET_LIMITS.requestTons);
    if (!tc.ok) {
      toast.error(boundsMsg(tc, isOil ? "kg" : "tons", locale));
      return;
    }
    const tonsN = isOil ? kgToTons(tc.value) : tc.value;
    const acidityN =
      isOil && maxAcidity.trim()
        ? parseLocaleNumber(maxAcidity)
        : isOil && oilCategory
          ? ACIDITY_CAP[oilCategory]
          : null;
    if (isOil && maxAcidity.trim() && acidityN == null) {
      toast.error(t("maxAcidity"));
      return;
    }
    if (!rangeStart || !rangeEnd) {
      toast.error(t("deliveryPickEnd"));
      return;
    }
    if (varieties.length === 0 || provinces.length === 0) {
      toast.error(t("saveFailed"));
      return;
    }
    setSaving(true);
    const windowLabel = formatWindowLabel(rangeStart, rangeEnd, locale);
    const input = {
      product,
      variety: joinStoredList(varieties),
      tons: tonsN,
      minScore,
      region: joinStoredList(provinces),
      windowLabel,
      noBanned,
      maxAcidity: isOil ? acidityN : null,
      oilCategory: isOil ? oilCategory : null,
    };
    const wasEditing = editingId != null;
    const res = editingId ? await updateBuyRequest(editingId, input) : await createBuyRequest(input);
    setSaving(false);
    if (!res.ok) {
      toast.error(errMsg(res.error, "saveFailed"));
      return;
    }
    closeForm();
    toast.success(wasEditing ? t("requestUpdated") : t("requestCreated"));
    await reload();
  };

  const onCloseRequest = async (requestId: string) => {
    if (!(await confirmDialog(t("deleteRequestConfirm")))) return;
    setBusyId(requestId);
    try {
      const res = await deactivateBuyRequest(requestId);
      if (!res.ok) {
        toast.error(errMsg(res.error, "saveFailed"));
        return;
      }
      toast.success(t("requestDeleted"));
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const onAcceptConfirm = async () => {
    if (!acceptOffer) return;
    setBusyId(acceptOffer.id);
    try {
      const res = await acceptIncomingOffer(acceptOffer.id, { scheduledFor: acceptDate });
      if (!res.ok) {
        toast.error(errMsg(res.error, "saveFailed"));
        return;
      }
      toast.success(t("acceptedScheduled", { date: new Date(`${acceptDate}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" }) }));
      setAcceptOffer(null);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const onRejectOffer = async (offer: ProcessorOffer) => {
    if (!(await confirmDialog(t("rejectConfirm")))) return;
    setBusyId(offer.id);
    try {
      const res = await rejectOffer(offer.id);
      if (!res.ok) {
        toast.error(errMsg(res.error, "saveFailed"));
        return;
      }
      toast.success(t("rejectedOk"));
      setAcceptOffer(null);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const onCounterOffer = async (offer: ProcessorOffer) => {
    const suggested = Math.max(0.05, Math.round((offer.pricePerKg - 0.05) * 100) / 100);
    const raw = await promptDialog(t("counterPrompt"), String(suggested).replace(".", ","));
    if (raw == null) return;
    const pc = parseBounded(raw, MARKET_LIMITS.pricePerKg);
    if (!pc.ok) {
      toast.error(boundsMsg(pc, "price", locale));
      return;
    }
    const next = pc.value;
    setBusyId(offer.id);
    try {
      const res = await counterIncomingOffer(offer, next);
      if (!res.ok) {
        toast.error(errMsg(res.error, "saveFailed"));
        return;
      }
      toast.success(t("counterSentDetail"));
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {asyncDialog}
      <PageHeader
        title={t("requestsTitle")}
        subtitle={t("requestsSubtitle")}
        action={
          <ApButton label={t("newRequest")} variant="dark" icon={<Plus className="size-4" />} onClick={openNew} />
        }
      />

      {error === "needSupabase" || error === "needLogin" ? (
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">{t(error)}</ApCard>
      ) : null}

      <Dialog
        open={acceptOffer != null}
        onClose={() => setAcceptOffer(null)}
        title={t("offerDetailTitle")}
        subtitle={t("offerDetailHint")}
        actionLabel={busyId ? t("loading") : t("accept")}
        actionDisabled={busyId != null}
        onAction={() => onAcceptConfirm()}
      >
        {acceptOffer ? (
          <div className="mb-4 space-y-2 rounded-xl bg-soft p-3">
            <p className="text-[18px] font-extrabold text-ink">
              {t("asksPrice", { price: euroPrice(acceptOffer.pricePerKg) })}
            </p>
            <p className="text-[13px] text-muted-foreground">
              {formatQuantity(acceptOffer.lot?.product ?? "olives", acceptOffer.tons, locale)} · {t("approx", { total: euroTotal(saleTotal(acceptOffer.tons, acceptOffer.pricePerKg)) })}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <ApButton
                label={t("reject")}
                variant="outline"
                disabled={busyId != null}
                onClick={() => void onRejectOffer(acceptOffer)}
              />
              <ApButton
                label={t("counter")}
                variant="outline"
                disabled={busyId != null}
                onClick={() => void onCounterOffer(acceptOffer)}
              />
            </div>
          </div>
        ) : null}
        <DayChipPicker
          label={t("arriveOn")}
          days={weekDates}
          value={acceptDate}
          onChange={setAcceptDate}
          formatDay={(iso) =>
            new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric" })
          }
          todayLabel={t("todayShort")}
        />
      </Dialog>

      <Panel title={t("openRequestsCount", { count: openRequests.length })}>
        {openRequests.length === 0 ? (
          <div className="border-t border-line px-4 py-10 text-center text-[13px] font-semibold text-muted-foreground">
            {loading ? t("loading") : t("noOpenRequests")}
          </div>
        ) : (
          openRequests.map((req, i) => {
            const pct = req.tons > 0 ? Math.min(100, Math.round((req.filledTons / req.tons) * 100)) : 0;
            const linked = offersForRequest(req.id);
            return (
              <div key={req.id} className={cn("relative px-4 py-4", i > 0 && "border-t border-line")}>
                <div className="absolute top-3 right-2">
                  <RequestMenu
                    label={t("requestActions")}
                    editLabel={t("editRequest")}
                    closeLabel={t("closeRequest")}
                    disabled={busyId != null}
                    onEdit={() => openEdit(req)}
                    onCloseRequest={() => void onCloseRequest(req.id)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4 pr-10">
                  <Initials
                    text={varietyMonogram(
                      splitStoredList(req.variety)[0] ?? req.variety,
                      varietyLabel(splitStoredList(req.variety)[0] ?? req.variety),
                    )}
                    size={44}
                  />
                  <div className="min-w-[200px] flex-1">
                    <div className="mb-1">
                      <ProductBadge product={req.product} label={t(productI18nKey(req.product))} />
                    </div>
                    <p className="text-[16px] font-extrabold text-ink">
                      {(splitStoredList(req.variety).map((v) => varietyLabel(v)).join(" · ") ||
                        varietyLabel(req.variety))}{" "}
                      · {formatQuantity(req.product, req.tons, locale)}
                    </p>
                    <p className="text-[13px] font-medium text-muted-foreground">
                      {[
                        req.region ? regionLabel(req.region, locale) : null,
                        req.windowLabel ? windowLabelForLocale(req.windowLabel, locale) : null,
                        t("requestScoreMin", { score: String(req.minScore) }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <div className="mt-2 h-2 max-w-[280px] overflow-hidden rounded-full bg-soft">
                      <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-[12px] font-semibold text-muted-foreground">
                      {t("filledPct", { pct })} ·{" "}
                      {t("filledOf", {
                        filled: formatQuantity(req.product, req.filledTons, locale),
                        total: formatQuantity(req.product, req.tons, locale),
                      })}
                    </p>
                  </div>
                  {req.noBanned ? <Pill tone="good">{t("noBannedProducts")}</Pill> : null}
                </div>

                <div className="mt-3 rounded-xl border border-dashed border-line bg-background/60 p-3">
                  <p className="text-[12px] font-bold text-ink">
                    {t("offersOnRequest", { count: linked.length })}
                  </p>
                  {linked.length === 0 ? (
                    <p className="mt-1 text-[12px] text-muted-foreground">{t("noOffersOnRequest")}</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {linked.map((offer) => {
                        const score = offer.lot?.qualityScore ?? null;
                        return (
                          <Link
                            key={offer.id}
                            href={`/processor/offers/${offer.id}`}
                            className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 transition-colors hover:border-ink"
                          >
                            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] font-semibold text-ink">
                              {score != null ? (
                                <span
                                  className={cn(
                                    "rounded-md px-1.5 py-0.5 text-[12px] font-extrabold",
                                    scoreToneClassName(score),
                                  )}
                                >
                                  {t("lotScore", { score: String(Math.round(score)) })}
                                </span>
                              ) : null}
                              <span>
                                {[
                                  `${euroPrice(offer.pricePerKg)}/kg`,
                                  formatQuantity(req.product, offer.tons, locale),
                                  t("approx", { total: euroTotal(saleTotal(offer.tons, offer.pricePerKg)) }),
                                ].join(" · ")}
                              </span>
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </Panel>

      {(() => {
        const title = editingId ? t("editRequestTitle") : t("newRequest");
        const actionLabel = saving ? t("loading") : editingId ? t("saveChanges") : t("createRequest");
        const canSubmit =
          !saving &&
          rangeStart != null &&
          rangeEnd != null &&
          parseBounded(tons, product === "oil" ? MARKET_LIMITS.oilRequestKg : MARKET_LIMITS.requestTons).ok &&
          varieties.length > 0 &&
          provinces.length > 0;
        const rangeText =
          rangeStart && rangeEnd
            ? formatDateRange(isoToDate(rangeStart), isoToDate(rangeEnd), locale)
            : rangeStart
              ? `${isoToDate(rangeStart).toLocaleDateString(locale, { day: "numeric", month: "short" })} – …`
              : t("pickDeliveryDates");
        const rangeDays = rangeStart && rangeEnd ? daysBetween(rangeStart, rangeEnd) + 1 : null;
        const tonsCheck = parseBounded(
          tons,
          product === "oil" ? MARKET_LIMITS.oilRequestKg : MARKET_LIMITS.requestTons,
        );
        const tonsN = tonsCheck.ok
          ? product === "oil"
            ? kgToTons(tonsCheck.value)
            : tonsCheck.value
          : NaN;
        const qtyLabel = Number.isFinite(tonsN) && tonsN > 0 ? formatQuantity(product, tonsN, locale) : "—";
        const presets = [7, 14, 30];
        const band = scoreBand(minScore);
        const varietiesText = varieties.map((v) => varietyLabel(v)).join(" · ") || "—";
        const provincesText = provinces.map((p) => regionLabel(p, locale)).join(" · ") || "—";
        const primaryVariety = varieties[0] ?? defaultVarietySlug(resolveOliveCountry({ locale }).country);

        const submitButton = (full: boolean) => (
          <ApButton
            label={actionLabel}
            variant="dark"
            disabled={!canSubmit}
            onClick={() => void onSubmit()}
            className={full ? "w-full" : undefined}
          />
        );

        return (
          <FullScreenPanel
            open={open}
            onClose={closeForm}
            title={title}
            subtitle={t("newRequestSubtitle")}
            closeLabel={t("closeDialog")}
            headerActions={
              <>
                <ApButton label={t("cancel")} variant="outline" onClick={closeForm} />
                {submitButton(false)}
              </>
            }
            footer={
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-extrabold text-ink">
                    {varietiesText} · {qtyLabel}
                  </p>
                  <p className="truncate text-[12px] font-semibold text-muted-foreground">
                    {rangeText} · {t("requestScoreMin", { score: String(minScore) })}
                  </p>
                </div>
                <div className="shrink-0">{submitButton(false)}</div>
              </div>
            }
          >
            <div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:py-8">
              <div className="flex min-w-0 flex-col gap-5">
                <SectionCard step={1} title={t("requestFormProduct")}>
                  <Segmented
                    value={product}
                    onChange={(next) => {
                      setProduct(next);
                      setTons(next === "oil" ? "500" : "10");
                      if (next !== "oil") {
                        setMaxAcidity("");
                        setOilCategory(null);
                      }
                    }}
                    options={[
                      { value: "oil", label: t("productOil") },
                      { value: "olives", label: t("productOlives") },
                    ]}
                  />
                  <FormChips
                    label={t("variety")}
                    values={varieties}
                    onChange={setVarieties}
                    options={varietyOptions.map((v) => ({ value: v.value, label: v.label }))}
                  />
                  <TonsStepper
                    label={product === "oil" ? t("quantityKg") : t("tonnesNeeded")}
                    value={tons}
                    onChange={setTons}
                    decLabel={t("decreaseTons")}
                    incLabel={t("increaseTons")}
                    suffix={product === "oil" ? "kg" : "t"}
                    stepBy={product === "oil" ? 50 : 1}
                    min={product === "oil" ? MARKET_LIMITS.oilRequestKg.min : 1}
                    max={product === "oil" ? MARKET_LIMITS.oilRequestKg.max : MARKET_LIMITS.requestTons.max}
                  />
                  {!tonsCheck.ok && tons.trim() ? (
                    <p className="text-[13px] font-semibold text-risk" role="alert">
                      {boundsMsg(tonsCheck, product === "oil" ? "kg" : "tons", locale)}
                    </p>
                  ) : null}
                  {product === "oil" ? (
                    <>
                      <ChipGroup
                        label={t("oilCategory")}
                        value={oilCategory ?? "all"}
                        onChange={(v) => {
                          const next = v === "all" ? null : (v as OilCategory);
                          setOilCategory(next);
                          // Acidity cap follows the grade (EU 2022/2104): EVOO 0.8, virgin 2.0.
                          setMaxAcidity(next ? acidityCapLabel(next, locale) : "");
                        }}
                        options={[
                          { value: "all", label: t("filterAll") },
                          ...OIL_CATEGORIES.map((c) => ({
                            value: c,
                            label: t(oilCategoryI18nKey(c)),
                          })),
                        ]}
                      />
                      <TextField
                        label={t("maxAcidity")}
                        value={maxAcidity}
                        onChange={setMaxAcidity}
                        suffix="%"
                        inputMode="decimal"
                        placeholder={oilCategory ? acidityCapLabel(oilCategory, locale) : "—"}
                      />
                    </>
                  ) : null}
                </SectionCard>

                <SectionCard step={2} title={t("requestFormQuality")}>
                  {product === "olives" ? (
                    <ScoreSlider
                      label={t("minScore")}
                      value={minScore}
                      onChange={setMinScore}
                      valueLabel={t("requestScoreMin", { score: String(minScore) })}
                      bandLabel={t(band === "high" ? "scoreBandHigh" : band === "mid" ? "scoreBandMid" : "scoreBandLow")}
                      hint={t("scoreSliderHint", { score: String(minScore) })}
                    />
                  ) : null}
                  <div className={cn(product === "olives" && "border-t border-line pt-4")}>
                    <FormSwitch label={t("noBannedOnly")} checked={noBanned} onChange={setNoBanned} />
                  </div>
                </SectionCard>

                <SectionCard step={3} title={t("deliveryWindow")}>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-soft px-4 py-3">
                    <div>
                      <p className="text-[16px] font-extrabold text-ink">{rangeText}</p>
                      <p className="text-[12px] font-semibold text-muted-foreground">
                        {rangeDays != null
                          ? t("daysCount", { count: rangeDays })
                          : rangeStart
                            ? t("deliveryPickEnd")
                            : t("deliveryRangeHint")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {presets.map((n) => {
                        const on = rangeStart === todayIso && rangeEnd === addDaysIso(todayIso, n - 1);
                        return (
                          <Chip
                            key={n}
                            tone="black"
                            on={on}
                            onClick={() => {
                              setRangeStart(todayIso);
                              setRangeEnd(addDaysIso(todayIso, n - 1));
                              setCalendarKey((k) => k + 1);
                            }}
                          >
                            <span className={cn("text-[12px] leading-4 font-bold", on ? "text-white" : "text-ink")}>
                              {t("presetNextDays", { count: n })}
                            </span>
                          </Chip>
                        );
                      })}
                    </div>
                  </div>
                  <RangeCalendar
                    key={calendarKey}
                    start={rangeStart}
                    end={rangeEnd}
                    onChange={(a, b) => {
                      setRangeStart(a);
                      setRangeEnd(b);
                    }}
                    locale={locale}
                    monthsShown={2}
                    minIso={todayIso}
                    prevLabel={t("prevMonth")}
                    nextLabel={t("nextMonth")}
                  />
                </SectionCard>

                <SectionCard step={4} title={t("province")}>
                  <FormChips
                    ariaLabel={t("province")}
                    values={provinces}
                    onChange={setProvinces}
                    options={regionOptions}
                  />
                  {open ? (
                    <RegionMap
                      values={provinces}
                      onChange={setProvinces}
                      locale={locale}
                      label={t("regionMapLabel")}
                      needTokenLabel={t("regionMapUnavailable")}
                    />
                  ) : null}
                </SectionCard>
              </div>

              <aside className="hidden self-start lg:sticky lg:top-8 lg:block">
                <div className="rounded-[18px] border border-line bg-card p-6">
                  <p className="mb-4 text-[16px] font-extrabold text-ink">{t("requestSummary")}</p>
                  <div className="mb-5 flex items-center gap-3">
                    <Initials
                      text={varietyMonogram(primaryVariety, varietyLabel(primaryVariety))}
                      size={44}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-extrabold text-ink">{varietiesText}</p>
                      <p className="text-[13px] font-semibold text-muted-foreground">{qtyLabel}</p>
                    </div>
                  </div>
                  <SummaryRow label={t("minScore")} value={t("requestScoreMin", { score: String(minScore) })} />
                  <SummaryRow
                    label={t("deliveryWindow")}
                    value={rangeDays != null ? `${rangeText} · ${t("daysCount", { count: rangeDays })}` : rangeText}
                    muted={rangeDays == null}
                  />
                  <SummaryRow label={t("province")} value={provincesText} muted={provinces.length === 0} />
                  {noBanned ? <SummaryRow label={t("noBannedProducts")} value="✓" /> : null}
                  <div className="mt-5 flex flex-col gap-2">
                    {submitButton(true)}
                    <p className="text-center text-[12px] font-medium text-muted-foreground">{t("newRequestSubtitle")}</p>
                  </div>
                </div>
              </aside>
            </div>
          </FullScreenPanel>
        );
      })()}
    </div>
  );
}
