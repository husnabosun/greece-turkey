"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronRight,
  ClipboardCheck,
  FlaskConical,
  ShieldCheck,
  Truck,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Chip } from "@/shared/components/brand/chip";
import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";

export type LotBadgeId =
  | "lab-suggested"
  | "banned"
  | "no-banned"
  | "reliable-delivery"
  | "complete-records";

export interface LotBadge {
  id: LotBadgeId;
  label: string;
  why?: string;
}

function rowBadges(list: LotBadge[], max = 2): { shown: LotBadge[]; more: number } {
  return { shown: list.slice(0, max), more: Math.max(0, list.length - max) };
}

export function useWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return wide;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-[240px] shrink">
        <h1 className="text-[32px] leading-[38px] font-extrabold text-ink">{title}</h1>
        <p className="mt-1 text-[16px] leading-5 font-medium text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

const ICON_TONES = {
  soft: "bg-soft text-ink",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn-text",
  risk: "bg-risk-soft text-risk",
  accent: "bg-ap-accent-soft text-ap-accent",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon,
  compact = false,
  href,
  attention = false,
  iconTone = "soft",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  compact?: boolean;
  href?: string;
  /** Green border / pulse when the card needs action (e.g. new offers). */
  attention?: boolean;
  iconTone?: keyof typeof ICON_TONES;
}) {
  const body = (
    <div className={cn("relative flex items-start", compact ? "gap-2.5" : "gap-3.5")}>
      <span
        className={cn(
          "absolute top-3 right-3 flex size-8 shrink-0 items-center justify-center rounded-full",
          "min-[900px]:static",
          compact ? "min-[900px]:size-10" : "min-[900px]:size-12",
          ICON_TONES[iconTone],
        )}
      >
        {icon}
        {attention ? (
          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-good ring-2 ring-card" aria-hidden />
        ) : null}
      </span>
      <div className="min-w-0 flex-1 pr-10 min-[900px]:pr-0">
        <p className="text-[12px] leading-4 font-semibold text-muted-foreground">{label}</p>
        <p
          className={cn(
            "font-extrabold tracking-tight text-ink",
            compact ? "mt-0.5 text-[24px] leading-7" : "mt-1 text-[28px] leading-8 min-[900px]:text-[34px] min-[900px]:leading-10",
          )}
        >
          {value}
        </p>
        {hint ? <p className="mt-0.5 text-[12px] leading-[14px] font-medium text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );

  const className = cn(
    "flex min-h-[112px] min-w-[140px] flex-1 flex-col rounded-[18px] border bg-card transition-colors",
    compact ? "p-3.5" : "relative p-4 min-[900px]:p-5",
    attention ? "border-good shadow-[0_0_0_1px_rgba(63,107,47,0.12)]" : "border-line",
    href && "hover:border-ink/30 hover:bg-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
  );

  if (href) {
    if (href.startsWith("#")) {
      return (
        <a href={href} aria-label={label} className={className}>
          {body}
        </a>
      );
    }
    return (
      <Link href={href} aria-label={label} className={className}>
        {body}
      </Link>
    );
  }

  return <ApCard className={cn(className, "border")}>{body}</ApCard>;
}

export function EmptyBlock({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center border-t border-line px-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-soft text-muted-foreground">{icon}</span>
      <p className="mt-3 text-[15px] font-extrabold text-ink">{title}</p>
      <p className="mt-1 max-w-[320px] text-[13px] leading-[18px] font-medium text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Panel({ title, subtitle, right, children }: { title?: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <ApCard className="overflow-hidden">
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
          <div className="min-w-0 shrink">
            <p className="text-[16px] leading-5 font-extrabold text-ink">{title}</p>
            {subtitle ? <p className="text-[13px] leading-[18px] font-medium text-muted-foreground">{subtitle}</p> : null}
          </div>
          {right}
        </div>
      ) : null}
      {children}
    </ApCard>
  );
}

