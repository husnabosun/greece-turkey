"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { publicEnv } from "@/core/config/env";
import { SATELLITE_STYLE } from "@/features/fields/satellite-style";
import { colors } from "@/shared/theme/tokens";
import { useLocale, useTranslations } from "next-intl";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Chip } from "@/shared/components/brand/chip";
import { Pill } from "@/shared/components/brand/pill";
import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { euroPrice, euroTotal, formatTons, saleTotal } from "@/features/marketplace/pricing";
import {
  defaultVarietySlug,
  marketplaceVarietyOptions,
  resolveOliveCountry,
  resolveOliveVariety,
} from "@/features/fields/olive-varieties";
import {
  BottomSheet,
  DayChipPicker,
  Dialog,
  Initials,
  initialsOf,
  PageHeader,
  Panel,
} from "./processor-kit";
import { MARKET_REGIONS, marketRegionOptions, regionLabel, resolveMarketRegion, type MarketRegion } from "./regions";
import {
  DEFAULT_DELIVERY_IN_DAYS,
  addDaysIso,
  formatWindowLabel,
  localizeStoredWindowLabel,
  nextDeliveryWindows,
  nextSevenDays,
  todayIsoDate,
} from "./schedule";
import {
  acceptIncomingOffer,
  counterIncomingOffer,
  createBuyRequest,
  deactivateBuyRequest,
  rejectOffer,
  useProcessorMarket,
  type ProcessorOffer,
  type ProcessorRequest,
} from "./use-processor-market";
import { useVarietyLabel } from "./processor-shared";

const SCORE_OPTIONS = ["70", "75", "80", "85"] as const;

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

function useMinWidth(px: number) {
  const [matches, setMatches] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [px]);
  return matches;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-[13px] leading-[18px] font-semibold text-muted-foreground">{children}</span>;
}

function FormChips({
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
    <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={label}>
      <FieldLabel>{label}</FieldLabel>
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

function FormNumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <span className="flex h-11 items-center rounded-xl border border-line bg-card px-3 focus-within:border-ink">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-ink outline-none"
        />
        {suffix ? <span className="text-[13px] font-medium text-muted-foreground">{suffix}</span> : null}
      </span>
    </label>
  );
}

function FormSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
      <span className="text-[14px] leading-5 font-semibold text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-ink" : "bg-line",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </label>
  );
}

/* ---------- region map (new-request form) ---------- */

/**
 * Approximate olive-growing centre of each market region [lon, lat].
 * Local to the requests screen for now; can move to regions.ts later.
 */
const REGION_CENTERS: Record<MarketRegion, [number, number]> = {
  Crete: [24.9, 35.24],
  Messinia: [21.95, 37.05],
  Peloponnese: [22.4, 37.55],
  Laconia: [22.65, 36.85],
  Lesvos: [26.3, 39.2],
  Phocis: [22.25, 38.5],
  "West Greece": [21.75, 38.25],
  Aydın: [27.85, 37.85],
  Balıkesir: [26.95, 39.5],
  İzmir: [27.14, 38.42],
};

