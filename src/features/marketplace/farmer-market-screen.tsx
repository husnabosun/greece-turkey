"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  ChevronRight,
  FlaskConical,
  Plus,
  Search,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import { StatusSteps } from "@/shared/components/brand";
import { Chip } from "@/shared/components/brand/chip";
import { varietyLabel } from "@/features/fields/olive-varieties";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import {
  deliveryPayableAmount,
  deliveryPayableKg,
  deliveryStepIndex,
} from "@/features/marketplace/delivery-state";
import { BottomSheet, DayChipPicker, Segmented } from "@/features/marketplace/processor-kit";
import { scoreToneClasses } from "@/features/marketplace/score-slider";
import {
  MARKET_LIMITS,
  formatEuro,
  formatEuroPerKg,
  formatQuantity,
  kgToTons,
  parseBounded,
  parseLocaleNumber,
  saleTotal,
  tonsToKg,
} from "@/features/marketplace/pricing";
import { ProductBadge, productI18nKey } from "@/features/marketplace/product-badge";
import type { ProductKind } from "@/shared/types/database";
import { formatRequestWindow, isRequestWindowExpired } from "@/features/marketplace/request-window";
import { regionForPoint, regionLabel, requestRegions } from "@/features/marketplace/regions";
import {
  DEFAULT_DELIVERY_IN_DAYS,
  addDaysIso,
  nextSevenDays,
  todayIsoDate,
} from "@/features/marketplace/schedule";
import {
  acceptOffer,
  counterOffer,
  rejectIncomingBid,
  updateListedLot,
  useFarmerMarket,
  withdrawListedLot,
  withdrawOffer,
  type FieldMarketCard,
  type MarketDelivery,
  type MarketOffer,
  type MarketRequest,
} from "@/features/marketplace/use-farmer-market";
import { ApButton } from "@/shared/components/brand";
import { useSalesUnseen } from "@/features/marketplace/use-sales-seen";
import { Link, useRouter } from "@/shared/i18n/navigation";
import type { Field } from "@/shared/types/database";
import { FIELD_DOTS } from "@/shared/theme/tokens";
import { cn } from "@/shared/lib/utils";
import { useBoundsMessage, useErrorMessage } from "@/shared/lib/error-message";

type Tab = "overview" | "requests" | "offers" | "sales";
type FilterKey = "fits" | "near" | string;

const TABS: Tab[] = ["overview", "requests", "offers", "sales"];

function isTab(value: string | undefined): value is Tab {
  return !!value && (TABS as string[]).includes(value);
}