export function Row({
  lead,
  title,
  sub,
  children,
  first = false,
}: {
  lead?: ReactNode;
  title: string;
  sub?: ReactNode;
  children?: ReactNode;
  first?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", !first && "border-t border-line")}>
      <div className="flex min-w-[220px] flex-1 items-center gap-3">
        {lead}
        <div className="min-w-0 flex-1">
          <p className="text-[16px] leading-5 font-extrabold text-ink">{title}</p>
          {sub ? <p className="text-[13px] leading-[18px] font-medium text-muted-foreground">{sub}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

export function Initials({ text, size = 44 }: { text: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-good-soft font-extrabold text-good"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {text}
    </span>
  );
}

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toLocaleUpperCase("tr-TR") ?? "")
    .join("");

function scoreTone(score: number) {
  if (score >= 80) return { bg: "bg-good-soft", text: "text-good" };
  if (score >= 70) return { bg: "bg-warn-soft", text: "text-warn-text" };
  return { bg: "bg-risk-soft", text: "text-risk" };
}

export function ScoreBox({
  score,
  large = false,
  hideLabel = false,
  hero = false,
}: {
  score: number;
  large?: boolean;
  hideLabel?: boolean;
  /** Big score for sticky summary cards. */
  hero?: boolean;
}) {
  const t = useTranslations("processor");
  const tone = scoreTone(score);
  return (
    <div
      className={cn(
        "flex flex-col items-center",
        hero ? "rounded-2xl px-4 py-3" : large ? "rounded-xl px-3 py-2" : "rounded-lg px-2 py-1",
        tone.bg,
      )}
    >
      {!hideLabel ? (
        <span className={cn("font-semibold", hero ? "text-[12px]" : "text-[12px] leading-3", tone.text)}>
          {t("qualityScore")}
        </span>
      ) : null}
      <span
        className={cn(
          "font-extrabold",
          hero ? "text-[40px] leading-none tracking-tight" : large ? "text-[24px] leading-7" : "text-[16px] leading-5",
          tone.text,
        )}
      >
        {score}
      </span>
    </div>
  );
}

export function Amount({ value, unit, large = false }: { value: string; unit?: string; large?: boolean }) {
  return (
    <span className={cn("font-extrabold text-ink", large ? "text-[24px] leading-7" : "text-[16px] leading-5")}>
      {value}
      {unit ? <span className="text-[12px] leading-[14px] font-medium text-muted-foreground">{` ${unit}`}</span> : null}
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  fullWidth = false,
}: {
  options: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (v: T) => void;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn("flex h-10 flex-row rounded-full bg-soft p-1", fullWidth ? "w-full" : "self-start")}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-center justify-center gap-1 rounded-full px-4",
              fullWidth ? "min-w-0 flex-1" : "min-w-[96px]",
              on && "bg-ink",
            )}
          >
            <span className={cn("text-[12px] leading-4 font-bold", on ? "text-white" : "text-muted-foreground")}>{o.label}</span>
            {o.badge ? (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-risk px-1 text-[12px] font-bold text-white">{o.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function ChipGroup({
  label,
  options,
  value,
  onChange,
  chipClassName,
}: {
  label?: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  chipClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <p className="text-[12px] leading-[14px] font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Chip key={o.value} tone="black" on={on} onClick={() => onChange(o.value)} className={chipClassName}>
              <span className={cn("text-[12px] leading-4 font-bold", on ? "text-white" : "text-ink")}>{o.label}</span>
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  suffix,
  inputMode,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  inputMode?: "decimal" | "numeric";
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] leading-[14px] font-bold tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="flex h-11 items-center rounded-xl border border-line bg-card px-3 focus-within:border-ink">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          placeholder={placeholder}
          aria-label={label}
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-ink outline-none placeholder:text-muted-foreground"
        />
        {suffix ? <span className="text-[13px] font-medium text-muted-foreground">{suffix}</span> : null}
      </span>
    </label>
  );
}

