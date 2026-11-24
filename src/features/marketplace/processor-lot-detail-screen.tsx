"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, FlaskConical, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { publicEnv } from "@/core/config/env";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { varietyLabel } from "@/features/fields/olive-varieties";
import { reverseGeocodePlace } from "@/features/fields/reverse-geocode";
import type { QualityBreakdown } from "@/features/quality/score-engine";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Pill } from "@/shared/components/brand/pill";
import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { trustBadges } from "@/features/marketplace/badges";
import {
  formatDateShort,
  formatEuro,
  formatEuroPerKg,
  formatQuantity,
  kgToTons,
  MARKET_LIMITS,
  parseBounded,
  saleTotal,
  tonsToKg,
} from "@/features/marketplace/pricing";
import {
  ProductBadge,
  oilCategoryI18nKey,
  oilStorageI18nKey,
  productI18nKey,
} from "@/features/marketplace/product-badge";
import { formatOilPdoPgi } from "@/features/marketplace/oil-pdo";
import { scoreBand, scoreToneClasses } from "@/features/marketplace/score-slider";
// Mapbox (~1 MB) is only fetched when a map is actually on screen.
const LotsMap = dynamic(() => import("./lots-map").then((m) => m.LotsMap), {
  ssr: false,
  loading: () => <div className="w-full animate-pulse rounded-[18px] bg-soft" style={{ height: 240 }} />,
});
import {
  BottomSheet,
  DayChipPicker,
  Dialog,
  LotBadges,
  TextField,
  useWide,
  type LotBadge,
} from "./processor-kit";
import { regionLabel } from "./regions";
import {
  DEFAULT_DELIVERY_IN_DAYS,
  addDaysIso,
  nextSevenDays,
  todayIsoDate,
} from "./schedule";
import {
  harvestRangeLabel,
  lotPlaceLabel,
  placeLotOffer,
  useProcessorMarket,
  type ProcessorLot,
} from "./use-processor-market";
import { ScoreHistoryChart } from "@/features/quality/score-history-chart";
import { useBoundsMessage, useErrorMessage } from "@/shared/lib/error-message";

const DEMO_EXCHANGE = 0.8;

type SprayRow = {
  id: string;
  product: string;
  appliedAt: string;
  euBanned: boolean;
  euStatus: "banned" | "allowed" | "unknown";
};

function fallbackBreakdown(score: number): QualityBreakdown {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return {
    tree: Math.min(100, s + 3),
    spray: Math.max(0, s - 4),
    harvest: Math.min(100, s + 1),
    records: Math.max(0, s - 2),
  };
}

function parseBreakdown(raw: unknown, score: number | null): QualityBreakdown | null {
  const b = (raw ?? {}) as Partial<QualityBreakdown>;
  const tree = Number(b.tree ?? 0);
  const spray = Number(b.spray ?? 0);
  const harvest = Number(b.harvest ?? 0);
  const records = Number(b.records ?? 0);
  if (tree + spray + harvest + records <= 0) {
    return score != null ? fallbackBreakdown(score) : null;
  }
  return { tree, spray, harvest, records };
}

function lotBadgesFor(lot: ProcessorLot, t: ReturnType<typeof useTranslations<"processor">>): LotBadge[] {
  const trust = trustBadges(
    {
      records: 80,
      hasBanned: lot.hasBannedSpray,
      paidDeliveries: 0,
      labFailed: 0,
    },
    (key, values) => t(key as never, values as never),
  );
  const out: LotBadge[] = trust.map((b) => ({
    id: b.id === "no-banned" ? "no-banned" : b.id === "complete-records" ? "complete-records" : "reliable-delivery",
    label: b.label,
    why: b.why,
  }));
  if (lot.labResult == null && (lot.qualityScore ?? 100) < 80) {
    out.push({ id: "lab-suggested", label: t("badge.labSuggested") });
  }
  if (lot.hasBannedSpray) {
    out.unshift({ id: "banned", label: t("sprayNotApproved") });
  }
  return out;
}

