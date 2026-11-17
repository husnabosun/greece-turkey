"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import { useTranslations } from "next-intl";
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
    <div className={cn("flex items-start gap-3", compact ? "gap-2.5" : "gap-3.5")}>
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-full",
          compact ? "size-10" : "size-12",
          ICON_TONES[iconTone],
        )}
      >
        {icon}
        {attention ? (
          <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-good ring-2 ring-card" aria-hidden />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] leading-4 font-semibold text-muted-foreground">{label}</p>
        <p className={cn("font-extrabold tracking-tight text-ink", compact ? "mt-0.5 text-[24px] leading-7" : "mt-1 text-[34px] leading-10")}>
          {value}
        </p>
        {hint ? <p className="mt-0.5 text-[11px] leading-[14px] font-medium text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );

  const className = cn(
    "min-w-[160px] flex-1 rounded-[18px] border bg-card transition-colors",
    compact ? "p-3.5" : "p-5",
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
  if (score >= 85) return { bg: "bg-good-soft", text: "text-good" };
  if (score >= 70) return { bg: "bg-warn-soft", text: "text-warn-text" };
  return { bg: "bg-risk-soft", text: "text-risk" };
}

export function ScoreBox({ score, large = false }: { score: number; large?: boolean }) {
  const t = useTranslations("processor");
  const tone = scoreTone(score);
  return (
    <div className={cn("flex flex-col items-center", large ? "rounded-xl px-3 py-2" : "rounded-lg px-2 py-1", tone.bg)}>
      <span className={cn("text-[10px] leading-3 font-semibold", tone.text)}>{t("qualityScore")}</span>
      <span className={cn("font-extrabold", large ? "text-[24px] leading-7" : "text-[16px] leading-5", tone.text)}>{score}</span>
    </div>
  );
}

export function Amount({ value, unit, large = false }: { value: string; unit?: string; large?: boolean }) {
  return (
    <span className={cn("font-extrabold text-ink", large ? "text-[24px] leading-7" : "text-[16px] leading-5")}>
      {value}
      {unit ? <span className="text-[11px] leading-[14px] font-medium text-muted-foreground">{` ${unit}`}</span> : null}
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
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-risk px-1 text-[10px] font-bold text-white">{o.badge}</span>
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
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] leading-[14px] font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Chip key={o.value} tone="black" on={on} onClick={() => onChange(o.value)}>
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
      <span className="text-[11px] leading-[14px] font-bold tracking-wide text-muted-foreground uppercase">{label}</span>
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
      <p className="text-[11px] leading-[14px] font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {days.map((iso, i) => {
          const on = iso === value;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(iso)}
              className={cn(
                "flex min-w-[64px] shrink-0 flex-col items-center rounded-xl border px-2 py-2",
                on ? "border-ink bg-ink text-white" : "border-line bg-card text-ink hover:bg-soft",
              )}
            >
              <span className={cn("text-[10px] font-semibold", on ? "text-white/70" : "text-muted-foreground")}>
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
};

export function WeekStrip({
  title,
  subtitle,
  days,
  selectedIso,
  onSelect,
  emptyHint,
}: {
  title: string;
  subtitle: string;
  days: WeekDayCell[];
  selectedIso: string | null;
  onSelect: (iso: string) => void;
  emptyHint: string;
}) {
  const maxTons = Math.max(1, ...days.map((d) => d.tons));
  const hasAny = days.some((d) => d.tons > 0 || d.chips.length > 0);

  return (
    <ApCard className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-2 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <p className="text-[16px] leading-5 font-extrabold text-ink">{title}</p>
          <p className="text-[13px] leading-[18px] font-medium text-muted-foreground">{subtitle}</p>
        </div>
        {!hasAny ? <p className="text-[12px] font-semibold text-muted-foreground">{emptyHint}</p> : null}
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[900px]:grid min-[900px]:grid-cols-7 min-[900px]:overflow-visible">
        {days.map((day) => {
          const selected = selectedIso === day.iso;
          const barH = day.tons > 0 ? Math.max(8, Math.round((day.tons / maxTons) * 40)) : 0;
          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onSelect(day.iso)}
              className={cn(
                "flex w-[104px] shrink-0 flex-col rounded-[16px] border px-2.5 py-2.5 text-left transition-colors min-[900px]:w-auto",
                day.isToday && !selected && "border-good bg-good-soft/40",
                selected && "border-ink bg-ink text-white",
                !day.isToday && !selected && "border-line bg-card hover:bg-soft",
              )}
            >
              <div className="flex items-baseline justify-between gap-1">
                <span
                  className={cn(
                    "text-[11px] font-bold",
                    selected ? "text-white/75" : day.isToday ? "text-good" : "text-muted-foreground",
                  )}
                >
                  {day.isToday ? day.weekday : day.weekday}
                </span>
                <span className={cn("text-[15px] font-extrabold", selected ? "text-white" : "text-ink")}>{day.dayNum}</span>
              </div>
              <div className={cn("mt-2 flex h-10 items-end rounded-md px-1 pb-1", selected ? "bg-white/15" : "bg-soft")}>
                {barH > 0 ? (
                  <div
                    className={cn(
                      "w-full rounded-sm",
                      selected ? "bg-white" : day.overloaded ? "bg-warn-text" : "bg-ink/80",
                    )}
                    style={{ height: barH }}
                  />
                ) : (
                  <div className={cn("h-1 w-full rounded-sm", selected ? "bg-white/25" : "bg-line")} />
                )}
              </div>
              <p className={cn("mt-1.5 text-[12px] font-extrabold", selected ? "text-white" : "text-ink")}>
                {day.tons > 0 ? `${day.tons % 1 ? day.tons.toFixed(1) : day.tons} t` : "–"}
              </p>
              <div className="mt-1 flex min-h-[22px] flex-wrap gap-1">
                {day.chips.slice(0, 2).map((c) => (
                  <span
                    key={c.id}
                    className={cn(
                      "truncate rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                      selected ? "bg-white/20 text-white" : "bg-soft text-ink",
                    )}
                  >
                    {c.label}
                  </span>
                ))}
                {day.chips.length > 2 ? (
                  <span className={cn("text-[9px] font-bold", selected ? "text-white/70" : "text-muted-foreground")}>
                    +{day.chips.length - 2}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </ApCard>
  );
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
  ctaLabel: string;
  selected?: boolean;
  onHover?: () => void;
}) {
  return (
    <div onMouseEnter={onHover}>
      <ApCard
        className={cn(
          "flex h-full flex-col gap-3 p-4 transition-colors",
          selected && "border-good bg-good-soft/30",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[18px] leading-6 font-extrabold text-ink">{title}</p>
            <p className="mt-1 text-[13px] leading-[18px] font-medium text-muted-foreground">
              {place}
              {harvest ? ` · ${harvest}` : ""}
            </p>
          </div>
          {score != null ? <ScoreBox score={score} large /> : null}
        </div>
        <div className="min-h-[24px]">{badges}</div>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-line pt-3">
          <div className="min-w-0">
            <div className="text-[16px] font-extrabold text-ink">{price}</div>
            {priceHint ? <p className="text-[11px] font-medium text-muted-foreground">{priceHint}</p> : null}
          </div>
          <Link href={href}>
            <ApButton label={ctaLabel} variant="dark" />
          </Link>
        </div>
      </ApCard>
    </div>
  );
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  actionLabel,
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actionLabel: string;
  onAction: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40 min-[900px]:items-center min-[900px]:justify-center min-[900px]:p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-[22px] border border-line bg-card p-5 shadow-[0_-12px_40px_rgba(0,0,0,0.18)] min-[900px]:max-w-[420px] min-[900px]:rounded-[22px]"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-extrabold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="flex size-9 items-center justify-center rounded-full border border-line" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-col gap-4">{children}</div>
        <div className="sticky bottom-0 mt-5 bg-card pt-2">
          <ApButton label={actionLabel} variant="dark" onClick={onAction} className="w-full" />
        </div>
      </div>
    </div>
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
  const limit = max === undefined ? badges.length : wide ? max : Math.min(max, 1);
  const { shown, more } = rowBadges(badges, limit);
  if (shown.length === 0) return null;
  return (
    <div className={cn("flex gap-1", max === undefined ? "flex-wrap" : "overflow-hidden")}>
      {shown.map((b) => {
        const Icon = BADGE_ICON[b.id];
        const tone = BADGE_TONE[b.id];
        return (
          <span key={b.id} title={b.why ? `${b.label}. ${b.why}` : b.label} className={cn("flex h-6 shrink-0 items-center gap-1 rounded-full px-2", tone.bg)}>
            <Icon className={cn("size-[11px]", tone.text)} strokeWidth={2.4} aria-hidden />
            <span className={cn("text-[11px] leading-[14px] font-bold whitespace-nowrap", tone.text)}>{b.label}</span>
          </span>
        );
      })}
      {more > 0 ? (
        <span className="flex h-6 shrink-0 items-center rounded-full bg-soft px-2 text-[11px] leading-[14px] font-bold text-ink">{`+${more}`}</span>
      ) : null}
    </div>
  );
}

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
        <div className="flex w-full min-w-0 items-center gap-3 min-[900px]:w-auto min-[900px]:flex-1">
          {lead}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] leading-5 font-extrabold text-ink">{title}</p>
            <p className="truncate text-[13px] leading-[18px] font-medium text-muted-foreground">{sub}</p>
            <div className="mt-0.5 h-6">{badges}</div>
          </div>
        </div>
        <div className="flex w-[84px] shrink-0 justify-center">{score}</div>
        <div className="flex w-[124px] shrink-0 flex-col items-end">{value}</div>
        <div
          className={cn(
            "relative z-10 justify-end gap-2 min-[900px]:flex min-[900px]:w-[220px]",
            actions ? "pointer-events-auto flex" : "pointer-events-none hidden",
          )}
        >
          {actions}
        </div>
        {clickable ? (
          <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground min-[900px]:block" aria-hidden />
        ) : null}
      </div>
    </div>
  );
}