/** Compact day picker for “arrive in N days / on this date”. */
export function DayChipPicker({
  label,
  days,
  value,
  onChange,
  formatDay,
  todayLabel,
}: {
  label: string;
  days: string[];
  value: string;
  onChange: (iso: string) => void;
  formatDay: (iso: string, index: number) => string;
  todayLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[12px] leading-[14px] font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {days.map((iso, i) => {
          const on = iso === value;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(iso)}
              className={cn(
                "flex min-h-11 w-full flex-col items-center justify-center rounded-xl border px-1 py-1.5",
                on ? "border-ink bg-ink text-white" : "border-line bg-card text-ink hover:bg-soft",
              )}
            >
              <span className={cn("text-[12px] font-semibold", on ? "text-white/70" : "text-muted-foreground")}>
                {i === 0 ? todayLabel : formatDay(iso, i)}
              </span>
              <span className="text-[15px] font-extrabold leading-5">{Number(iso.slice(8, 10))}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type WeekDayCell = {
  iso: string;
  weekday: string;
  dayNum: string;
  isToday: boolean;
  tons: number;
  chips: { id: string; label: string }[];
  overloaded: boolean;
  deliveryCount?: number;
};

export function WeekStrip({
  title,
  subtitle,
  days,
  selectedIso,
  onSelect,
  emptyHint,
  legendScheduled,
  legendOverloaded,
  deliveriesLabel,
}: {
  title: string;
  subtitle: string;
  days: WeekDayCell[];
  selectedIso: string | null;
  onSelect: (iso: string) => void;
  emptyHint: string;
  legendScheduled?: string;
  legendOverloaded?: string;
  deliveriesLabel?: (count: number) => string;
}) {
  const locale = useLocale();
  const maxTons = Math.max(1, ...days.map((d) => d.tons));
  const hasAny = days.some((d) => d.tons > 0 || (d.deliveryCount ?? d.chips.length) > 0);

  return (
    <ApCard className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-2 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <p className="text-[16px] leading-5 font-extrabold text-ink">{title}</p>
          <p className="text-[13px] leading-[18px] font-medium text-muted-foreground">{subtitle}</p>
        </div>
        {!hasAny ? <p className="text-[12px] font-semibold text-muted-foreground">{emptyHint}</p> : null}
      </div>

      {/* Mobile: compact 7-col grid, no scroll */}
      <div className="grid grid-cols-7 gap-1 px-3 pb-3 sm:hidden">
        {days.map((day) => {
          const selected = selectedIso === day.iso;
          const count = day.deliveryCount ?? day.chips.length;
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onSelect(day.iso)}
              className={cn(
                "flex flex-col items-center rounded-xl border px-0.5 py-1.5",
                day.isToday && !selected && "border-good bg-good-soft/40",
                selected && "border-ink bg-ink text-white",
                !day.isToday && !selected && "border-line bg-card",
              )}
            >
              <span
                className={cn(
                  "text-[12px] font-bold",
                  selected ? "text-white/75" : day.isToday ? "text-good" : "text-muted-foreground",
                )}
              >
                {day.weekday.slice(0, 1)}
              </span>
              <span className={cn("text-[13px] font-extrabold", selected ? "text-white" : "text-ink")}>{day.dayNum}</span>
              {day.tons > 0 ? (
                <span className={cn("mt-0.5 text-[12px] font-bold", selected ? "text-white" : day.overloaded ? "text-warn-text" : "text-good")}>
                  {day.tons % 1 ? day.tons.toFixed(1) : day.tons}
                </span>
              ) : (
                <span className={cn("mt-1 size-1.5 rounded-full", selected ? "bg-white/40" : count > 0 ? "bg-good" : "bg-line")} />
              )}
            </button>
          );
        })}
      </div>

      {/* Tablet/desktop: full day cards */}
      <div className="hidden gap-2 px-4 pb-3 sm:grid sm:grid-cols-7">
        {days.map((day) => {
          const selected = selectedIso === day.iso;
          const count = day.deliveryCount ?? day.chips.length;
          const barH = day.tons > 0 ? Math.max(8, Math.round((day.tons / maxTons) * 40)) : 0;
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onSelect(day.iso)}
              className={cn(
                "flex w-full flex-col rounded-[16px] border px-2 py-2.5 text-left transition-colors",
                day.isToday && !selected && "border-good bg-good-soft/30",
                selected && "border-ink bg-ink text-white",
                !day.isToday && !selected && "border-line bg-card hover:bg-soft",
              )}
            >
              <div className="flex items-baseline justify-between gap-1">
                <span
                  className={cn(
                    "text-[12px] font-bold",
                    selected ? "text-white/75" : day.isToday ? "text-good" : "text-muted-foreground",
                  )}
                >
                  {day.weekday}
                </span>
                <span className={cn("text-[15px] font-extrabold", selected ? "text-white" : "text-ink")}>{day.dayNum}</span>
              </div>
              {barH > 0 ? (
                <div className={cn("mt-2 flex h-10 items-end rounded-md px-1 pb-1", selected ? "bg-white/15" : "bg-soft")}>
                  <div
                    className={cn("w-full rounded-sm", selected ? "bg-white" : day.overloaded ? "bg-warn" : "bg-good")}
                    style={{ height: barH }}
                  />
                </div>
              ) : (
                <div className="mt-2 flex h-10 items-center justify-center">
                  <span className={cn("text-[16px] font-extrabold", selected ? "text-white/50" : "text-muted-foreground")}>–</span>
                </div>
              )}
              <p className={cn("mt-1.5 text-[12px] font-extrabold", selected ? "text-white" : "text-ink")}>
                {day.tons > 0 ? `${day.tons.toLocaleString(locale, { maximumFractionDigits: 1 })} t` : "–"}
              </p>
              {count > 0 ? (
                <p className={cn("mt-0.5 text-[12px] font-semibold", selected ? "text-white/70" : "text-muted-foreground")}>
                  {deliveriesLabel ? deliveriesLabel(count) : `${count}`}
                </p>
              ) : (
                <p className="mt-0.5 text-[12px] font-semibold opacity-0">–</p>
              )}
            </button>
          );
        })}
      </div>

      {legendScheduled && legendOverloaded ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-[12px] font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-good" aria-hidden />
            {legendScheduled}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-warn" aria-hidden />
            {legendOverloaded}
          </span>
        </div>
      ) : null}
    </ApCard>
  );
}

