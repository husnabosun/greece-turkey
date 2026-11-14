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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-[240px] shrink">
        <h1 className="text-[32px] leading-[38px] font-extrabold text-ink">{title}</h1>
        <p className="mt-1 text-[16px] leading-5 font-medium text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  compact = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  compact?: boolean;
}) {
  return (
    <ApCard className={cn("min-w-[160px] flex-1", compact ? "p-3" : "p-4")}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] leading-[18px] font-semibold text-muted-foreground">{label}</p>
        <span className={cn("flex items-center justify-center rounded-full bg-soft", compact ? "size-7" : "size-9")}>{icon}</span>
      </div>
      <p className={cn("font-extrabold text-ink", compact ? "mt-1 text-[24px] leading-7" : "mt-2 text-[32px] leading-[38px]")}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-[14px] font-medium text-muted-foreground">{hint}</p> : null}
    </ApCard>
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

export function ScoreBox({ score, large = false }: { score: number; large?: boolean }) {
  const t = useTranslations("processor");
  const low = score < 70;
  return (
    <div className={cn("flex flex-col items-center", large ? "rounded-xl px-3 py-2" : "rounded-lg px-2 py-1", low ? "bg-risk-soft" : "bg-good-soft")}>
      <span className={cn("text-[10px] leading-3 font-semibold", low ? "text-risk" : "text-good")}>{t("qualityScore")}</span>
      <span className={cn("font-extrabold", large ? "text-[24px] leading-7" : "text-[16px] leading-5", low ? "text-risk" : "text-good")}>{score}</span>
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
}: {
  options: { value: T; label: string; badge?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex h-10 flex-row self-start rounded-full bg-soft p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn("flex min-w-[96px] items-center justify-center gap-1 rounded-full px-4", on && "bg-ink")}
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
  lead,
  title,
  sub,
  badges,
  score,
  value,
  actions,
  first = false,
}: {
  href: string;
  lead: ReactNode;
  title: string;
  sub: string;
  badges: ReactNode;
  score: ReactNode;
  value: ReactNode;
  actions?: ReactNode;
  first?: boolean;
}) {
  return (
    <div className={cn("relative hover:bg-background", !first && "border-t border-line")}>
      <Link href={href} aria-label={title} className="absolute inset-0 z-0" />
      <div className="pointer-events-none relative flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 min-[900px]:h-[92px] min-[900px]:flex-nowrap min-[900px]:py-0">
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
            "relative z-10 justify-end gap-2 min-[900px]:flex min-[900px]:w-[176px]",
            actions ? "pointer-events-auto flex" : "pointer-events-none hidden",
          )}
        >
          {actions}
        </div>
        <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground min-[900px]:block" aria-hidden />
      </div>
    </div>
  );
}