function FactorRow({
  label,
  hint,
  value,
  goodLabel,
  warnLabel,
  riskLabel,
}: {
  label: string;
  hint: string;
  value: number | null;
  goodLabel: string;
  warnLabel: string;
  riskLabel: string;
}) {
  const tone = value != null ? scoreToneClasses(value) : null;
  const band = value != null ? scoreBand(value) : null;
  const pillLabel =
    band == null ? null : band === "high" ? goodLabel : band === "mid" ? warnLabel : riskLabel;
  return (
    <div className="flex items-start justify-between gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">{hint}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <p className={cn("text-[15px] font-extrabold", tone?.text ?? "text-muted-foreground")}>
          {value != null ? value : "—"}
        </p>
        {pillLabel && tone ? <Pill tone={tone.pill}>{pillLabel}</Pill> : null}
      </div>
    </div>
  );
}

export function ProcessorLotDetailScreen({ id }: { id: string }) {
  const t = useTranslations("processor");
  const errMsg = useErrorMessage();
  const boundsMsg = useBoundsMessage();
  const locale = useLocale();
  const wide = useWide();
  const { lots, offers, loading, reload } = useProcessorMarket();
  const lot = lots.find((l) => l.id === id) ?? null;
  const mapToken = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;

  const [place, setPlace] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<QualityBreakdown | null>(null);
  const [sprays, setSprays] = useState<SprayRow[]>([]);
  const [tons, setTons] = useState("5");
  const [price, setPrice] = useState(String(DEMO_EXCHANGE));
  const [open, setOpen] = useState(false);
  const [arriveOn, setArriveOn] = useState(() => addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS));
  const offerWeek = useMemo(() => nextSevenDays(), []);

  const sent = offers.some(
    (o) => o.lotId === id && o.initiatedBy === "processor" && (o.status === "pending" || o.status === "countered"),
  );
  const listed = lot?.status === "listed";
  const isOil = lot?.product === "oil";

  useEffect(() => {
    if (!lot) return;
    let cancelled = false;
    void (async () => {
      if (lot.town) {
        const region = lot.region ? regionLabel(lot.region, locale) : "";
        if (!cancelled) setPlace(`${lot.town}${region ? `, ${region}` : ""}`);
      } else if (lot.lat != null && lot.lon != null) {
        const geo = await reverseGeocodePlace(lot.lat, lot.lon, locale);
        if (!cancelled) setPlace(geo);
      } else if (!cancelled) {
        setPlace(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lot, locale]);

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase || !lot) {
      setBreakdown(lot?.qualityScore != null ? fallbackBreakdown(lot.qualityScore) : null);
      setSprays([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [{ data: lotExtra }, { data: qs }, { data: sprayRows }] = await Promise.all([
        supabase
          .from("lots")
          .select("quality_breakdown, spray_snapshot")
          .eq("id", lot.id)
          .maybeSingle(),
        lot.fieldId
          ? supabase
              .from("quality_scores")
              .select("breakdown, score")
              .eq("field_id", lot.fieldId)
              .order("computed_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        lot.fieldId
          ? supabase
              .from("logbook_entries")
              .select("id, product_name, applied_at, eu_banned, eu_status, kind")
              .eq("field_id", lot.fieldId)
              .eq("kind", "spray")
              .order("applied_at", { ascending: false })
              .limit(8)
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      const score = lot.qualityScore ?? qs?.score ?? null;
      setBreakdown(parseBreakdown(lotExtra?.quality_breakdown ?? qs?.breakdown, score));

      const fromLog = (sprayRows ?? []).map((r) => ({
        id: r.id as string,
        product: String(r.product_name ?? "—"),
        appliedAt: String(r.applied_at),
        euBanned: Boolean(r.eu_banned),
        euStatus: (r.eu_banned ? "banned" : r.eu_status === "allowed" ? "allowed" : "unknown") as SprayRow["euStatus"],
      }));
      if (fromLog.length > 0) {
        setSprays(fromLog);
        return;
      }
      const snap = Array.isArray(lotExtra?.spray_snapshot) ? lotExtra.spray_snapshot : [];
      setSprays(
        snap
          .map((raw, i) => {
            const s = raw as {
              id?: string;
              product?: string;
              product_name?: string;
              applied_at?: string;
              date?: string;
              eu_banned?: boolean;
              eu_status?: string;
              banned?: boolean;
            };
            const product = s.product_name ?? s.product;
            const appliedAt = s.applied_at ?? s.date;
            if (!product || !appliedAt) return null;
            return {
              id: s.id ?? `snap-${i}`,
              product,
              appliedAt,
              euBanned: Boolean(s.eu_banned ?? s.banned),
              euStatus: (s.eu_banned ?? s.banned
                ? "banned"
                : s.eu_status === "allowed"
                  ? "allowed"
                  : "unknown") as SprayRow["euStatus"],
            };
          })
          .filter((x): x is SprayRow => x != null),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [lot]);

  const openOffer = () => {
    if (!lot) return;
    if (lot.product === "oil") {
      setTons(String(Math.min(500, tonsToKg(lot.tons))));
      setPrice(String(lot.pricePerKg ?? 5));
    } else {
      setTons(String(Math.min(5, lot.tons)));
      setPrice(String(lot.pricePerKg ?? DEMO_EXCHANGE));
    }
    setArriveOn(addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS));
    setOpen(true);
  };

  const qtyBounds = isOil
    ? {
        min: MARKET_LIMITS.oilKg.min,
        max: Math.min(MARKET_LIMITS.oilKg.max, lot ? tonsToKg(lot.tons) : MARKET_LIMITS.oilKg.max),
      }
    : {
        min: MARKET_LIMITS.lotTons.min,
        max: Math.min(MARKET_LIMITS.lotTons.max, lot?.tons ?? MARKET_LIMITS.lotTons.max),
      };
  const tonsCheck = parseBounded(String(tons), qtyBounds);
  const priceCheck = parseBounded(String(price), isOil ? MARKET_LIMITS.oilPricePerKg : MARKET_LIMITS.pricePerKg);
  const offerQty = tonsCheck.ok ? tonsCheck.value : 0;
  const offerTons = isOil ? kgToTons(offerQty) : offerQty;
  const offerPrice = priceCheck.ok ? priceCheck.value : 0;
  const offerValid = lot != null && tonsCheck.ok && priceCheck.ok;
  const offerTotal = offerValid ? formatEuro(saleTotal(offerTons, offerPrice), locale) : null;
  const offerErrors = [
    String(tons).trim() && !tonsCheck.ok ? boundsMsg(tonsCheck, isOil ? "kg" : "tons", locale) : null,
    String(price).trim() && !priceCheck.ok ? boundsMsg(priceCheck, "price", locale) : null,
  ].filter(Boolean) as string[];
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);

  const submit = async () => {
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      await submitInner();
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const submitInner = async () => {
    if (!lot?.farmerId) {
      toast.error(t("identityHidden"));
      return;
    }
    if (!offerValid) {
      toast.error(t("invalidOfferValues"));
      return;
    }
    const toastId = toast.loading(t("sendingOffer"));
    const deliveryInDays = Math.max(
      0,
      Math.round(
        (new Date(`${arriveOn}T12:00:00`).getTime() - new Date(`${todayIsoDate()}T12:00:00`).getTime()) / 86_400_000,
      ),
    );
    const res = await placeLotOffer({
      lotId: lot.id,
      farmerId: lot.farmerId,
      tons: offerTons,
      pricePerKg: offerPrice,
      deliveryInDays,
    });
    if (!res.ok) {
      toast.error(errMsg(res.error, "saveFailed"), { id: toastId });
      return;
    }
    toast.success(t("offerSentDetail"), { id: toastId });
    setOpen(false);
    await reload();
  };

  if (loading && !lot) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-soft" />
        <div className="h-64 animate-pulse rounded-[22px] bg-soft" />
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="space-y-4">
        <Link
          href="/processor/lots"
          className="inline-flex h-10 items-center gap-1 rounded-full border border-line bg-card px-3 text-[14px] font-bold text-ink"
        >
          <ChevronLeft className="size-4" />
          {t("backToFindOlivesShort")}
        </Link>
        <ApCard className="p-5">
          <p className="text-[16px] font-extrabold text-ink">{t("notAvailable")}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("lotEmptyBody")}</p>
        </ApCard>
      </div>
    );
  }

  const badges = lotBadgesFor(lot, t);
  const resolvedPlace = lotPlaceLabel(lot, t("anonymousGrove"), place, locale);
  const region = regionLabel(lot.region, locale);
  const variety = varietyLabel(lot.variety, locale);
  const harvest = harvestRangeLabel(lot.harvestStart, lot.harvestEnd, locale);
  const useLabel = lot.useType === "table" ? t("filterTable") : t("filterOil");
  const factors = breakdown ?? (lot.qualityScore != null ? fallbackBreakdown(lot.qualityScore) : null);
  const scoreStyle = lot.qualityScore != null ? scoreToneClasses(lot.qualityScore) : null;
  const statusSubtitle =
    lot.status === "sold"
      ? t("lotDetailSubtitleSold")
      : lot.status === "reserved"
        ? t("lotDetailSubtitleReserved")
        : null;

  const qtyLabel = formatQuantity(lot.product, lot.tons, locale);
  const offerForm = (
    <>
      <TextField
        label={isOil ? t("quantityKg") : t("tons")}
        value={tons}
        onChange={setTons}
        suffix={isOil ? "kg" : "t"}
        inputMode="decimal"
      />
      <p className="text-[12px] font-medium text-muted-foreground">
        {t("tonsExceedLot", { max: qtyLabel })}
      </p>
      <TextField label={t("price")} value={price} onChange={setPrice} suffix="€/kg" inputMode="decimal" />
      {offerErrors.map((m) => (
        <p key={m} className="text-[13px] font-semibold text-risk" role="alert">
          {m}
        </p>
      ))}
      {offerTotal ? (
        <p className="rounded-xl bg-soft px-3 py-2.5 text-[14px] font-medium text-muted-foreground">
          {t("offerTotalPreview", { total: offerTotal })}
        </p>
      ) : null}
      <DayChipPicker
        label={t("arriveOn")}
        days={offerWeek}
        value={arriveOn}
        onChange={setArriveOn}
        formatDay={(iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: "short" })}
        todayLabel={t("todayShort")}
      />
    </>
  );

  const summaryCard = (
    <div className="flex flex-col rounded-[18px] border border-line bg-card p-5">
      <div className="order-2 flex items-start justify-between gap-3 min-[900px]:order-1">
        <div className="min-w-0 flex-1">
          <div className="mb-2">
            <ProductBadge product={lot.product} label={t(productI18nKey(lot.product))} />
          </div>
          <h1 className="text-[24px] leading-7 font-extrabold text-ink">
            {variety} · {qtyLabel}
          </h1>
          {statusSubtitle ? (
            <p className="mt-1 text-[13px] font-medium text-muted-foreground">{statusSubtitle}</p>
          ) : null}
        </div>
        {!listed ? (
          <Pill tone={lot.status === "sold" ? "neutral" : "warn"}>
            {lot.status === "sold" ? t("soldStatus") : lot.status === "reserved" ? t("reservedStatus") : lot.status}
          </Pill>
        ) : null}
      </div>

      <div className="order-3 mt-3 min-[900px]:order-2">
        <LotBadges badges={badges} />
      </div>

      <div className="order-1 mt-0 flex items-end justify-between gap-3 min-[900px]:order-3 min-[900px]:mt-4">
        {lot.qualityScore != null && scoreStyle ? (
          <div className={cn("flex flex-col items-center rounded-2xl px-4 py-3", scoreStyle.soft)}>
            <span className={cn("text-[40px] leading-none font-extrabold tracking-tight", scoreStyle.text)}>
              {lot.qualityScore}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl bg-soft px-4 py-3">
            <span className="text-[40px] leading-none font-extrabold text-muted-foreground">—</span>
          </div>
        )}
        <div className="min-w-0 text-right">
          {lot.pricePerKg != null ? (
            <p className="text-[28px] leading-none font-extrabold tracking-tight text-ink">
              {formatEuroPerKg(lot.pricePerKg, locale)}
            </p>
          ) : (
            <p className="text-[15px] font-semibold text-muted-foreground">{t("openToOffers")}</p>
          )}
        </div>
      </div>

      <dl className="order-4 mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line pt-4 text-[14px]">
        {[
          { k: isOil ? t("quantityKg") : t("tons"), v: qtyLabel },
          { k: t("variety"), v: variety },
          { k: t("province"), v: region },
          { k: t("harvestPeriod"), v: harvest },
          ...(isOil
            ? [
                ...(lot.oilCategory
                  ? [{ k: t("oilCategory"), v: t(oilCategoryI18nKey(lot.oilCategory)) }]
                  : []),
                ...(lot.acidity != null ? [{ k: t("acidity"), v: `${lot.acidity}%` }] : []),
                ...(lot.harvestSeason ? [{ k: t("harvestSeason"), v: lot.harvestSeason }] : []),
                ...(lot.storage ? [{ k: t("storage"), v: t(oilStorageI18nKey(lot.storage)) }] : []),
                ...(lot.peroxide != null ? [{ k: t("peroxide"), v: `${lot.peroxide} meq O₂/kg` }] : []),
                ...(lot.polyphenols != null ? [{ k: t("polyphenols"), v: `${lot.polyphenols} mg/kg` }] : []),
                ...(lot.pdoPgi ? [{ k: t("pdoPgi"), v: formatOilPdoPgi(lot.pdoPgi, locale) }] : []),
                ...(lot.organic ? [{ k: t("organicOil"), v: "✓" }] : []),
              ]
            : [{ k: t("useLabel"), v: useLabel }]),
        ].map((row) => (
          <div key={row.k} className="min-w-0">
            <dt className="font-medium text-muted-foreground">{row.k}</dt>
            <dd className="mt-0.5 font-extrabold text-ink">{row.v}</dd>
          </div>
        ))}
      </dl>

      <p className="order-5 mt-4 flex items-start gap-1.5 text-[13px] font-medium text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{t("lotAnonymousLine")}</span>
      </p>

      {listed ? (
        <div className="order-6 mt-5 hidden min-[900px]:block">
          <ApButton
            label={sent ? t("offerSent") : t("makeOffer")}
            variant="dark"
            disabled={sent}
            onClick={openOffer}
            className="h-12 w-full"
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={cn("mx-auto w-full max-w-[1200px]", listed ? "pb-40 min-[900px]:pb-8" : "pb-8")}>
      <div className="mb-4">
        <Link
          href="/processor/lots"
          className="inline-flex h-10 items-center gap-1 rounded-full border border-line bg-card px-3 text-[14px] font-bold text-ink hover:bg-soft"
        >
          <ChevronLeft className="size-4" />
          {t("backToFindOlivesShort")}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[1fr_360px]">
        <div className="order-2 flex min-w-0 flex-col gap-4 min-[900px]:order-1">
          {/* Score history only: no farmer identity is selected or shown (reveals after accept, as before). */}
          {/* Bulk oil lots have no field, so there is no score history to show. */}
          {lot.fieldId ? (
            <ScoreHistoryChart fieldId={lot.fieldId} refreshKey={lot.qualityScore} className="p-5" />
          ) : null}

          <ApCard className="p-5">
            <p className="text-[16px] font-extrabold text-ink">{t("scoreBreakdownTitle")}</p>
            <div className="mt-3">
              <FactorRow
                label={t("factorTree")}
                hint={t("factorTreeHint")}
                value={factors?.tree ?? null}
                goodLabel={t("factorGood")}
                warnLabel={t("factorWarn")}
                riskLabel={t("factorRisk")}
              />
              <FactorRow
                label={t("factorSpray")}
                hint={t("factorSprayHint")}
                value={factors?.spray ?? null}
                goodLabel={t("factorGood")}
                warnLabel={t("factorWarn")}
                riskLabel={t("factorRisk")}
              />
              <FactorRow
                label={t("factorHarvest")}
                hint={t("factorHarvestHint")}
                value={factors?.harvest ?? null}
                goodLabel={t("factorGood")}
                warnLabel={t("factorWarn")}
                riskLabel={t("factorRisk")}
              />
              <FactorRow
                label={t("factorRecords")}
                hint={t("factorRecordsHint")}
                value={factors?.records ?? null}
                goodLabel={t("factorGood")}
                warnLabel={t("factorWarn")}
                riskLabel={t("factorRisk")}
              />
            </div>
          </ApCard>

          <ApCard className="overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <p className="text-[16px] font-extrabold text-ink">{t("sprayHistoryTitle")}</p>
            </div>
            {sprays.length === 0 ? (
              <p className="border-t border-line px-5 py-8 text-center text-[13px] font-semibold text-muted-foreground">
                {t("sprayHistoryEmpty")}
              </p>
            ) : (
              sprays.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
                  <div>
                    <p className="text-[14px] font-extrabold text-ink">{s.product}</p>
                    <p className="text-[12px] font-medium text-muted-foreground">
                      {formatDateShort(s.appliedAt.slice(0, 10), locale)}
                    </p>
                  </div>
                  <Pill tone={s.euBanned ? "risk" : s.euStatus === "allowed" ? "good" : "warn"}>
                    {s.euBanned
                      ? t("sprayNotApproved")
                      : s.euStatus === "allowed"
                        ? t("sprayEuApproved")
                        : t("sprayEuUnknown")}
                  </Pill>
                </div>
              ))
            )}
          </ApCard>

          <ApCard className="p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft text-ink">
                {lot.labResult ? <FlaskConical className="size-5" /> : <ShieldCheck className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-extrabold text-ink">{t("labCheckTitle")}</p>
                {lot.labResult ? (
                  <p className="mt-1 text-[14px] font-semibold text-ink">
                    {lot.labResult === "passed" ? t("labPassed") : t("labFailed")}
                    {lot.labAcidity != null ? ` · ${t("labAcidity", { n: String(lot.labAcidity) })}` : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-[13px] font-medium text-muted-foreground">{t("labResultEmpty")}</p>
                )}
                {!lot.labResult ? (
                  <div className="mt-3">
                    <ApButton
                      label={t("requestLabCheck")}
                      variant="outline"
                      onClick={() => toast.success(t("labRequestSent"))}
                    />
                  </div>
                ) : null}
              </div>
              {lot.labResult ? (
                <Pill tone={lot.labResult === "passed" ? "good" : "risk"}>
                  {lot.labResult === "passed" ? t("labPassed") : t("labFailed")}
                </Pill>
              ) : null}
            </div>
          </ApCard>

          {lot.lat != null && lot.lon != null ? (
            <LotsMap
              token={mapToken}
              popup={false}
              height={240}
              points={[
                {
                  id: lot.id,
                  lat: lot.lat,
                  lon: lot.lon,
                  label: resolvedPlace,
                  score: lot.qualityScore,
                  title: `${variety} · ${qtyLabel}`,
                  subtitle: region,
                  priceLabel: lot.pricePerKg != null ? formatEuroPerKg(lot.pricePerKg, locale) : t("openToOffers"),
                  useLabel,
                  harvestLabel: harvest,
                },
              ]}
              selectedId={lot.id}
              onSelect={() => undefined}
              labels={{
                locate: t("mapLocate"),
                zoomIn: t("mapZoomIn"),
                zoomOut: t("mapZoomOut"),
                needToken: t("mapNeedToken"),
                empty: t("mapEmpty"),
                qualityScore: t("qualityScore"),
                openLot: t("openLot"),
              }}
            />
          ) : null}
        </div>

        <aside className="order-1 min-w-0 min-[900px]:order-2">
          <div className="min-[900px]:sticky min-[900px]:top-8">{summaryCard}</div>
        </aside>
      </div>

      {listed ? (
        <div className="fixed inset-x-0 bottom-[64px] z-40 border-t border-line bg-card p-3 min-[900px]:hidden">
          <ApButton
            label={sent ? t("offerSent") : t("makeOffer")}
            variant="dark"
            disabled={sent}
            onClick={openOffer}
            className="h-12 w-full"
          />
        </div>
      ) : null}

      {wide ? (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title={t("makeOffer")}
          subtitle={`${variety} · ${qtyLabel}`}
          actionLabel={t("sendOfferAction")}
          onAction={() => submit()}
          actionDisabled={!offerValid || sent || submitting}
        >
          {offerForm}
        </Dialog>
      ) : (
        <BottomSheet
          open={open}
          onClose={() => setOpen(false)}
          title={t("makeOffer")}
          actionLabel={t("sendOfferAction")}
          onAction={() => submit()}
          footer={
            <ApButton
              label={t("sendOfferAction")}
              variant="dark"
              disabled={!offerValid || sent || submitting}
              onClick={() => void submit()}
              className="h-12 w-full"
            />
          }
        >
          <p className="text-[13px] font-medium text-muted-foreground">
            {variety} · {qtyLabel}
          </p>
          {offerForm}
        </BottomSheet>
      )}
    </div>
  );
}
