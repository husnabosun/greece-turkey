"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Minus, MoreHorizontal, Plus, X } from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { colors } from "@/shared/theme/tokens";
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
  formatTons,
  parseBounded,
  parseLocaleNumber,
  saleTotal,
} from "@/features/marketplace/pricing";
import {
  defaultVarietySlug,
  marketplaceVarietyOptions,
  resolveOliveCountry,
  resolveOliveVariety,
} from "@/features/fields/olive-varieties";
import {
  DayChipPicker,
  Dialog,
  Initials,
  initialsOf,
  PageHeader,
  Panel,
  Switch,
  useAsyncDialog,
} from "./processor-kit";
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

const SCORE_MIN = 50;
const SCORE_MAX = 95;

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

function scoreToneClass(score: number) {
  if (score >= 80) return "bg-good-soft text-good";
  if (score >= 70) return "bg-warn-soft text-warn-text";
  return "bg-risk-soft text-risk";
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  decLabel: string;
  incLabel: string;
}) {
  const n = parseLocaleNumber(value);
  const step = (delta: number) => {
    const base = n ?? 0;
    onChange(String(Math.min(MARKET_LIMITS.requestTons.max, Math.max(1, Math.round(base + delta)))));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex h-12 max-w-[260px] items-stretch overflow-hidden rounded-xl border border-line bg-card focus-within:border-ink">
        <button
          type="button"
          aria-label={decLabel}
          onClick={() => step(-1)}
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
        <span className="flex items-center pr-3 text-[14px] font-semibold text-muted-foreground">t</span>
        <button
          type="button"
          aria-label={incLabel}
          onClick={() => step(1)}
          className="flex w-12 items-center justify-center border-l border-line text-ink hover:bg-soft"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------- minimum-score slider ---------- */

function scoreBand(score: number): "low" | "mid" | "high" {
  if (score >= 80) return "high";
  if (score >= 70) return "mid";
  return "low";
}

const BAND_COLOR = { low: colors.risk, mid: colors.warn, high: colors.good } as const;

function ScoreSlider({
  label,
  value,
  onChange,
  valueLabel,
  bandLabel,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  valueLabel: string;
  bandLabel: string;
  hint: string;
}) {
  const pct = ((value - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100;
  const pos = (v: number) => ((v - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100;
  const band = scoreBand(value);
  const ticks = [50, 60, 70, 80, 90];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <div className="text-right">
          <p className="text-[24px] leading-7 font-extrabold" style={{ color: BAND_COLOR[band] }}>
            {valueLabel}
          </p>
          <p className="text-[12px] font-semibold text-muted-foreground">{bandLabel}</p>
        </div>
      </div>
      <div className="relative h-8">
        {/* zones: <70 risk, 70–79 warn, ≥80 good — dimmed below the chosen minimum */}
        <div className="absolute inset-x-0 top-1/2 flex h-2 -translate-y-1/2 overflow-hidden rounded-full">
          <div style={{ width: `${pos(70)}%`, background: colors.riskSoft }} />
          <div style={{ width: `${pos(80) - pos(70)}%`, background: colors.warnSoft }} />
          <div style={{ flex: 1, background: colors.goodSoft }} />
        </div>
        <div
          className="absolute top-1/2 right-0 h-2 -translate-y-1/2 rounded-r-full"
          style={{ left: `${pct}%`, background: BAND_COLOR[band], opacity: 0.85 }}
        />
        <input
          type="range"
          min={SCORE_MIN}
          max={SCORE_MAX}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          aria-valuetext={valueLabel}
          className={cn(
            "absolute inset-0 h-8 w-full cursor-pointer appearance-none bg-transparent",
            "[&::-webkit-slider-runnable-track]:h-8 [&::-webkit-slider-runnable-track]:bg-transparent",
            "[&::-webkit-slider-thumb]:mt-1 [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-ink [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.35)]",
            "[&::-moz-range-track]:bg-transparent",
            "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-ink [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.35)]",
            "focus-visible:outline-none focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-ink/20",
          )}
        />
      </div>
      <div className="relative h-4 text-[12px] font-semibold text-muted-foreground">
        {ticks.map((tick) => (
          <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${pos(tick)}%` }}>
            {tick}
          </span>
        ))}
      </div>
      <p className="text-[13px] font-medium text-muted-foreground">{hint}</p>
    </div>
  );
}

/* ---------- booking-style date-range calendar ---------- */

const isoToDate = (iso: string) => new Date(`${iso}T12:00:00`);
const daysBetween = (a: string, b: string) =>
  Math.round((isoToDate(b).getTime() - isoToDate(a).getTime()) / 86_400_000);

function monthStart(iso: string) {
  const d = isoToDate(iso);
  return new Date(d.getFullYear(), d.getMonth(), 1, 12);
}

function RangeCalendar({
  start,
  end,
  onChange,
  locale,
  monthsShown,
  minIso,
  prevLabel,
  nextLabel,
}: {
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
  locale: string;
  monthsShown: 1 | 2;
  minIso: string;
  prevLabel: string;
  nextLabel: string;
}) {
  const [view, setView] = useState(() => monthStart(start ?? minIso));
  const [hover, setHover] = useState<string | null>(null);
  const minMonth = monthStart(minIso);

  const weekdays = useMemo(
    // 2026-11-16 is a Monday → Mon..Sun headers in the UI locale.
    () => Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 16 + i, 12).toLocaleDateString(locale, { weekday: "short" })),
    [locale],
  );

  const pick = (iso: string) => {
    if (!start || (start && end)) {
      onChange(iso, null);
    } else if (iso < start) {
      onChange(iso, null);
    } else {
      onChange(start, iso);
    }
  };

  // While choosing the end day, preview the range under the pointer.
  const effEnd = end ?? (start && hover && hover >= start ? hover : null);
  const canGoBack = view.getTime() > minMonth.getTime();
  const shift = (delta: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1, 12));

  const months = Array.from({ length: monthsShown }, (_, i) => new Date(view.getFullYear(), view.getMonth() + i, 1, 12));

  return (
    <div className="select-none" onMouseLeave={() => setHover(null)}>
      <div className={cn("grid gap-6", monthsShown === 2 && "md:grid-cols-2")}>
        {months.map((m, mi) => {
          const offset = (m.getDay() + 6) % 7;
          const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
          const cells: (string | null)[] = [
            ...Array.from({ length: offset }, () => null),
            ...Array.from({ length: daysInMonth }, (_, d) => todayIsoDate(new Date(m.getFullYear(), m.getMonth(), d + 1, 12))),
          ];
          return (
            <div key={m.toISOString()}>
              <div className="mb-3 flex h-10 items-center justify-between">
                {mi === 0 ? (
                  <button
                    type="button"
                    aria-label={prevLabel}
                    disabled={!canGoBack}
                    onClick={() => shift(-1)}
                    className="flex size-10 items-center justify-center rounded-full text-ink hover:bg-soft disabled:opacity-30"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                ) : (
                  <span className="size-10" />
                )}
                <p className="text-[15px] font-extrabold text-ink capitalize">
                  {m.toLocaleDateString(locale, { month: "long", year: "numeric" })}
                </p>
                {mi === months.length - 1 ? (
                  <button
                    type="button"
                    aria-label={nextLabel}
                    onClick={() => shift(1)}
                    className="flex size-10 items-center justify-center rounded-full text-ink hover:bg-soft"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                ) : (
                  <span className="size-10" />
                )}
              </div>
              <div className="grid grid-cols-7 text-center">
                {weekdays.map((w) => (
                  <span key={w} className="pb-2 text-[12px] font-semibold text-muted-foreground">
                    {w}
                  </span>
                ))}
                {cells.map((iso, ci) => {
                  if (!iso) return <span key={`e${ci}`} />;
                  const disabled = iso < minIso;
                  const isStart = iso === start;
                  const isEnd = iso === effEnd;
                  const inside = start != null && effEnd != null && iso > start && iso < effEnd;
                  const edgeBand =
                    start && effEnd && start !== effEnd
                      ? isStart
                        ? `linear-gradient(to right, transparent 50%, ${colors.soft} 50%)`
                        : isEnd
                          ? `linear-gradient(to left, transparent 50%, ${colors.soft} 50%)`
                          : undefined
                      : undefined;
                  const isToday = iso === minIso;
                  return (
                    <div
                      key={iso}
                      className="py-0.5"
                      style={{ background: inside ? colors.soft : edgeBand }}
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => pick(iso)}
                        onMouseEnter={() => setHover(iso)}
                        aria-pressed={isStart || isEnd}
                        aria-label={isoToDate(iso).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                        className={cn(
                          "mx-auto flex size-10 items-center justify-center rounded-full text-[14px] font-semibold transition-colors",
                          disabled && "cursor-not-allowed text-muted-foreground/40 line-through",
                          !disabled && !isStart && !isEnd && "text-ink hover:border hover:border-ink",
                          (isStart || (isEnd && end)) && "bg-ink font-extrabold text-white",
                          isEnd && !end && !isStart && "border-2 border-dashed border-ink font-extrabold text-ink",
                          isToday && !isStart && !isEnd && "underline decoration-2 underline-offset-4",
                        )}
                      >
                        {isoToDate(iso).getDate()}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
    setTons("10");
    setMinScore(75);
    setRangeStart(todayIso);
    setRangeEnd(addDaysIso(todayIso, 9));
    setCalendarKey((k) => k + 1);
    setProvinces([]);
    setNoBanned(true);
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
    setTons(String(req.tons));
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
    const tc = parseBounded(tons, MARKET_LIMITS.requestTons);
    if (!tc.ok) {
      toast.error(boundsMsg(tc, "tons", locale));
      return;
    }
    const tonsN = tc.value;
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
      variety: joinStoredList(varieties),
      tons: tonsN,
      minScore,
      region: joinStoredList(provinces),
      windowLabel,
      noBanned,
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
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">{errMsg(error)}</ApCard>
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
              {acceptOffer.tons} t · {t("approx", { total: euroTotal(saleTotal(acceptOffer.tons, acceptOffer.pricePerKg)) })}
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
                    <p className="text-[16px] font-extrabold text-ink">
                      {(splitStoredList(req.variety).map((v) => varietyLabel(v)).join(" · ") ||
                        varietyLabel(req.variety))}{" "}
                      · {formatTons(req.tons, locale)}
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
                      {t("filledPct", { pct })} · {t("filledOf", { filled: req.filledTons, total: req.tons })}
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
                                    scoreToneClass(score),
                                  )}
                                >
                                  {t("lotScore", { score: String(Math.round(score)) })}
                                </span>
                              ) : null}
                              <span>
                                {[
                                  `${euroPrice(offer.pricePerKg)}/kg`,
                                  formatTons(offer.tons, locale),
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
          parseBounded(tons, MARKET_LIMITS.requestTons).ok &&
          varieties.length > 0 &&
          provinces.length > 0;
        const rangeText =
          rangeStart && rangeEnd
            ? formatDateRange(isoToDate(rangeStart), isoToDate(rangeEnd), locale)
            : rangeStart
              ? `${isoToDate(rangeStart).toLocaleDateString(locale, { day: "numeric", month: "short" })} – …`
              : t("pickDeliveryDates");
        const rangeDays = rangeStart && rangeEnd ? daysBetween(rangeStart, rangeEnd) + 1 : null;
        const tonsCheck = parseBounded(tons, MARKET_LIMITS.requestTons);
        const tonsN = tonsCheck.ok ? tonsCheck.value : NaN;
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
                    {varietiesText} · {Number.isFinite(tonsN) && tonsN > 0 ? formatTons(tonsN, locale) : "—"}
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
                  <FormChips
                    label={t("variety")}
                    values={varieties}
                    onChange={setVarieties}
                    options={varietyOptions.map((v) => ({ value: v.value, label: v.label }))}
                  />
                  <TonsStepper
                    label={t("tonnesNeeded")}
                    value={tons}
                    onChange={setTons}
                    decLabel={t("decreaseTons")}
                    incLabel={t("increaseTons")}
                  />
                  {!tonsCheck.ok && tons.trim() ? (
                    <p className="text-[13px] font-semibold text-risk" role="alert">
                      {boundsMsg(tonsCheck, "tons", locale)}
                    </p>
                  ) : null}
                </SectionCard>

                <SectionCard step={2} title={t("requestFormQuality")}>
                  <ScoreSlider
                    label={t("minScore")}
                    value={minScore}
                    onChange={setMinScore}
                    valueLabel={t("requestScoreMin", { score: String(minScore) })}
                    bandLabel={t(band === "high" ? "scoreBandHigh" : band === "mid" ? "scoreBandMid" : "scoreBandLow")}
                    hint={t("scoreSliderHint", { score: String(minScore) })}
                  />
                  <div className="border-t border-line pt-4">
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
                      <p className="text-[13px] font-semibold text-muted-foreground">
                        {Number.isFinite(tonsN) && tonsN > 0 ? formatTons(tonsN, locale) : "—"}
                      </p>
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