function formatDeliveryDay(iso: string | null, locale: string) {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

function groupOffersByLot(
  offers: MarketOffer[],
  fieldCards: Record<string, FieldMarketCard>,
) {
  const map = new Map<
    string,
    {
      lotId: string;
      fieldName: string | null;
      lotVariety: string | null;
      product: ProductKind;
      tons: number;
      askPrice: number | null;
      offers: MarketOffer[];
      bestId: string;
    }
  >();
  for (const offer of offers) {
    const cur = map.get(offer.lotId);
    if (!cur) {
      const ask =
        offer.fieldId != null ? (fieldCards[offer.fieldId]?.listedPrice ?? null) : null;
      map.set(offer.lotId, {
        lotId: offer.lotId,
        fieldName: offer.fieldName,
        lotVariety: offer.lotVariety,
        product: offer.product,
        tons: offer.tons,
        askPrice: ask,
        offers: [offer],
        bestId: offer.id,
      });
      continue;
    }
    cur.offers.push(offer);
    const best = cur.offers.reduce((a, b) => (b.pricePerKg > a.pricePerKg ? b : a));
    cur.bestId = best.id;
    cur.tons = Math.max(cur.tons, offer.tons);
  }
  return [...map.values()].map((g) => ({
    ...g,
    offers: [...g.offers].sort((a, b) => b.pricePerKg - a.pricePerKg),
  }));
}

function nextStepHint(
  delivery: MarketDelivery,
  t: ReturnType<typeof useTranslations<"farmerMarket">>,
) {
  if (delivery.labResult === "failed") return t("labFailedHint");
  if (delivery.status === "scheduled") return t("nextPickupHint");
  if (delivery.status === "weighed") return t("nextLabHint");
  if (delivery.status === "lab_checked") return t("nextPaidHint");
  return t("deliveryNextHint");
}

function fieldVariety(f: Field): string | null {
  return f.variety_slug ?? f.variety ?? null;
}

type MatchCtx = {
  fieldCards: Record<string, FieldMarketCard>;
  country: "GR" | "TR" | null;
};

function fieldRegion(field: Field, ctx: MatchCtx) {
  return regionForPoint(field.lat, field.lon, ctx.country);
}

/** Region rule: request without a resolvable region = anywhere; otherwise the field must sit in one of them. */
function regionOk(req: MarketRequest, field: Field, ctx: MatchCtx): boolean {
  const wanted = requestRegions(req.region);
  if (!wanted.length) return true;
  const here = fieldRegion(field, ctx);
  return here != null && wanted.includes(here);
}

function varietyOk(req: MarketRequest, field: Field): boolean {
  const v = fieldVariety(field)?.toLowerCase();
  return Boolean(v && req.variety && v === req.variety.toLowerCase());
}

function scoreOk(req: MarketRequest, field: Field, ctx: MatchCtx): boolean {
  const score = ctx.fieldCards[field.id]?.qualityScore;
  if (req.minScore <= 0) return true;
  return score != null && score >= req.minScore;
}

/** A field whose harvest is already sold / in delivery (and has nothing else listed) can't sell again. */
function availableOk(field: Field, ctx: MatchCtx): boolean {
  const card = ctx.fieldCards[field.id];
  if (!card) return true;
  const committed = card.lotStatus === "sold" || card.lotStatus === "reserved";
  return !committed || card.listedLots.length > 0;
}

function requestFitsField(req: MarketRequest, field: Field, ctx: MatchCtx): boolean {
  if (req.tons - req.filledTons <= 0) return false;
  if (req.product === "oil") return true;
  return varietyOk(req, field) && regionOk(req, field, ctx) && scoreOk(req, field, ctx) && availableOk(field, ctx);
}

function bestFieldForRequest(fields: Field[], ctx: MatchCtx, req: MarketRequest): Field | undefined {
  const fitting = fields.filter((f) => requestFitsField(req, f, ctx));
  if (!fitting.length) return undefined;
  return fitting.reduce((best, f) => {
    const bestScore = ctx.fieldCards[best.id]?.qualityScore ?? -1;
    const score = ctx.fieldCards[f.id]?.qualityScore ?? -1;
    return score > bestScore ? f : best;
  });
}

function requestMismatchReason(
  req: MarketRequest,
  fields: Field[],
  ctx: MatchCtx,
  locale: string,
  t: ReturnType<typeof useTranslations<"farmerMarket">>,
): string {
  if (req.product === "oil") {
    if (req.tons - req.filledTons <= 0) return t("requestFilled");
    return t("cannotSellHere");
  }
  if (!fields.length) return t("needFieldFirst");
  if (req.tons - req.filledTons <= 0) return t("requestFilled");
  const withVariety = fields.filter((f) => varietyOk(req, f));
  if (!withVariety.length) return t("needVariety", { variety: varietyLabel(req.variety, locale) });
  const inRegion = withVariety.filter((f) => regionOk(req, f, ctx));
  if (!inRegion.length) return t("needRegion", { region: regionLabel(req.region, locale) });
  const withScore = inRegion.filter((f) => scoreOk(req, f, ctx));
  if (!withScore.length) {
    const unknown = inRegion.every((f) => ctx.fieldCards[f.id]?.qualityScore == null);
    return unknown ? t("needScoreUnknown") : t("needScore", { score: req.minScore });
  }
  if (!withScore.some((f) => availableOk(f, ctx))) return t("needUnsoldField");
  return t("cannotSellHere");
}

export function FarmerMarketScreen({ initialTab }: { initialTab?: string }) {
  const t = useTranslations("farmerMarket");
  const errMsg = useErrorMessage();
  const boundsMsg = useBoundsMessage();
  const tFields = useTranslations("farmerFields");
  const locale = useLocale();
  const router = useRouter();
  const { fields, loading, error } = useFarmerFields();
  const fieldIds = useMemo(() => fields.map((f) => f.id), [fields]);
  const {
    userId,
    offers,
    requests,
    deliveries,
    fieldCards,
    stockLots,
    farmerCountry,
    loading: marketLoading,
    reload,
  } = useFarmerMarket(fieldIds);
  const matchCtx = useMemo<MatchCtx>(
    () => ({ fieldCards, country: farmerCountry }),
    [fieldCards, farmerCountry],
  );
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : "overview");
  const [filters, setFilters] = useState<FilterKey[]>(["fits"]);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<MarketOffer | null>(null);
  const [acceptDate, setAcceptDate] = useState(() =>
    addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS),
  );
  const weekDates = useMemo(() => nextSevenDays(), []);
  const [counterTarget, setCounterTarget] = useState<MarketOffer | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [rejectTarget, setRejectTarget] = useState<MarketOffer | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<MarketOffer | null>(null);
  const [listingTarget, setListingTarget] = useState<{
    field: Field;
    card: FieldMarketCard;
  } | null>(null);
  const [listingPrice, setListingPrice] = useState("");
  const [listingTons, setListingTons] = useState("");
  const [listingBusy, setListingBusy] = useState(false);
  const [sellProduct, setSellProduct] = useState<ProductKind>("oil");

  const steps = useMemo(
    () => [t("stepScheduled"), t("stepWeighed"), t("stepLab"), t("stepPaid")],
    [t],
  );

  // Flow A: only pending mill bids on still-listed lots are actionable.
  const incomingBids = useMemo(
    () =>
      offers.filter(
        (o) =>
          o.initiatedBy === "processor" &&
          o.status === "pending" &&
          o.lotStatus === "listed",
      ),
    [offers],
  );
  // Flow B: your offers to mill buy-requests — waiting on mill.
  const sentOffers = useMemo(
    () =>
      offers.filter(
        (o) => o.initiatedBy === "farmer" && (o.status === "pending" || o.status === "countered"),
      ),
    [offers],
  );
  const bestOffer = incomingBids[0] ?? null;
  const activeDeliveries = useMemo(
    () => deliveries.filter((d) => d.status !== "paid" && d.status !== "cancelled"),
    [deliveries],
  );
  const paidDeliveries = deliveries.filter((d) => d.status === "paid");
  const paidSeason = paidDeliveries.reduce(
    (sum, d) => sum + deliveryPayableAmount(d.tons, d.pricePerKg, d.actualKg),
    0,
  );
  const onTheWay = activeDeliveries
    .filter((d) => d.labResult !== "failed")
    .reduce((sum, d) => sum + deliveryPayableAmount(d.tons, d.pricePerKg, d.actualKg), 0);
  const closedDeliveries = deliveries.filter((d) => d.status === "cancelled");
  // New delivery or a step change since Sales was last opened (updates in realtime).
  const salesUnseen = useSalesUnseen(userId, deliveries, !marketLoading, tab === "sales");
  const tabBadge: Partial<Record<Tab, number>> = { offers: incomingBids.length, sales: salesUnseen };

  const regionChips = useMemo(() => {
    // One chip per resolved region (different spellings of the same place used to give duplicate chips).
    const byLabel = new Map<string, string>();
    for (const r of requests) {
      const resolved = requestRegions(r.region);
      const keys = resolved.length ? resolved : r.region?.trim() ? [r.region.trim()] : [];
      for (const k of keys) {
        const label = regionLabel(k, locale);
        if (!byLabel.has(label)) byLabel.set(label, k);
      }
    }
    return [...byLabel.values()].slice(0, 6);
  }, [requests, locale]);

  const filterChips: { key: FilterKey; label: string }[] = [
    { key: "fits", label: t("fits") },
    { key: "near", label: t("near") },
    ...regionChips.map((r) => ({ key: `region:${r}`, label: regionLabel(r, locale) })),
  ];

  const filteredRequests = useMemo(() => {
    let list = requests.filter((req) => !isRequestWindowExpired(req.windowLabel));
    if (filters.includes("fits")) {
      list = list.filter((req) =>
        req.product === "oil"
          ? req.tons - req.filledTons > 0
          : bestFieldForRequest(fields, matchCtx, req) != null,
      );
    }
    const regionFilters = filters
      .filter((f) => f.startsWith("region:"))
      .map((f) => f.slice("region:".length).toLowerCase());
    if (regionFilters.length) {
      list = list.filter((req) => {
        const resolved = requestRegions(req.region).map((x) => x.toLowerCase());
        return regionFilters.some(
          (r) => resolved.includes(r) || (req.region ?? "").toLowerCase().includes(r),
        );
      });
    }
    if (filters.includes("near") && fields.some((f) => f.lat != null && f.lon != null)) {
      // Near = at least one of my fields lies in the request's region.
      list = list.filter((req) => fields.some((f) => regionOk(req, f, matchCtx)));
    }
    return list;
  }, [requests, filters, fields, matchCtx]);

  function openAccept(offer: MarketOffer) {
    if (offer.initiatedBy !== "processor") return;
    setAcceptDate(addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS));
    setAcceptTarget(offer);
  }

  async function confirmAccept() {
    const offer = acceptTarget;
    if (!offer || offer.initiatedBy !== "processor") return;
    setBusyOfferId(offer.id);
    const toastId = toast.loading(t("accepting"));
    try {
      const result = await acceptOffer(offer.id, { scheduledFor: acceptDate });
      if (!result.ok) {
        toast.error(errMsg(result.error, "actionFailed"), { id: toastId });
        return;
      }
      const dateLabel = new Date(`${acceptDate}T12:00:00`).toLocaleDateString(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      toast.success(t("acceptedScheduled", { date: dateLabel }), { id: toastId });
      setAcceptTarget(null);
      setTab("sales");
      await reload();
    } finally {
      setBusyOfferId(null);
    }
  }

  function onRejectBid(offer: MarketOffer) {
    if (offer.initiatedBy !== "processor") return;
    setRejectTarget(offer);
  }

  async function confirmRejectBid() {
    if (!rejectTarget) return;
    setBusyOfferId(rejectTarget.id);
    try {
      const result = await rejectIncomingBid(rejectTarget.id);
      if (!result.ok) {
        toast.error(errMsg(result.error, "actionFailed"));
        return;
      }
      toast.success(t("rejectedBidOk"));
      setRejectTarget(null);
      await reload();
    } finally {
      setBusyOfferId(null);
    }
  }

  function onWithdraw(offer: MarketOffer) {
    if (offer.initiatedBy !== "farmer") return;
    setWithdrawTarget(offer);
  }

  async function confirmWithdrawOffer() {
    if (!withdrawTarget) return;
    setBusyOfferId(withdrawTarget.id);
    try {
      const result = await withdrawOffer(withdrawTarget.id);
      if (!result.ok) {
        toast.error(errMsg(result.error, "actionFailed"));
        return;
      }
      toast.success(t("withdrawnOk"));
      setWithdrawTarget(null);
      await reload();
    } finally {
      setBusyOfferId(null);
    }
  }

  /** Jump to the Offers tab, at the bids of this listing. */
  function openLotOffers(lotId: string) {
    setTab("offers");
    window.setTimeout(() => {
      document.getElementById(`lot-offers-${lotId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function listingProduct(card: FieldMarketCard): ProductKind {
    const lot = card.lots.find((l) => l.id === card.listedLotId);
    return lot?.product ?? "olives";
  }

  function openListing(field: Field, card: FieldMarketCard) {
    if (!card.listedLotId || card.lotStatus !== "listed") return;
    setListingTarget({ field, card });
    setListingPrice(
      card.listedPrice != null ? card.listedPrice.toFixed(2).replace(".", ",") : "",
    );
    const oil = listingProduct(card) === "oil";
    const qty = card.listedTons;
    setListingTons(
      qty != null ? String(oil ? tonsToKg(qty) : qty).replace(".", ",") : "",
    );
  }

  async function confirmSaveListing() {
    if (!listingTarget?.card.listedLotId) return;
    const oil = listingProduct(listingTarget.card) === "oil";
    const pc = parseBounded(listingPrice, oil ? MARKET_LIMITS.oilPricePerKg : MARKET_LIMITS.pricePerKg);
    const tc = parseBounded(listingTons, oil ? MARKET_LIMITS.oilKg : MARKET_LIMITS.lotTons);
    if (!pc.ok) {
      toast.error(boundsMsg(pc, "price", locale));
      return;
    }
    if (!tc.ok) {
      toast.error(boundsMsg(tc, oil ? "kg" : "tons", locale));
      return;
    }
    const price = pc.value;
    const tons = oil ? kgToTons(tc.value) : tc.value;
    setListingBusy(true);
    try {
      const result = await updateListedLot(listingTarget.card.listedLotId, {
        pricePerKg: price,
        tons,
      });
      if (!result.ok) {
        toast.error(result.error === "invalidTons" ? t("invalidTons") : (errMsg(result.error, "actionFailed")));
        return;
      }
      toast.success(t("listingSavedOk"));
      setListingTarget(null);
      await reload();
    } finally {
      setListingBusy(false);
    }
  }

  async function confirmWithdrawListing() {
    if (!listingTarget?.card.listedLotId) return;
    setListingBusy(true);
    try {
      const result = await withdrawListedLot(listingTarget.card.listedLotId);
      if (!result.ok) {
        toast.error(errMsg(result.error, "actionFailed"));
        return;
      }
      toast.success(t("listingWithdrawnOk"));
      setListingTarget(null);
      await reload();
    } finally {
      setListingBusy(false);
    }
  }

  function openCounter(offer: MarketOffer) {
    if (offer.initiatedBy !== "processor" || offer.status !== "pending") return;
    setCounterTarget(offer);
    setCounterPrice((offer.pricePerKg + 0.01).toFixed(2).replace(".", ","));
  }

  async function confirmCounter() {
    const offer = counterTarget;
    if (!offer) return;
    const pc = parseBounded(counterPrice, MARKET_LIMITS.pricePerKg);
    if (!pc.ok) {
      toast.error(boundsMsg(pc, "price", locale));
      return;
    }
    const price = pc.value;
    setBusyOfferId(offer.id);
    const toastId = toast.loading(t("countering"));
    try {
      // Use the exact price the farmer typed — no silent 0.05 rounding.
      const result = await counterOffer(offer, Math.round(price * 100) / 100);
      if (!result.ok) {
        toast.error(errMsg(result.error, "actionFailed"), { id: toastId });
        return;
      }
      toast.success(t("counteredOkDetail"), { id: toastId });
      setCounterTarget(null);
      await reload();
    } finally {
      setBusyOfferId(null);
    }
  }

  const counterTotal =
    counterTarget != null
      ? (() => {
          const pc = parseBounded(counterPrice, MARKET_LIMITS.pricePerKg);
          return pc.ok ? saleTotal(counterTarget.tons, pc.value) : null;
        })()
      : null;

  return (
    <div className="w-full flex-1">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-ap-title text-ink">{t("title")}</h1>
        <button
          type="button"
          aria-label={t("search")}
          onClick={() => toast(t("searchSoon"))}
          className="flex size-11 items-center justify-center rounded-full border border-line bg-card"
        >
          <Search className="size-[18px]" />
        </button>
      </div>

      <div className="mt-3">
        <Segmented
          fullWidth
          value={tab}
          onChange={setTab}
          options={TABS.map((id) => ({
            value: id,
            label: t(id),
            badge: tabBadge[id] || undefined,
          }))}
        />
      </div>

      {tab === "overview" ? (
        <div className="mt-4">
          <div className="rounded-[18px] border border-line bg-card p-3">
            <Segmented
              fullWidth
              value={sellProduct}
              onChange={setSellProduct}
              options={[
                { value: "oil", label: t("productOil") },
                { value: "olives", label: t("productOlives") },
              ]}
            />
            <button
              type="button"
              onClick={() => router.push(`/farmer/market/new?product=${sellProduct}`)}
              className="mt-3 flex h-12 w-full items-center gap-3 rounded-2xl bg-ink px-4 text-left text-white"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15">
                <Plus className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold leading-5">{t("sellTitle")}</span>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-ink">
                <ArrowRight className="size-3.5" />
              </span>
            </button>
          </div>

          <SectionTitle>{t("bestOffer")}</SectionTitle>
          {bestOffer ? (
            <OfferCard
              offer={bestOffer}
              busy={busyOfferId === bestOffer.id}
              locale={locale}
              counter={t("counter")}
              accept={t("accept")}
              reject={t("reject")}
              perKg={t("perKg")}
              acceptClass="bg-ink"
              onAccept={() => openAccept(bestOffer)}
              onCounter={() => openCounter(bestOffer)}
              onReject={() => void onRejectBid(bestOffer)}
            />
          ) : (
            <div className="mt-2 rounded-[18px] border border-line bg-card p-3">
              <p className="text-ap-small text-muted-foreground">{t("noOffers")}</p>
            </div>
          )}

          <SectionTitle>{t("yourFields")}</SectionTitle>
          {loading || marketLoading ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="h-28 animate-pulse rounded-[18px] bg-soft" />
              <div className="h-28 animate-pulse rounded-[18px] bg-soft" />
            </div>
          ) : null}
          {error ? (
            <p className="mt-2 text-ap-small text-risk">
              {error === "needSupabase" || error === "needLogin" ? tFields(error) : error}
            </p>
          ) : null}
          {!loading && fields.length === 0 ? (
            <div className="mt-2 rounded-[18px] border border-line bg-card px-4 py-6 text-center text-ap-body font-semibold text-muted-foreground">
              {t("noFieldScores")}
            </div>
          ) : null}
          {!loading && fields.length > 0 ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {fields.map((field, i) => {
                const card = fieldCards[field.id];
                const lots = card?.lots ?? [];
                return (
                  <div key={field.id} className="rounded-[18px] border border-line bg-card p-3">
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: FIELD_DOTS[i % FIELD_DOTS.length] }}
                        />
                        <p className="truncate text-ap-body font-extrabold text-ink">{field.name}</p>
                      </div>
                      {(() => {
                        const sc = card?.qualityScore;
                        const tone = sc != null ? scoreToneClasses(sc) : null;
                        return (
                          <span
                            className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-full text-ap-small font-extrabold",
                              tone ? cn(tone.soft, tone.text) : "bg-soft text-muted-foreground",
                            )}
                          >
                            {sc ?? "—"}
                          </span>
                        );
                      })()}
                    </div>
                    {card && lots.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {lots.map((lot) => {
                          const isListed = lot.status === "listed";
                          return (
                            <div key={lot.id} className="rounded-xl bg-soft/70 px-2.5 py-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <ProductBadge product={lot.product} label={t(productI18nKey(lot.product))} />
                                <span
                                  className={cn(
                                    "text-[11px] font-bold",
                                    isListed ? "text-good" : "text-ap-accent",
                                  )}
                                >
                                  {lot.status === "listed"
                                    ? t("fieldListed")
                                    : lot.status === "sold"
                                      ? t("fieldSold")
                                      : t("fieldInDelivery")}
                                </span>
                              </div>
                              <p className="mt-1 text-[13px] font-extrabold leading-4 text-ink">
                                {lot.pricePerKg != null ? formatEuroPerKg(lot.pricePerKg, locale) : "—"}
                                {lot.tons != null ? ` · ${formatQuantity(lot.product, lot.tons, locale)}` : ""}
                              </p>
                              {isListed ? (
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openListing(field, {
                                        ...card,
                                        lotStatus: "listed",
                                        listedLotId: lot.id,
                                        listedPrice: lot.pricePerKg,
                                        listedTons: lot.tons,
                                      })
                                    }
                                    className="inline-flex items-center text-[12px] font-bold text-ink"
                                  >
                                    {t("manageListing")}
                                    <ChevronRight className="size-3.5" />
                                  </button>
                                  {lot.offerCount > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => openLotOffers(lot.id)}
                                      className="inline-flex items-center text-[12px] font-semibold text-good"
                                    >
                                      {t("offersCount", { n: lot.offerCount })}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <>
                        <p className="mt-2 text-ap-small font-semibold text-muted-foreground">
                          {t("fieldNotListed")}
                        </p>
                        <Link
                          href={`/farmer/market/new?field=${field.id}&product=olives`}
                          className="mt-1.5 inline-flex items-center text-[13px] font-bold text-ink"
                        >
                          {t("listNow")}
                          <ChevronRight className="size-3.5" />
                        </Link>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          {stockLots.length > 0 ? (
            <>
              <SectionTitle>{t("yourStock")}</SectionTitle>
              <div className="mt-2 space-y-2">
                {stockLots.map((lot) => {
                  const isListed = lot.status === "listed";
                  return (
                    <div key={lot.id} className="rounded-[18px] border border-line bg-card p-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <ProductBadge product={lot.product} label={t(productI18nKey(lot.product))} />
                        <span
                          className={cn(
                            "text-[11px] font-bold",
                            isListed ? "text-good" : "text-ap-accent",
                          )}
                        >
                          {lot.status === "listed"
                            ? t("fieldListed")
                            : lot.status === "sold"
                              ? t("fieldSold")
                              : t("fieldInDelivery")}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] font-semibold text-muted-foreground">{t("bulkOil")}</p>
                      <p className="mt-1 text-[15px] font-extrabold leading-5 text-ink">
                        {lot.pricePerKg != null ? formatEuroPerKg(lot.pricePerKg, locale) : "—"}
                        {lot.tons != null ? ` · ${formatQuantity(lot.product, lot.tons, locale)}` : ""}
                      </p>
                      {isListed && lot.offerCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => openLotOffers(lot.id)}
                          className="mt-2 inline-flex items-center text-[12px] font-semibold text-good"
                        >
                          {t("offersCount", { n: lot.offerCount })}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          <SectionTitle>{t("factoriesLooking")}</SectionTitle>
          {requests.length === 0 ? (
            <div className="mt-2 rounded-[18px] border border-line bg-card px-4 py-8 text-center text-ap-body font-semibold text-muted-foreground">
              {t("noFactories")}
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {requests.slice(0, 3).map((req) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  locale={locale}
                  fitField={bestFieldForRequest(fields, matchCtx, req)}
                  fitScore={
                    (() => {
                      const f = bestFieldForRequest(fields, matchCtx, req);
                      return f ? fieldCards[f.id]?.qualityScore ?? null : null;
                    })()
                  }
                  mismatch={requestMismatchReason(req, fields, matchCtx, locale, t)}
                  offerLabel={t("offer")}
                  canSellLabel={t("canSellHere")}
                  filledOf={t("filledOf", {
                    filled: formatQuantity(req.product, req.filledTons, locale),
                    total: formatQuantity(req.product, req.tons, locale),
                  })}
                  onOffer={() => {
                    const oilOk = req.product === "oil" && req.tons - req.filledTons > 0;
                    const field = bestFieldForRequest(fields, matchCtx, req);
                    if (!oilOk && !field) {
                      toast.message(requestMismatchReason(req, fields, matchCtx, locale, t));
                      return;
                    }
                    const qs = new URLSearchParams();
                    if (field) qs.set("field", field.id);
                    qs.set("factory", req.processorId);
                    qs.set("request", req.id);
                    qs.set("product", req.product);
                    router.push(`/farmer/market/new?${qs.toString()}`);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "requests" ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3 rounded-[18px] bg-good-soft p-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card">
              <TrendingUp className="size-5 text-good" />
            </span>
            <div>
              <p className="text-ap-card font-extrabold text-good">{t("pricesUp")}</p>
              <p className="text-ap-body text-muted-foreground">{t("pricesUpHint")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filterChips.map((chip) => {
              const on = filters.includes(chip.key);
              return (
                <Chip
                  key={chip.key}
                  tone="black"
                  on={on}
                  onClick={() =>
                    setFilters((prev) => (on ? prev.filter((k) => k !== chip.key) : [...prev, chip.key]))
                  }
                  className="shrink-0"
                >
                  <span className={cn("inline-flex items-center gap-1 text-ap-pill font-bold", on ? "text-white" : "text-ink")}>
                    {on ? <Check className="size-3" strokeWidth={3} /> : null}
                    {chip.label}
                  </span>
                </Chip>
              );
            })}
            <button
              type="button"
              aria-label={t("filters")}
              onClick={() => setFilters([])}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card"
            >
              <SlidersHorizontal className="size-3.5" />
            </button>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="rounded-[18px] border border-line bg-card px-4 py-10 text-center text-ap-body font-semibold text-muted-foreground">
              {t("noBuyerRequests")}
            </div>
          ) : (
            filteredRequests.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                locale={locale}
                fitField={bestFieldForRequest(fields, matchCtx, req)}
                fitScore={
                  (() => {
                    const f = bestFieldForRequest(fields, matchCtx, req);
                    return f ? fieldCards[f.id]?.qualityScore ?? null : null;
                  })()
                }
                mismatch={requestMismatchReason(req, fields, matchCtx, locale, t)}
                offerLabel={t("offer")}
                canSellLabel={t("canSellHere")}
                filledOf={t("filledOf", {
                  filled: formatQuantity(req.product, req.filledTons, locale),
                  total: formatQuantity(req.product, req.tons, locale),
                })}
                onOffer={() => {
                  const oilOk = req.product === "oil" && req.tons - req.filledTons > 0;
                  const field = bestFieldForRequest(fields, matchCtx, req);
                  if (!oilOk && !field) {
                    toast.message(requestMismatchReason(req, fields, matchCtx, locale, t));
                    return;
                  }
                  const qs = new URLSearchParams();
                  if (field) qs.set("field", field.id);
                  qs.set("factory", req.processorId);
                  qs.set("request", req.id);
                  qs.set("product", req.product);
                  router.push(`/farmer/market/new?${qs.toString()}`);
                }}
              />
            ))
          )}
        </div>
      ) : null}

      {tab === "offers" ? (
        <div className="mt-4 space-y-3">
          {marketLoading ? (
            <div className="space-y-2">
              <div className="h-24 animate-pulse rounded-[18px] bg-soft" />
              <div className="h-24 animate-pulse rounded-[18px] bg-soft" />
            </div>
          ) : incomingBids.length === 0 && sentOffers.length === 0 && activeDeliveries.length === 0 ? (
            <div className="rounded-[18px] border border-line bg-card p-4 text-center">
              <p className="text-ap-body font-semibold text-ink">{t("noIncomingOffersTitle")}</p>
              <p className="mt-1 text-ap-small text-muted-foreground">{t("noOffersAnyHint")}</p>
              <Link
                href="/farmer/market/new?product=oil"
                className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-ap-btn font-bold text-white"
              >
                {t("listNow")}
              </Link>
            </div>
          ) : null}

          {!marketLoading && activeDeliveries.length > 0 ? (
            <>
              <SectionTitle>{t("activeDeliveriesTitle")}</SectionTitle>
          <p className="text-ap-small text-muted-foreground">
            {t("activeDeliveriesHint", { count: activeDeliveries.length })}
          </p>
          {(
            <div className="mt-2 space-y-2">
              {activeDeliveries.map((d) => (
                <ActiveDeliveryCard
                  key={d.id}
                  delivery={d}
                  steps={steps}
                  locale={locale}
                  youllGet={t("youllGet")}
                  inProgress={t("inProgress")}
                  unscheduled={t("unscheduledShort")}
                  nextHint={nextStepHint(d, t)}
                  pickupOn={t("pickupOn")}
                  tonsLabel={formatQuantity(d.product, d.tons, locale)}
                  labPending={t("labPending")}
                  labPendingHint={t("labPendingHint")}
                  labFailed={t("labFailedTitle")}
                  labFailedHint={t("labFailedHint")}
                  weighedLabel={(kg, delta) => t("weighedKg", { kg, delta })}
                  notPayable={t("notPayable")}
                />
              ))}
            </div>
          )}

            </>
          ) : null}

          {!marketLoading && incomingBids.length > 0 ? (
            <>
              <SectionTitle>{t("offersForField")}</SectionTitle>
          <p className="text-ap-small text-muted-foreground">{t("incomingBidsHint")}</p>
          {(
            groupOffersByLot(incomingBids, fieldCards).map((group) => (
              <div
                key={group.lotId}
                id={`lot-offers-${group.lotId}`}
                className="mt-2 scroll-mt-4 rounded-[18px] border border-line bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-ap-card text-ink">
                      {group.fieldName ?? group.lotVariety ?? "—"}
                    </p>
                    <p className="text-ap-small text-muted-foreground">
                      {formatQuantity(group.product, group.tons, locale)}
                      {group.askPrice != null
                        ? ` · ${t("asking", { price: formatEuroPerKg(group.askPrice, locale) })}`
                        : null}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-soft px-2.5 py-1 text-ap-small font-bold text-ink">
                    {t("bidsCount", { n: group.offers.length })}
                  </span>
                </div>
                {group.offers.map((offer) => {
                  const isBest = offer.id === group.bestId;
                  const delta =
                    group.askPrice != null ? offer.pricePerKg - group.askPrice : null;
                  return (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      busy={busyOfferId === offer.id}
                      locale={locale}
                      counter={t("counter")}
                      accept={t("accept")}
                      reject={t("reject")}
                      perKg={t("perKg")}
                      acceptClass="bg-good"
                      bestLabel={isBest ? t("bestBid") : null}
                      deltaLabel={
                        delta == null
                          ? null
                          : delta === 0
                            ? t("deltaZero")
                            : t(delta > 0 ? "deltaUp" : "deltaDown", {
                                price: formatEuroPerKg(Math.abs(delta), locale),
                              })
                      }
                      nested
                      onAccept={() => openAccept(offer)}
                      onCounter={() => openCounter(offer)}
                      onReject={() => void onRejectBid(offer)}
                    />
                  );
                })}
              </div>
            ))
          )}

            </>
          ) : null}

          {!marketLoading && sentOffers.length > 0 ? (
            <>
              <SectionTitle>{t("yourSentOffers")}</SectionTitle>
          <p className="text-ap-small text-muted-foreground">{t("sentOffersHint")}</p>
          {(
            sentOffers.map((offer) => (
              <SentOfferCard
                key={offer.id}
                offer={offer}
                locale={locale}
                perKg={t("perKg")}
                waiting={t("waitingMill")}
                withdraw={t("withdraw")}
                busy={busyOfferId === offer.id}
                onWithdraw={() => void onWithdraw(offer)}
              />
            ))
          )}
            </>
          ) : null}
        </div>
      ) : null}

      {tab === "sales" ? (
        <div className="mt-4">
          {marketLoading ? (
            <div className="h-20 animate-pulse rounded-[18px] bg-soft" />
          ) : (
            <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-line bg-card p-3">
              <div className="min-w-0">
                <p className="text-ap-body text-muted-foreground">{t("paidSeason")}</p>
                <p className="text-ap-title text-ink">{formatEuro(paidSeason, locale)}</p>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-ap-body text-muted-foreground">{t("onTheWay")}</p>
                <p className="text-ap-title text-good">{formatEuro(onTheWay, locale)}</p>
              </div>
            </div>
          )}

          <SectionTitle>{t("inProgress")}</SectionTitle>
          <p className="text-ap-small text-muted-foreground">
            {t("activeDeliveriesHint", { count: activeDeliveries.length })}
          </p>
          {!marketLoading && activeDeliveries.length === 0 ? (
            <div className="mt-2 rounded-[18px] border border-line bg-card p-4">
              <p className="text-center text-ap-body font-semibold text-muted-foreground">{t("nothingOnTheWay")}</p>
              <div className="mt-4 opacity-40">
                <StatusSteps steps={steps} current={-1} />
              </div>
            </div>
          ) : null}
          {activeDeliveries.length > 0 ? (
            <div className="mt-2 space-y-2">
              {activeDeliveries.map((d) => (
                <ActiveDeliveryCard
                  key={d.id}
                  delivery={d}
                  steps={steps}
                  locale={locale}
                  youllGet={t("youllGet")}
                  inProgress={t("inProgress")}
                  unscheduled={t("unscheduledShort")}
                  nextHint={nextStepHint(d, t)}
                  pickupOn={t("pickupOn")}
                  tonsLabel={formatQuantity(d.product, d.tons, locale)}
                  labPending={t("labPending")}
                  labPendingHint={t("labPendingHint")}
                  labFailed={t("labFailedTitle")}
                  labFailedHint={t("labFailedHint")}
                  weighedLabel={(kg, delta) => t("weighedKg", { kg, delta })}
                  notPayable={t("notPayable")}
                />
              ))}
            </div>
          ) : null}
          {closedDeliveries.length > 0 ? (
            <div className="mt-3 space-y-2">
              {closedDeliveries.map((d) => (
                <div key={d.id} className="rounded-[18px] border border-line bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-ap-card font-extrabold text-ink">{d.fieldName ?? "—"}</p>
                      <p className="text-ap-body text-muted-foreground">
                        {d.processorName ?? "—"} · {formatQuantity(d.product, d.tons, locale)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-risk-soft px-2.5 py-1 text-ap-small font-bold text-risk">
                      {d.labResult === "failed" ? t("closedLabFailed") : t("closedCancelled")}
                    </span>
                  </div>
                  <p className="mt-1 text-ap-small text-muted-foreground">
                    {d.labResult === "failed" ? t("closedLabFailedHint") : t("closedCancelledHint")}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex items-baseline justify-between">
            <h2 className="text-[17px] font-extrabold text-ink">{t("completed")}</h2>
          </div>
          {paidDeliveries.length === 0 ? (
            <div className="mt-2 rounded-[18px] border border-line bg-card px-4 py-8 text-center text-ap-body font-semibold text-muted-foreground">
              {t("noCompleted")}
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {paidDeliveries.map((d) => (
                <div key={d.id} className="rounded-[18px] border border-line bg-card p-3">
                  <p className="text-ap-card font-extrabold text-ink">{d.fieldName ?? "—"}</p>
                  <p className="text-ap-body text-muted-foreground">
                    {formatEuro(deliveryPayableAmount(d.tons, d.pricePerKg, d.actualKg), locale)} ·{" "}
                    {d.processorName ?? "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <BottomSheet
        open={acceptTarget != null}
        onClose={() => setAcceptTarget(null)}
        title={t("confirmSaleTitle")}
        actionLabel={t("confirmSale")}
        onAction={() => confirmAccept()}
      >
        {acceptTarget ? (
          <div className="space-y-3">
            <p className="text-ap-body text-muted-foreground">{acceptTarget.processorName}</p>
            <p className="text-ap-card font-extrabold text-ink">
              {formatQuantity(acceptTarget.product, acceptTarget.tons, locale)} × {formatEuroPerKg(acceptTarget.pricePerKg, locale)}
            </p>
            <p className="text-[22px] font-extrabold text-ink">
              {formatEuro(acceptTarget.tons * 1000 * acceptTarget.pricePerKg, locale)}
            </p>
            <DayChipPicker
              label={t("arriveOn")}
              days={weekDates}
              value={acceptDate}
              onChange={setAcceptDate}
              formatDay={(iso) =>
                new Date(`${iso}T12:00:00`).toLocaleDateString(locale, {
                  weekday: "short",
                  day: "numeric",
                })
              }
              todayLabel={t("todayShort")}
            />
            <p className="text-ap-small text-muted-foreground">{t("confirmSaleHint")}</p>
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={counterTarget != null}
        onClose={() => setCounterTarget(null)}
        title={t("counter")}
        actionLabel={t("sendCounter")}
        onAction={() => confirmCounter()}
      >
        {counterTarget ? (
          <div className="space-y-3">
            <p className="text-ap-body text-muted-foreground">
              {counterTarget.processorName} · {formatQuantity(counterTarget.product, counterTarget.tons, locale)}
            </p>
            <label className="block">
              <span className="text-ap-small font-bold text-muted-foreground">{t("yourPricePerKg")}</span>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  className="flex size-11 items-center justify-center rounded-full border border-line"
                  onClick={() => {
                    const n = parseLocaleNumber(counterPrice) ?? 0;
                    const next = Math.max(MARKET_LIMITS.pricePerKg.min, Math.round((n - 0.01) * 100) / 100);
                    setCounterPrice(next.toFixed(2).replace(".", ","));
                  }}
                >
                  −
                </button>
                <input
                  type="text"
                  inputMode="decimal"
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                  className="h-11 flex-1 rounded-xl border border-line bg-card px-3 text-center text-ap-card font-extrabold text-ink"
                />
                <button
                  type="button"
                  className="flex size-11 items-center justify-center rounded-full border border-line"
                  onClick={() => {
                    const n = parseLocaleNumber(counterPrice) ?? 0;
                    const next = Math.min(MARKET_LIMITS.pricePerKg.max, Math.round((n + 0.01) * 100) / 100);
                    setCounterPrice(next.toFixed(2).replace(".", ","));
                  }}
                >
                  +
                </button>
              </div>
            </label>
            {(() => {
              const pc = parseBounded(counterPrice, MARKET_LIMITS.pricePerKg);
              return counterPrice.trim() && !pc.ok ? (
                <p className="text-ap-small font-semibold text-risk" role="alert">
                  {boundsMsg(pc, "price", locale)}
                </p>
              ) : null;
            })()}
            {counterTotal != null ? (
              <p className="text-ap-body font-semibold text-ink">
                {t("counterTotal", {
                  tons: formatQuantity(counterTarget.product, counterTarget.tons, locale),
                  total: formatEuro(counterTotal, locale),
                })}
              </p>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={rejectTarget != null}
        onClose={() => setRejectTarget(null)}
        title={t("reject")}
        actionLabel={t("reject")}
        onAction={() => confirmRejectBid()}
      >
        {rejectTarget ? (
          <div className="space-y-2">
            <p className="text-ap-body text-muted-foreground">{rejectTarget.processorName}</p>
            <p className="text-ap-card font-extrabold text-ink">
              {formatQuantity(rejectTarget.product, rejectTarget.tons, locale)} × {formatEuroPerKg(rejectTarget.pricePerKg, locale)}
            </p>
            <p className="text-ap-small text-muted-foreground">{t("rejectBidConfirm")}</p>
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={withdrawTarget != null}
        onClose={() => setWithdrawTarget(null)}
        title={t("withdraw")}
        actionLabel={t("withdraw")}
        onAction={() => confirmWithdrawOffer()}
      >
        {withdrawTarget ? (
          <div className="space-y-2">
            <p className="text-ap-body text-muted-foreground">{withdrawTarget.processorName}</p>
            <p className="text-ap-card font-extrabold text-ink">
              {formatQuantity(withdrawTarget.product, withdrawTarget.tons, locale)} × {formatEuroPerKg(withdrawTarget.pricePerKg, locale)}
            </p>
            <p className="text-ap-small text-muted-foreground">{t("withdrawOfferConfirm")}</p>
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={listingTarget != null}
        onClose={() => {
          if (!listingBusy) setListingTarget(null);
        }}
        title={t("myListing")}
        footer={
          listingTarget ? (
            <div className="flex flex-col gap-2">
              <ApButton
                label={t("saveListing")}
                variant="dark"
                className="w-full"
                disabled={listingBusy}
                onClick={() => void confirmSaveListing()}
              />
              <ApButton
                label={t("withdrawListing")}
                variant="risk"
                className="w-full"
                disabled={listingBusy}
                onClick={() => void confirmWithdrawListing()}
              />
            </div>
          ) : null
        }
      >
        {listingTarget ? (
          <div className="space-y-3">
            <p className="text-ap-body font-semibold text-ink">{listingTarget.field.name}</p>
            <p className="text-ap-small text-muted-foreground">{t("withdrawListingConfirm")}</p>
            <label className="block">
              <span className="text-ap-small font-bold text-muted-foreground">{t("yourPrice")}</span>
              <input
                type="text"
                inputMode="decimal"
                value={listingPrice}
                onChange={(e) => setListingPrice(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-line bg-card px-3 text-ap-card font-extrabold text-ink"
              />
            </label>
            <label className="block">
              <span className="text-ap-small font-bold text-muted-foreground">
                {listingTarget && listingProduct(listingTarget.card) === "oil" ? t("quantityKg") : t("tons")}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={listingTons}
                onChange={(e) => setListingTons(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-line bg-card px-3 text-ap-card font-extrabold text-ink"
              />
            </label>
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mt-4 text-[17px] font-extrabold text-ink">{children}</h2>;
}

function ActiveDeliveryCard({
  delivery,
  steps,
  locale,
  youllGet,
  inProgress,
  unscheduled,
  nextHint,
  pickupOn,
  tonsLabel,
  labPending,
  labPendingHint,
  labFailed,
  labFailedHint,
  weighedLabel,
  notPayable,
}: {
  delivery: MarketDelivery;
  steps: string[];
  locale: string;
  youllGet: string;
  inProgress: string;
  unscheduled: string;
  nextHint: string;
  pickupOn: string;
  tonsLabel: string;
  labPending: string;
  labPendingHint: string;
  labFailed: string;
  labFailedHint: string;
  weighedLabel: (kg: string, delta: string) => string;
  notPayable: string;
}) {
  const when = formatDeliveryDay(delivery.scheduledFor, locale);
  const payableKg = deliveryPayableKg(delivery.tons, delivery.actualKg);
  const amount = deliveryPayableAmount(delivery.tons, delivery.pricePerKg, delivery.actualKg);
  const contractedKg = delivery.tons * 1000;
  const delta = delivery.actualKg != null ? delivery.actualKg - contractedKg : null;
  const meta = [
    when ? `${pickupOn} ${when}` : unscheduled,
    tonsLabel,
    delivery.lotVariety ? varietyLabel(delivery.lotVariety, locale) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const failed = delivery.labResult === "failed";
  const step = deliveryStepIndex(delivery.status as "scheduled" | "weighed" | "lab_checked" | "paid");
  const stepCaptions = [
    when,
    delivery.actualKg != null ? `${new Intl.NumberFormat(locale).format(payableKg)} kg` : null,
    delivery.labResult === "passed" ? "✓" : delivery.labResult === "failed" ? "✗" : null,
    delivery.status === "paid" ? formatEuro(amount, locale) : null,
  ];

  return (
    <div className={cn("rounded-[18px] border bg-card p-3", failed ? "border-risk" : "border-line")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ap-small font-bold text-ap-accent">{inProgress}</p>
          <p className="text-ap-card text-ink">{delivery.fieldName ?? "—"}</p>
          <p className="text-ap-body text-muted-foreground">{delivery.processorName ?? "—"}</p>
          <p className="mt-1 text-ap-small font-semibold text-ink">{meta}</p>
          {delivery.actualKg != null ? (
            <p className="mt-1 text-ap-small text-muted-foreground">
              {weighedLabel(
                new Intl.NumberFormat(locale).format(payableKg),
                delta == null
                  ? ""
                  : `(${delta >= 0 ? "+" : "−"}${new Intl.NumberFormat(locale).format(Math.abs(delta))} kg)`,
              ).trim()}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className={cn("text-[22px] font-extrabold", failed ? "text-muted-foreground line-through" : "text-ink")}>
            {formatEuro(amount, locale)}
          </p>
          <p className="text-ap-small text-muted-foreground">{failed ? notPayable : youllGet}</p>
        </div>
      </div>
      <div className="mt-3">
        <StatusSteps
          steps={steps}
          current={failed ? 2 : step < 0 ? 0 : step}
          failedAt={failed ? 2 : undefined}
          captions={stepCaptions}
        />
      </div>
      {failed ? null : <p className="mt-2 text-ap-small font-semibold text-muted-foreground">{nextHint}</p>}
      {failed ? (
        <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-risk/10 p-2.5">
          <FlaskConical className="size-5 shrink-0 text-risk" />
          <div>
            <p className="text-ap-body font-bold text-risk">{labFailed}</p>
            <p className="text-ap-small text-muted-foreground">{labFailedHint}</p>
          </div>
        </div>
      ) : delivery.status === "weighed" ? (
        <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-ap-accent-soft p-2.5">
          <FlaskConical className="size-5 shrink-0 text-ap-accent" />
          <div>
            <p className="text-ap-body font-bold text-ink">{labPending}</p>
            <p className="text-ap-small text-muted-foreground">{labPendingHint}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RequestCard({
  req,
  locale,
  fitField,
  fitScore,
  mismatch,
  offerLabel,
  canSellLabel,
  filledOf,
  onOffer,
}: {
  req: MarketRequest;
  locale: string;
  fitField: Field | undefined;
  fitScore: number | null;
  mismatch: string;
  offerLabel: string;
  canSellLabel: string;
  filledOf: string;
  onOffer: () => void;
}) {
  const t = useTranslations("farmerMarket");
  const initials = req.processorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const fits = req.product === "oil" ? req.tons - req.filledTons > 0 : fitField != null;

  return (
    <div className="rounded-[18px] border border-line bg-card p-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-soft text-ap-body font-extrabold text-ink">
          {initials || "Μ"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5">
            <ProductBadge product={req.product} label={t(productI18nKey(req.product))} />
          </div>
          <p className="truncate text-ap-card font-extrabold text-ink">{req.processorName}</p>
          <p className="text-ap-small text-muted-foreground">
            {varietyLabel(req.variety, locale)} · {formatQuantity(req.product, req.tons, locale)}
            {req.region ? ` · ${regionLabel(req.region, locale)}` : ""}
            {req.windowLabel
              ? ` · ${formatRequestWindow(req.windowLabel, locale) ?? req.windowLabel}`
              : ""}
          </p>
        </div>
        <p className="shrink-0 text-ap-small font-bold text-muted-foreground">
          {req.minScore}+
        </p>
      </div>
      <p className="mt-2 text-ap-small text-muted-foreground">{filledOf}</p>
      <div
        className={cn(
          "mt-2 flex items-center gap-2.5 rounded-xl p-2.5",
          fits ? "bg-good-soft" : "bg-risk-soft/60",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className={cn("text-ap-body font-bold", fits ? "text-good" : "text-risk")}>
            {fits ? `✓ ${canSellLabel}` : `✗ ${mismatch}`}
          </p>
          {fits && fitField ? (
            <p className="text-ap-small text-muted-foreground">
              {fitField.name}
              {fitScore != null ? ` (${fitScore})` : ""}
            </p>
          ) : (
            <p className="text-ap-small text-muted-foreground">
              {varietyLabel(req.variety, locale)} · {req.minScore}+
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onOffer}
          disabled={!fits}
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full bg-ink px-4 text-ap-btn font-bold text-white disabled:opacity-40"
        >
          {offerLabel}
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function OfferCard({
  offer,
  busy,
  locale,
  counter,
  accept,
  reject,
  perKg,
  acceptClass,
  bestLabel,
  deltaLabel,
  nested,
  onAccept,
  onCounter,
  onReject,
}: {
  offer: MarketOffer;
  busy: boolean;
  locale: string;
  counter: string;
  accept: string;
  reject: string;
  perKg: string;
  acceptClass: string;
  bestLabel?: string | null;
  deltaLabel?: string | null;
  nested?: boolean;
  onAccept: () => void;
  onCounter: () => void;
  onReject: () => void;
}) {
  return (
    <div
      className={cn(
        nested
          ? "mt-2 rounded-2xl border border-line/80 bg-soft/40 p-3"
          : "mt-2 rounded-[18px] border border-line bg-card p-3",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-soft text-ap-body font-extrabold text-ink">
          {offer.processorName.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-ap-card text-ink">{offer.processorName}</p>
            {bestLabel ? (
              <span className="rounded-md bg-good-soft px-1.5 py-0.5 text-[12px] font-bold text-good">
                {bestLabel}
              </span>
            ) : null}
          </div>
          <p className="text-ap-small text-muted-foreground">
            {offer.fieldName ?? offer.lotVariety ?? "—"} · {formatQuantity(offer.product, offer.tons, locale)}
          </p>
        </div>
        <p className="text-[22px] font-extrabold text-ink">
          {formatEuro(offer.pricePerKg, locale)}
          <span className="text-ap-small font-medium text-muted-foreground"> {perKg}</span>
        </p>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-ap-small text-muted-foreground">
        {deltaLabel ? <span>{deltaLabel}</span> : null}
        <span>≈ {formatEuro(offer.tons * 1000 * offer.pricePerKg, locale)}</span>
      </div>
      {busy ? (
        <p className="mt-2 text-ap-small font-semibold text-muted-foreground">…</p>
      ) : null}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          className="h-10 rounded-full border border-line bg-card px-2 text-[12px] font-bold text-muted-foreground disabled:opacity-50"
        >
          {busy ? "…" : reject}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCounter}
          className="h-10 rounded-full border border-ink bg-card px-2 text-[12px] font-bold text-ink disabled:opacity-50"
        >
          {busy ? "…" : counter}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className={cn("h-10 rounded-full px-2 text-[12px] font-bold text-white disabled:opacity-50", acceptClass)}
        >
          {busy ? "…" : accept}
        </button>
      </div>
    </div>
  );
}

/** Flow B outbound — waiting for the mill; farmer can withdraw a mistaken offer. */
function SentOfferCard({
  offer,
  locale,
  perKg,
  waiting,
  withdraw,
  busy,
  onWithdraw,
}: {
  offer: MarketOffer;
  locale: string;
  perKg: string;
  waiting: string;
  withdraw: string;
  busy: boolean;
  onWithdraw: () => void;
}) {
  return (
    <div className="mt-2 rounded-[18px] border border-line bg-card p-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-soft text-ap-body font-extrabold text-ink">
          {offer.processorName.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-ap-card text-ink">{offer.processorName}</p>
          <p className="text-ap-small text-muted-foreground">
            {offer.fieldName ?? offer.lotVariety ?? "—"} · {formatQuantity(offer.product, offer.tons, locale)}
          </p>
        </div>
        <p className="text-[22px] font-extrabold text-ink">
          {formatEuro(offer.pricePerKg, locale)}
          <span className="text-ap-small font-medium text-muted-foreground"> {perKg}</span>
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-ap-small font-semibold text-ap-accent">{waiting}</p>
        <button
          type="button"
          disabled={busy}
          onClick={onWithdraw}
          className="h-11 rounded-full border border-line px-3 text-ap-pill font-bold text-muted-foreground disabled:opacity-50"
        >
          {busy ? "…" : withdraw}
        </button>
      </div>
    </div>
  );
}
