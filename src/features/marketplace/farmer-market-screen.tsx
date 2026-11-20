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
import { varietyLabel } from "@/features/fields/olive-varieties";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import {
  deliveryPayableAmount,
  deliveryPayableKg,
  deliveryStepIndex,
} from "@/features/marketplace/delivery-state";
import { BottomSheet } from "@/features/marketplace/processor-kit";
import { formatEuro, formatEuroPerKg, formatTons } from "@/features/marketplace/pricing";
import { regionLabel } from "@/features/marketplace/regions";
import {
  acceptOffer,
  counterOffer,
  rejectIncomingBid,
  useFarmerMarket,
  withdrawOffer,
  type FieldMarketCard,
  type MarketDelivery,
  type MarketOffer,
  type MarketRequest,
} from "@/features/marketplace/use-farmer-market";
import { Link, useRouter } from "@/shared/i18n/navigation";
import type { Field } from "@/shared/types/database";
import { FIELD_DOTS } from "@/shared/theme/tokens";
import { cn } from "@/shared/lib/utils";

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

function requestFitsField(
  req: MarketRequest,
  field: Field,
  fieldCards: Record<string, FieldMarketCard>,
): boolean {
  const v = fieldVariety(field)?.toLowerCase();
  if (v && req.variety && v !== req.variety.toLowerCase()) return false;
  const score = fieldCards[field.id]?.qualityScore;
  if (score != null && score < req.minScore) return false;
  const remaining = req.tons - req.filledTons;
  if (remaining <= 0) return false;
  return true;
}

function bestFieldForRequest(
  fields: Field[],
  fieldCards: Record<string, FieldMarketCard>,
  req: MarketRequest,
): Field | undefined {
  const fitting = fields.filter((f) => requestFitsField(req, f, fieldCards));
  if (!fitting.length) return undefined;
  return fitting.reduce((best, f) => {
    const bestScore = fieldCards[best.id]?.qualityScore ?? -1;
    const score = fieldCards[f.id]?.qualityScore ?? -1;
    return score > bestScore ? f : best;
  });
}

function requestMismatchReason(
  req: MarketRequest,
  fields: Field[],
  fieldCards: Record<string, FieldMarketCard>,
  locale: string,
  t: ReturnType<typeof useTranslations<"farmerMarket">>,
): string {
  if (!fields.length) return t("needFieldFirst");
  const remaining = req.tons - req.filledTons;
  if (remaining <= 0) return t("requestFilled");
  const hasVariety = fields.some((f) => {
    const v = fieldVariety(f)?.toLowerCase();
    return v && v === req.variety.toLowerCase();
  });
  if (!hasVariety) {
    return t("needVariety", { variety: varietyLabel(req.variety, locale) });
  }
  const scoreOk = fields.some((f) => {
    const v = fieldVariety(f)?.toLowerCase();
    if (!v || v !== req.variety.toLowerCase()) return false;
    return (fieldCards[f.id]?.qualityScore ?? 0) >= req.minScore;
  });
  if (!scoreOk) return t("needScore", { score: req.minScore });
  return t("cannotSellHere");
}