function compactScoreTone(score: number) {
  if (score >= 80) return { soft: "bg-good-soft", text: "text-good" };
  if (score >= 70) return { soft: "bg-warn-soft", text: "text-warn-text" };
  return { soft: "bg-risk-soft", text: "text-risk" };
}

export function LotResultCard({
  href,
  title,
  place,
  harvest,
  score,
  badges,
  price,
  priceHint,
  ctaLabel,
  scoreLabel,
  selected = false,
  onHover,
}: {
  href: string;
  title: string;
  place: string;
  harvest: string;
  score: number | null;
  badges: ReactNode;
  price: ReactNode;
  priceHint?: string;
  /** Optional full-width CTA; omit when the whole card is the link. */
  ctaLabel?: string;
  scoreLabel?: string;
  selected?: boolean;
  onHover?: () => void;
}) {
  const tone = score != null ? compactScoreTone(score) : null;
  return (
    <Link
      href={href}
      onMouseEnter={onHover}
      className={cn(
        "flex h-full flex-col gap-3 rounded-[18px] border border-line bg-card p-4 transition-colors hover:border-ink/30 hover:bg-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30",
        selected && "border-good bg-good-soft/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] leading-5 font-extrabold text-ink">{title}</p>
          <p className="mt-1 truncate text-[13px] leading-[18px] font-medium text-muted-foreground">
            {place}
            {harvest ? ` · ${harvest}` : ""}
          </p>
        </div>
        {score != null && tone ? (
          <div
            title={scoreLabel}
            className={cn("flex size-12 shrink-0 items-center justify-center rounded-[14px]", tone.soft)}
          >
            <span className={cn("text-[18px] leading-none font-extrabold", tone.text)}>{score}</span>
          </div>
        ) : null}
      </div>
      <div className="flex min-h-[24px] flex-wrap gap-1">{badges}</div>
      <div className="mt-auto border-t border-line pt-3">
        <div className="text-[16px] font-extrabold text-ink">{price}</div>
        {priceHint ? <p className="text-[12px] font-medium text-muted-foreground">{priceHint}</p> : null}
        {ctaLabel ? (
          <div className="mt-3">
            <ApButton label={ctaLabel} variant="dark" className="w-full" />
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  actionLabel,
  onAction,
  actionDisabled,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actionLabel?: string;
  /** May return a promise — the action button stays disabled until it settles (no double submits). */
  onAction?: () => void | Promise<unknown>;
  actionDisabled?: boolean;
  /** Sticky footer slot; falls back to actionLabel button when omitted. */
  footer?: ReactNode;
}) {
  const tc = useTranslations("common");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const runAction = () => {
    if (!onAction || busyRef.current) return;
    const out = onAction();
    if (out && typeof (out as Promise<unknown>).then === "function") {
      busyRef.current = true;
      setBusy(true);
      void (out as Promise<unknown>).finally(() => {
        busyRef.current = false;
        setBusy(false);
      });
    }
  };

  const footerContent =
    footer ??
    (actionLabel && onAction ? (
      <ApButton
        label={actionLabel}
        variant="dark"
        onClick={runAction}
        disabled={busy || actionDisabled}
        className="w-full"
      />
    ) : null);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40 min-[900px]:items-center min-[900px]:justify-center min-[900px]:p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full flex-col rounded-t-[22px] border border-line bg-card shadow-[0_-12px_40px_rgba(0,0,0,0.18)] min-[900px]:max-w-[420px] min-[900px]:rounded-[22px]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-5 pb-3">
          <h2 className="text-[20px] font-extrabold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="flex size-11 items-center justify-center rounded-full border border-line" aria-label={tc("close")}>
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
          <div className="flex flex-col gap-4">{children}</div>
        </div>
        {footerContent ? (
          <div className="sticky bottom-0 shrink-0 border-t border-line bg-card px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            {footerContent}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Accessible toggle — 44px hit area, compact track (28×48) with 20px thumb. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  id,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className="inline-flex h-11 min-w-12 shrink-0 items-center justify-center"
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-7 w-12 items-center rounded-full border transition-colors",
          checked ? "border-good bg-good" : "border-line bg-soft",
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute size-5 rounded-full bg-card shadow-sm transition-transform",
            checked ? "translate-x-[1.625rem]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  actionLabel,
  onAction,
  actionDisabled = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const t = useTranslations("processor");

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-[22px] border border-line bg-card p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[24px] leading-7 font-extrabold text-ink">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13px] leading-[18px] font-medium text-muted-foreground">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeDialog")}
            className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
          >
            <X className="size-[18px] text-ink" />
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <ApButton label={t("cancel")} variant="outline" onClick={onClose} />
          <ApButton label={actionLabel} onClick={onAction} disabled={actionDisabled} />
        </div>
      </div>
    </div>
  );
}

const BADGE_ICON: Record<LotBadgeId, LucideIcon> = {
  "lab-suggested": FlaskConical,
  banned: TriangleAlert,
  "no-banned": ShieldCheck,
  "reliable-delivery": Truck,
  "complete-records": ClipboardCheck,
};

const BADGE_TONE: Record<LotBadgeId, { bg: string; text: string }> = {
  "lab-suggested": { bg: "bg-warn-soft", text: "text-warn-text" },
  banned: { bg: "bg-risk-soft", text: "text-risk" },
  "no-banned": { bg: "bg-good-soft", text: "text-good" },
  "reliable-delivery": { bg: "bg-good-soft", text: "text-good" },
  "complete-records": { bg: "bg-good-soft", text: "text-good" },
};

export function LotBadges({ badges, max }: { badges: LotBadge[]; max?: number }) {
  const wide = useWide();
  const limit = max === undefined ? badges.length : wide ? max : Math.min(max, 2);
  const { shown, more } = rowBadges(badges, limit);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((b) => {
        const Icon = BADGE_ICON[b.id];
        const tone = BADGE_TONE[b.id];
        return (
          <span key={b.id} title={b.why ? `${b.label}. ${b.why}` : b.label} className={cn("flex h-6 shrink-0 items-center gap-1 rounded-full px-2", tone.bg)}>
            <Icon className={cn("size-[11px]", tone.text)} strokeWidth={2.4} aria-hidden />
            <span className={cn("text-[12px] leading-[14px] font-bold whitespace-nowrap", tone.text)}>{b.label}</span>
          </span>
        );
      })}
      {more > 0 ? (
        <span className="flex h-6 shrink-0 items-center rounded-full bg-soft px-2 text-[12px] leading-[14px] font-bold text-ink">{`+${more}`}</span>
      ) : null}
    </div>
  );
}

export { StatusSteps } from "@/shared/components/brand/status-steps";

export function LotRow({
  href,
  onOpen,
  lead,
  title,
  sub,
  badges,
  score,
  value,
  actions,
  first = false,
}: {
  /** When set, the row navigates here. Prefer `onOpen` for offer inboxes (no Find-olives redirect). */
  href?: string;
  onOpen?: () => void;
  lead: ReactNode;
  title: string;
  sub: string;
  badges: ReactNode;
  score: ReactNode;
  value: ReactNode;
  actions?: ReactNode;
  first?: boolean;
}) {
  const clickable = Boolean(href || onOpen);
  return (
    <div className={cn("relative hover:bg-background", !first && "border-t border-line")}>
      {href ? <Link href={href} aria-label={title} className="absolute inset-0 z-0" /> : null}
      {!href && onOpen ? (
        <button
          type="button"
          aria-label={title}
          onClick={onOpen}
          className="absolute inset-0 z-0 cursor-pointer"
        />
      ) : null}
      <div
        className={cn(
          "relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 min-[900px]:h-[92px] min-[900px]:flex-nowrap min-[900px]:py-0",
          clickable && "pointer-events-none",
        )}
      >
        <div className="flex w-full min-w-0 items-start gap-3 min-[900px]:w-auto min-[900px]:flex-1 min-[900px]:items-center">
          {lead}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate text-[16px] leading-5 font-extrabold text-ink">{title}</p>
              <div className="shrink-0 text-right min-[900px]:hidden">{value}</div>
            </div>
            <p className="truncate text-[13px] leading-[18px] font-medium text-muted-foreground">{sub}</p>
            <div className="mt-0.5">{badges}</div>
          </div>
        </div>
        <div className="hidden w-[84px] shrink-0 justify-center min-[900px]:flex">{score}</div>
        <div className="hidden w-[160px] shrink-0 flex-col items-end min-[900px]:flex">{value}</div>
        <div
          className={cn(
            "relative z-10 justify-end gap-2 min-[900px]:w-[220px]",
            actions ? "pointer-events-auto flex" : "pointer-events-none hidden",
          )}
        >
          {actions}
        </div>
        {clickable ? (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
      </div>
    </div>
  );
}

type AsyncDialogState =
  | { kind: "confirm"; message: string; resolve: (v: boolean) => void }
  | { kind: "prompt"; message: string; value: string; resolve: (v: string | null) => void }
  | null;

/**
 * In-app replacement for window.confirm / window.prompt (native dialogs are untranslated,
 * look broken on mobile and are blocked in some in-app browsers).
 * Usage: const { confirm, prompt, dialog } = useAsyncDialog(); … {dialog}
 */
export function useAsyncDialog() {
  const t = useTranslations("common");
  const [state, setState] = useState<AsyncDialogState>(null);
  const close = (v: boolean | string | null) => {
    if (!state) return;
    if (state.kind === "confirm") state.resolve(Boolean(v));
    else state.resolve(typeof v === "string" ? v : null);
    setState(null);
  };
  const confirm = (message: string) =>
    new Promise<boolean>((resolve) => setState({ kind: "confirm", message, resolve }));
  const prompt = (message: string, initial = "") =>
    new Promise<string | null>((resolve) =>
      setState({ kind: "prompt", message, value: initial, resolve }),
    );
  const dialog = state ? (
    <BottomSheet
      open
      onClose={() => close(state.kind === "confirm" ? false : null)}
      title={state.kind === "confirm" ? t("confirmTitle") : state.message}
      footer={
        <div className="flex gap-2">
          <ApButton
            label={t("cancel")}
            variant="outline"
            onClick={() => close(state.kind === "confirm" ? false : null)}
            className="flex-1"
          />
          <ApButton
            label={t("ok")}
            variant="dark"
            onClick={() => close(state.kind === "confirm" ? true : state.value)}
            className="flex-1"
          />
        </div>
      }
    >
      {state.kind === "confirm" ? (
        <p className="text-ap-body text-ink">{state.message}</p>
      ) : (
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          value={state.value}
          onChange={(e) => setState({ ...state, value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") close(state.value);
          }}
          className="h-12 w-full rounded-xl border border-line bg-card px-3 text-center text-ap-card font-extrabold text-ink"
          aria-label={state.message}
        />
      )}
    </BottomSheet>
  ) : null;
  return { confirm, prompt, dialog };
}