function RegionMap({
  value,
  onChange,
  locale,
  label,
  needTokenLabel,
}: {
  value: string;
  onChange: (region: string) => void;
  locale: string;
  label: string;
  needTokenLabel: string;
}) {
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    try {
      const bounds = new mapboxgl.LngLatBounds();
      for (const r of MARKET_REGIONS) bounds.extend(REGION_CENTERS[r]);
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: SATELLITE_STYLE,
        bounds,
        fitBoundsOptions: { padding: 28 },
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        cooperativeGestures: true,
      });
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
      map.on("load", () => {
        map.resize();
        setReady(true);
      });
      // Only a failure before the style loads means "no map"; a single bad tile later is harmless.
      map.on("error", () => {
        if (!map.loaded()) setFailed(true);
      });
      mapRef.current = map;
    } catch {
      setFailed(true);
    }
    // The dialog animates/lays out after mount — keep the canvas in sync with the box size.
    const ro = new ResizeObserver(() => mapRef.current?.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    const selected = resolveMarketRegion(value);

    for (const region of MARKET_REGIONS) {
      const active = region === selected;
      const name = regionLabel(region, locale);
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", name);
      el.setAttribute("aria-pressed", String(active));
      el.title = name;
      el.style.cssText = [
        "display:flex",
        "align-items:center",
        "gap:6px",
        "padding:0",
        "border:0",
        "background:transparent",
        "cursor:pointer",
        active ? "z-index:2" : "z-index:1",
      ].join(";");
      const dot = document.createElement("span");
      dot.style.cssText = [
        `width:${active ? 18 : 14}px`,
        `height:${active ? 18 : 14}px`,
        "border-radius:999px",
        `background:${active ? colors.ink : colors.good}`,
        "border:3px solid #fff",
        "box-shadow:0 2px 8px rgba(0,0,0,.45)",
        "flex-shrink:0",
      ].join(";");
      el.appendChild(dot);
      if (active) {
        const tag = document.createElement("span");
        tag.textContent = name;
        tag.style.cssText =
          "padding:3px 8px;border-radius:999px;background:#fff;color:" +
          colors.ink +
          ";font:800 12px/16px Inter,system-ui,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3)";
        el.appendChild(tag);
      }
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onChangeRef.current(region);
      });
      const marker = new mapboxgl.Marker({ element: el, anchor: "left", offset: [active ? -9 : -7, 0] })
        .setLngLat(REGION_CENTERS[region])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [ready, value, locale]);

  if (!token || failed) {
    return (
      <div
        style={{ height: 200 }}
        className="flex shrink-0 items-center justify-center rounded-xl border border-line bg-soft px-4 text-center text-[13px] font-semibold text-muted-foreground">
        {needTokenLabel}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={label}
      style={{ height: 220 }}
      className="relative w-full shrink-0 overflow-hidden rounded-xl border border-line bg-ink"
    >
      <div ref={containerRef} className="absolute inset-0" />
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
  const locale = useLocale();
  const varietyLabel = useVarietyLabel();
  const varietyOptions = useMemo(() => marketplaceVarietyOptions(locale), [locale]);
  const { requests, offers, loading, error, reload } = useProcessorMarket();
  const [open, setOpen] = useState(false);
  const [variety, setVariety] = useState(() => defaultVarietySlug(resolveOliveCountry({ locale }).country));
  const [tons, setTons] = useState("10");
  const [minScore, setMinScore] = useState("75");
  const deliveryWindows = useMemo(() => nextDeliveryWindows(4, 10), []);
  const [windowKey, setWindowKey] = useState("w1");
  const [province, setProvince] = useState("Peloponnese");
  const [noBanned, setNoBanned] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const sheetLayout = !useMinWidth(640);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [acceptOffer, setAcceptOffer] = useState<ProcessorOffer | null>(null);
  const [acceptDate, setAcceptDate] = useState(() => addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS));
  const weekDates = useMemo(() => nextSevenDays(), []);
  const regionOptions = useMemo(() => marketRegionOptions(locale), [locale]);

  const openRequests = requests.filter((r) => r.active);
  const selectedWindow = deliveryWindows.find((w) => w.key === windowKey) ?? deliveryWindows[1] ?? deliveryWindows[0];
  const offersForRequest = (requestId: string) =>
    offers.filter(
      (o) =>
        o.buyRequestId === requestId &&
        o.initiatedBy === "farmer" &&
        (o.status === "pending" || o.status === "countered"),
    );

  const resetForm = () => {
    setVariety(defaultVarietySlug(resolveOliveCountry({ locale }).country));
    setTons("10");
    setMinScore("75");
    setWindowKey("w1");
    setProvince("Peloponnese");
    setNoBanned(true);
  };

  const openNew = () => {
    setEditingId(null);
    resetForm();
    setOpen(true);
  };

  const openEdit = (req: ProcessorRequest) => {
    setEditingId(req.id);
    setVariety(resolveOliveVariety(req.variety)?.slug ?? req.variety);
    setTons(String(req.tons));
    const score = String(req.minScore);
    setMinScore((SCORE_OPTIONS as readonly string[]).includes(score) ? score : "75");
    const parsed = parseWindowLabel(req.windowLabel);
    const startIso = parsed ? isoOf(parsed.start) : null;
    setWindowKey(deliveryWindows.find((w) => w.start === startIso)?.key ?? "w0");
    setProvince(resolveMarketRegion(req.region) ?? "Peloponnese");
    setNoBanned(req.noBanned);
    setOpen(true);
  };

  const closeForm = () => {
    setOpen(false);
    setEditingId(null);
  };

  const onSubmit = async () => {
    if (saving) return;
    if (editingId) {
      // TODO: wire updateBuyRequest (use-processor-market.ts, Γιώργος) when it lands.
      toast.info(t("editRequestSoon"));
      return;
    }
    const tonsN = Number(tons.replace(",", "."));
    if (!(tonsN > 0)) {
      toast.error(t("saveFailed"));
      return;
    }
    setSaving(true);
    const windowLabel = selectedWindow
      ? formatWindowLabel(selectedWindow.start, selectedWindow.end, locale)
      : formatWindowLabel(todayIsoDate(), addDaysIso(todayIsoDate(), 9), locale);
    const res = await createBuyRequest({
      variety,
      tons: tonsN,
      minScore: Number(minScore) || 0,
      region: province,
      windowLabel,
      noBanned,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? t("saveFailed"));
      return;
    }
    closeForm();
    toast.success(t("requestCreated"));
    await reload();
  };

  const onCloseRequest = async (requestId: string) => {
    if (!window.confirm(t("deleteRequestConfirm"))) return;
    setBusyId(requestId);
    try {
      const res = await deactivateBuyRequest(requestId);
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"));
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
        toast.error(res.error ?? t("saveFailed"));
        return;
      }
      toast.success(t("acceptedScheduled", { date: acceptDate }));
      setAcceptOffer(null);
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const onRejectOffer = async (offer: ProcessorOffer) => {
    if (!window.confirm(t("rejectConfirm"))) return;
    setBusyId(offer.id);
    try {
      const res = await rejectOffer(offer.id);
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"));
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
    const raw = window.prompt(t("counterPrompt"), String(suggested));
    if (raw == null) return;
    const next = Number(raw.replace(",", "."));
    if (!Number.isFinite(next) || next <= 0) {
      toast.error(t("invalidPrice"));
      return;
    }
    setBusyId(offer.id);
    try {
      const res = await counterIncomingOffer(offer, next);
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"));
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
        onAction={() => void onAcceptConfirm()}
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
                  <Initials text={varietyMonogram(req.variety, varietyLabel(req.variety))} size={44} />
                  <div className="min-w-[200px] flex-1">
                    <p className="text-[16px] font-extrabold text-ink">
                      {varietyLabel(req.variety)} · {formatTons(req.tons, locale)}
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
                    <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
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
        const formBody = (
          <div className="space-y-4">
            <FormChips
              label={t("variety")}
              value={variety}
              onChange={setVariety}
              options={varietyOptions.map((v) => ({ value: v.value, label: v.label }))}
            />
            <FormNumberField label={t("tonnesNeeded")} value={tons} onChange={setTons} suffix="t" />
            <FormChips
              label={t("minScore")}
              value={minScore}
              onChange={setMinScore}
              options={SCORE_OPTIONS.map((s) => ({ value: s, label: t("scorePlus", { score: s }) }))}
            />
            <FormChips
              label={t("deliveryWindow")}
              value={windowKey}
              onChange={setWindowKey}
              options={deliveryWindows.map((w) => ({
                value: w.key,
                label: formatDateRange(new Date(`${w.start}T12:00:00`), new Date(`${w.end}T12:00:00`), locale),
              }))}
            />
            <div className="flex flex-col gap-2">
              <FormChips label={t("province")} value={province} onChange={setProvince} options={regionOptions} />
              {open ? (
                <RegionMap
                  value={province}
                  onChange={setProvince}
                  locale={locale}
                  label={t("regionMapLabel")}
                  needTokenLabel={t("regionMapUnavailable")}
                />
              ) : null}
            </div>
            <FormSwitch label={t("noBannedOnly")} checked={noBanned} onChange={setNoBanned} />
          </div>
        );
        const title = editingId ? t("editRequestTitle") : t("newRequest");
        const actionLabel = saving ? t("loading") : editingId ? t("saveChanges") : t("createRequest");
        return sheetLayout ? (
          <BottomSheet open={open} onClose={closeForm} title={title} actionLabel={actionLabel} onAction={() => void onSubmit()}>
            <p className="-mt-2 text-[13px] leading-[18px] font-medium text-muted-foreground">{t("newRequestSubtitle")}</p>
            {formBody}
          </BottomSheet>
        ) : (
          <Dialog
            open={open}
            onClose={closeForm}
            title={title}
            subtitle={t("newRequestSubtitle")}
            actionLabel={actionLabel}
            actionDisabled={saving}
            onAction={() => void onSubmit()}
          >
            {formBody}
          </Dialog>
        );
      })()}
    </div>
  );
}