export function FarmerMarketScreen({ initialTab }: { initialTab?: string }) {
  const t = useTranslations("farmerMarket");
  const tFields = useTranslations("farmerFields");
  const locale = useLocale();
  const router = useRouter();
  const { fields, loading, error } = useFarmerFields();
  const fieldIds = useMemo(() => fields.map((f) => f.id), [fields]);
  const {
    offers,
    requests,
    deliveries,
    fieldCards,
    loading: marketLoading,
    reload,
  } = useFarmerMarket(fieldIds);
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : "overview");
  const [filters, setFilters] = useState<FilterKey[]>(["fits"]);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<MarketOffer | null>(null);
  const [counterTarget, setCounterTarget] = useState<MarketOffer | null>(null);
  const [counterPrice, setCounterPrice] = useState("");

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
  const onTheWay = activeDeliveries.reduce(
    (sum, d) => sum + deliveryPayableAmount(d.tons, d.pricePerKg, d.actualKg),
    0,
  );

  const regionChips = useMemo(() => {
    const set = new Set<string>();
    for (const r of requests) {
      if (r.region?.trim()) set.add(r.region.trim());
    }
    return [...set].slice(0, 6);
  }, [requests]);

  const filterChips: { key: FilterKey; label: string }[] = [
    { key: "fits", label: t("fits") },
    { key: "near", label: t("near") },
    ...regionChips.map((r) => ({ key: `region:${r}`, label: regionLabel(r, locale) })),
  ];

  const filteredRequests = useMemo(() => {
    let list = [...requests];
    if (filters.includes("fits")) {
      list = list.filter((req) => bestFieldForRequest(fields, fieldCards, req) != null);
    }
    const regionFilters = filters
      .filter((f) => f.startsWith("region:"))
      .map((f) => f.slice("region:".length).toLowerCase());
    if (regionFilters.length) {
      list = list.filter((req) =>
        regionFilters.some((r) => (req.region ?? "").toLowerCase().includes(r)),
      );
    }
    if (filters.includes("near") && fields.some((f) => f.lat != null && f.lon != null)) {
      // Prefer requests whose region matches any field's known area label when present.
      // Without geocoded field regions, keep list but put variety-matching first.
      list = [...list].sort((a, b) => {
        const aFit = bestFieldForRequest(fields, fieldCards, a) ? 0 : 1;
        const bFit = bestFieldForRequest(fields, fieldCards, b) ? 0 : 1;
        return aFit - bFit;
      });
    }
    return list;
  }, [requests, filters, fields, fieldCards]);

  async function confirmAccept() {
    const offer = acceptTarget;
    if (!offer || offer.initiatedBy !== "processor") return;
    setBusyOfferId(offer.id);
    const toastId = toast.loading(t("accepting"));
    try {
      const result = await acceptOffer(offer.id);
      if (!result.ok) {
        toast.error(result.error ?? t("actionFailed"), { id: toastId });
        return;
      }
      toast.success(t("acceptedOkDetail"), { id: toastId });
      setAcceptTarget(null);
      setTab("sales");
      await reload();
    } finally {
      setBusyOfferId(null);
    }
  }

  async function onRejectBid(offer: MarketOffer) {
    if (offer.initiatedBy !== "processor") return;
    if (!window.confirm(t("rejectBidConfirm"))) return;
    setBusyOfferId(offer.id);
    try {
      const result = await rejectIncomingBid(offer.id);
      if (!result.ok) {
        toast.error(result.error ?? t("actionFailed"));
        return;
      }
      toast.success(t("rejectedBidOk"));
      await reload();
    } finally {
      setBusyOfferId(null);
    }
  }

  async function onWithdraw(offer: MarketOffer) {
    if (offer.initiatedBy !== "farmer") return;
    if (!window.confirm(t("withdrawOfferConfirm"))) return;
    setBusyOfferId(offer.id);
    try {
      const result = await withdrawOffer(offer.id);
      if (!result.ok) {
        toast.error(result.error ?? t("actionFailed"));
        return;
      }
      toast.success(t("withdrawnOk"));
      await reload();
    } finally {
      setBusyOfferId(null);
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
    const price = Number(counterPrice.replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) {
      toast.error(t("invalidPrice"));
      return;
    }
    setBusyOfferId(offer.id);
    const toastId = toast.loading(t("countering"));
    try {
      // Use the exact price the farmer typed — no silent 0.05 rounding.
      const result = await counterOffer(offer, Math.round(price * 100) / 100);
      if (!result.ok) {
        toast.error(result.error ?? t("actionFailed"), { id: toastId });
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
          const price = Number(counterPrice.replace(",", "."));
          if (!Number.isFinite(price) || price <= 0) return null;
          return counterTarget.tons * 1000 * price;
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
          className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
        >
          <Search className="size-[18px]" />
        </button>
      </div>

      <div
        role="tablist"
        className="mt-3 flex h-10 gap-1 overflow-x-auto rounded-full bg-soft p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((id) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(id)}
              className={cn(
                "relative flex min-w-[72px] flex-1 items-center justify-center gap-1 rounded-full px-2 text-ap-pill font-bold whitespace-nowrap",
                on ? "bg-ink text-white" : "text-muted-foreground",
              )}
            >
              {t(id)}
              {id === "offers" && incomingBids.length > 0 ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-risk px-1 text-[10px] leading-none font-bold text-white">
                  {incomingBids.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "overview" ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => router.push("/farmer/market/new")}
            className="flex h-14 w-full items-center gap-3 rounded-[18px] bg-ink px-3 text-left text-white"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-white/15">
              <Plus className="size-5" />
            </span>
            <span className="flex-1 text-ap-card font-extrabold">{t("sellOlives")}</span>
            <span className="flex size-8 items-center justify-center rounded-full bg-white text-ink">
              <ArrowRight className="size-4" />
            </span>
          </button>

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
              onAccept={() => setAcceptTarget(bestOffer)}
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
                const soldOut = card?.lotStatus === "sold" || card?.lotStatus === "reserved";
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
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-soft text-ap-small font-extrabold text-muted-foreground">
                        {card?.qualityScore ?? "—"}
                      </span>
                    </div>
                    {soldOut ? (
                      <p className="mt-2 text-ap-small font-bold text-ap-accent">
                        {card?.lotStatus === "sold" ? t("fieldSold") : t("fieldInDelivery")}
                      </p>
                    ) : (
                      <>
                        <p className="mt-2 text-ap-card text-ink">
                          {card?.listedPrice != null ? formatEuroPerKg(card.listedPrice, locale) : "—"}
                        </p>
                        {card && card.offerCount > 0 ? (
                          <p className="mt-1 text-ap-small font-semibold text-good">
                            {t("offersCount", { n: card.offerCount })}
                          </p>
                        ) : null}
                        <Link
                          href={`/farmer/market/new?field=${field.id}`}
                          className="mt-1 inline-flex h-6 items-center text-ap-body font-bold text-ink"
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
                  fitField={bestFieldForRequest(fields, fieldCards, req)}
                  fitScore={
                    (() => {
                      const f = bestFieldForRequest(fields, fieldCards, req);
                      return f ? fieldCards[f.id]?.qualityScore ?? null : null;
                    })()
                  }
                  mismatch={requestMismatchReason(req, fields, fieldCards, locale, t)}
                  offerLabel={t("offer")}
                  canSellLabel={t("canSellHere")}
                  filledOf={t("filledOf", {
                    filled: formatTons(req.filledTons, locale).replace(" t", ""),
                    total: formatTons(req.tons, locale).replace(" t", ""),
                  })}
                  onOffer={() => {
                    const field = bestFieldForRequest(fields, fieldCards, req);
                    if (!field) {
                      toast.message(requestMismatchReason(req, fields, fieldCards, locale, t));
                      return;
                    }
                    const qs = new URLSearchParams();
                    qs.set("field", field.id);
                    qs.set("factory", req.processorId);
                    qs.set("request", req.id);
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
                <button
                  key={chip.key}
                  type="button"
                  onClick={() =>
                    setFilters((prev) => (on ? prev.filter((k) => k !== chip.key) : [...prev, chip.key]))
                  }
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center gap-1 rounded-full border px-3 text-ap-pill font-bold",
                    on ? "border-good bg-good-soft text-good" : "border-line bg-card text-ink",
                  )}
                >
                  {on ? <Check className="size-3" strokeWidth={3} /> : null}
                  {chip.label}
                </button>
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
                fitField={bestFieldForRequest(fields, fieldCards, req)}
                fitScore={
                  (() => {
                    const f = bestFieldForRequest(fields, fieldCards, req);
                    return f ? fieldCards[f.id]?.qualityScore ?? null : null;
                  })()
                }
                mismatch={requestMismatchReason(req, fields, fieldCards, locale, t)}
                offerLabel={t("offer")}
                canSellLabel={t("canSellHere")}
                filledOf={t("filledOf", {
                  filled: formatTons(req.filledTons, locale).replace(" t", ""),
                  total: formatTons(req.tons, locale).replace(" t", ""),
                })}
                onOffer={() => {
                  const field = bestFieldForRequest(fields, fieldCards, req);
                  if (!field) {
                    toast.message(requestMismatchReason(req, fields, fieldCards, locale, t));
                    return;
                  }
                  const qs = new URLSearchParams();
                  qs.set("field", field.id);
                  qs.set("factory", req.processorId);
                  qs.set("request", req.id);
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
          ) : null}

          <SectionTitle>{t("activeDeliveriesTitle")}</SectionTitle>
          <p className="text-ap-small text-muted-foreground">
            {t("activeDeliveriesHint", { count: activeDeliveries.length })}
          </p>
          {activeDeliveries.length === 0 ? (
            <div className="mt-2 rounded-[18px] border border-line bg-card p-3">
              <p className="text-ap-small font-semibold text-ink">{t("noActiveSalesTitle")}</p>
              <p className="mt-1 text-ap-small text-muted-foreground">{t("noActiveSales")}</p>
              <div className="mt-3 opacity-40">
                <StatusSteps steps={steps} current={-1} />
              </div>
            </div>
          ) : (
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
                  tonsLabel={formatTons(d.tons, locale)}
                  labPending={t("labPending")}
                  labPendingHint={t("labPendingHint")}
                  labFailed={t("labFailedTitle")}
                  labFailedHint={t("labFailedHint")}
                  weighedLabel={t("weighedKg")}
                />
              ))}
            </div>
          )}

          <SectionTitle>{t("offersForField")}</SectionTitle>
          <p className="text-ap-small text-muted-foreground">{t("incomingBidsHint")}</p>
          {incomingBids.length === 0 ? (
            <div className="mt-2 rounded-[18px] border border-line bg-card p-3">
              <p className="text-ap-small font-semibold text-ink">{t("noIncomingOffersTitle")}</p>
              <p className="mt-1 text-ap-small text-muted-foreground">{t("noIncomingOffers")}</p>
            </div>
          ) : (
            groupOffersByLot(incomingBids, fieldCards).map((group) => (
              <div key={group.lotId} className="mt-2 rounded-[18px] border border-line bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-ap-card text-ink">
                      {group.fieldName ?? group.lotVariety ?? "—"}
                    </p>
                    <p className="text-ap-small text-muted-foreground">
                      {formatTons(group.tons, locale)}
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
                      onAccept={() => setAcceptTarget(offer)}
                      onCounter={() => openCounter(offer)}
                      onReject={() => void onRejectBid(offer)}
                    />
                  );
                })}
              </div>
            ))
          )}

          <SectionTitle>{t("yourSentOffers")}</SectionTitle>
          <p className="text-ap-small text-muted-foreground">{t("sentOffersHint")}</p>
          {sentOffers.length === 0 ? (
            <div className="mt-2 rounded-[18px] border border-line bg-card p-3">
              <p className="text-ap-small font-semibold text-ink">{t("noSentOffersTitle")}</p>
              <p className="mt-1 text-ap-small text-muted-foreground">{t("noSentOffers")}</p>
            </div>
          ) : (
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
                  tonsLabel={formatTons(d.tons, locale)}
                  labPending={t("labPending")}
                  labPendingHint={t("labPendingHint")}
                  labFailed={t("labFailedTitle")}
                  labFailedHint={t("labFailedHint")}
                  weighedLabel={t("weighedKg")}
                />
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
        onAction={() => void confirmAccept()}
      >
        {acceptTarget ? (
          <div className="space-y-2">
            <p className="text-ap-body text-muted-foreground">{acceptTarget.processorName}</p>
            <p className="text-ap-card font-extrabold text-ink">
              {formatTons(acceptTarget.tons, locale)} × {formatEuroPerKg(acceptTarget.pricePerKg, locale)}
            </p>
            <p className="text-[22px] font-extrabold text-ink">
              {formatEuro(acceptTarget.tons * 1000 * acceptTarget.pricePerKg, locale)}
            </p>
            <p className="text-ap-small text-muted-foreground">{t("confirmSaleHint")}</p>
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={counterTarget != null}
        onClose={() => setCounterTarget(null)}
        title={t("counter")}
        actionLabel={t("sendCounter")}
        onAction={() => void confirmCounter()}
      >
        {counterTarget ? (
          <div className="space-y-3">
            <p className="text-ap-body text-muted-foreground">
              {counterTarget.processorName} · {formatTons(counterTarget.tons, locale)}
            </p>
            <label className="block">
              <span className="text-ap-small font-bold text-muted-foreground">{t("yourPricePerKg")}</span>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  className="flex size-11 items-center justify-center rounded-full border border-line"
                  onClick={() => {
                    const n = Number(counterPrice.replace(",", ".")) || 0;
                    setCounterPrice(Math.max(0.01, Math.round((n - 0.01) * 100) / 100).toFixed(2).replace(".", ","));
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
                    const n = Number(counterPrice.replace(",", ".")) || 0;
                    setCounterPrice((Math.round((n + 0.01) * 100) / 100).toFixed(2).replace(".", ","));
                  }}
                >
                  +
                </button>
              </div>
            </label>
            {counterTotal != null ? (
              <p className="text-ap-body font-semibold text-ink">
                {t("counterTotal", {
                  tons: formatTons(counterTarget.tons, locale),
                  total: formatEuro(counterTotal, locale),
                })}
              </p>
            ) : null}
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
  weighedLabel: string;
}) {
  const when = formatDeliveryDay(delivery.scheduledFor, locale);
  const payableKg = deliveryPayableKg(delivery.tons, delivery.actualKg);
  const amount = deliveryPayableAmount(delivery.tons, delivery.pricePerKg, delivery.actualKg);
  const contractedKg = delivery.tons * 1000;
  const delta = delivery.actualKg != null ? delivery.actualKg - contractedKg : null;
  const meta = [when ? `${pickupOn} ${when}` : unscheduled, tonsLabel, delivery.lotVariety]
    .filter(Boolean)
    .join(" · ");
  const failed = delivery.labResult === "failed";
  const step = deliveryStepIndex(delivery.status as "scheduled" | "weighed" | "lab_checked" | "paid");

  return (
    <div className={cn("rounded-[18px] border bg-card p-3", failed ? "border-risk" : "border-line")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[1px] text-ap-accent uppercase">{inProgress}</p>
          <p className="text-ap-card text-ink">{delivery.fieldName ?? "—"}</p>
          <p className="text-ap-body text-muted-foreground">{delivery.processorName ?? "—"}</p>
          <p className="mt-1 text-ap-small font-semibold text-ink">{meta}</p>
          {delivery.actualKg != null ? (
            <p className="mt-1 text-ap-small text-muted-foreground">
              {weighedLabel
                .replace("{kg}", new Intl.NumberFormat(locale).format(payableKg))
                .replace(
                  "{delta}",
                  delta == null
                    ? ""
                    : `(${delta >= 0 ? "+" : ""}${new Intl.NumberFormat(locale).format(delta)} kg)`,
                )}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-[22px] font-extrabold text-ink">{formatEuro(amount, locale)}</p>
          <p className="text-ap-small text-muted-foreground">{youllGet}</p>
        </div>
      </div>
      <div className="mt-3">
        <StatusSteps steps={steps} current={step < 0 ? 0 : step} />
      </div>
      <p className="mt-2 text-ap-small font-semibold text-muted-foreground">{nextHint}</p>
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
  const initials = req.processorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const fits = fitField != null;

  return (
    <div className="rounded-[18px] border border-line bg-card p-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-soft text-ap-body font-extrabold text-ink">
          {initials || "Μ"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-ap-card font-extrabold text-ink">{req.processorName}</p>
          <p className="text-ap-small text-muted-foreground">
            {varietyLabel(req.variety, locale)} · {formatTons(req.tons, locale)}
            {req.region ? ` · ${regionLabel(req.region, locale)}` : ""}
            {req.windowLabel ? ` · ${req.windowLabel}` : ""}
          </p>
        </div>
        <p className="shrink-0 text-ap-small font-bold text-muted-foreground">{req.minScore}+</p>
      </div>
      <p className="mt-2 text-ap-small text-muted-foreground">{filledOf}</p>
      <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-soft p-2.5">
        <div className="min-w-0 flex-1">
          <p className={cn("text-ap-body font-bold", fits ? "text-ink" : "text-risk")}>
            {fits ? canSellLabel : mismatch}
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
              <span className="rounded-md bg-good-soft px-1.5 py-0.5 text-[11px] font-bold text-good">
                {bestLabel}
              </span>
            ) : null}
          </div>
          <p className="text-ap-small text-muted-foreground">
            {offer.fieldName ?? offer.lotVariety ?? "—"} · {formatTons(offer.tons, locale)}
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
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          className="h-11 rounded-full border border-line bg-card px-4 text-ap-pill font-bold text-muted-foreground disabled:opacity-50"
        >
          {busy ? "…" : reject}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCounter}
          className="h-11 rounded-full border border-ink bg-card px-4 text-ap-pill font-bold text-ink disabled:opacity-50"
        >
          {busy ? "…" : counter}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className={cn("h-11 rounded-full px-4 text-ap-pill font-bold text-white disabled:opacity-50", acceptClass)}
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
            {offer.fieldName ?? offer.lotVariety ?? "—"} · {formatTons(offer.tons, locale)}
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
