"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
  Wallet,
} from "lucide-react";
import { StatusSteps } from "@/shared/components/brand";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { euroPrice, roundPrice } from "@/features/marketplace/pricing";
import {
  acceptOffer,
  counterOffer,
  useFarmerMarket,
  type MarketOffer,
} from "@/features/marketplace/use-farmer-market";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { FIELD_DOTS } from "@/shared/theme/tokens";
import { cn } from "@/shared/lib/utils";

type Tab = "overview" | "requests" | "offers" | "sales";
type FilterKey = "fits" | "near" | "variety" | "region";

const TABS: Tab[] = ["overview", "requests", "offers", "sales"];

const DELIVERY_STEP: Record<string, number> = {
  scheduled: 0,
  weighed: 1,
  lab_checked: 2,
  paid: 3,
};

function isTab(value: string | undefined): value is Tab {
  return !!value && (TABS as string[]).includes(value);
}

export function FarmerMarketScreen({ initialTab }: { initialTab?: string }) {
  const t = useTranslations("farmerMarket");
  const tFields = useTranslations("farmerFields");
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

  const steps = useMemo(
    () => [t("stepAgreed"), t("stepPicked"), t("stepWeighed"), t("stepLab"), t("stepPaid")],
    [t],
  );

  const openOffers = useMemo(
    () => offers.filter((o) => o.status === "pending" || o.status === "countered"),
    [offers],
  );
  const bestOffer = openOffers[0] ?? null;
  const activeDelivery = deliveries.find((d) => d.status !== "paid" && d.status !== "cancelled") ?? null;
  const paidDeliveries = deliveries.filter((d) => d.status === "paid");
  const paidSeason = paidDeliveries.reduce((sum, d) => sum + d.tons * 1000 * d.pricePerKg, 0);
  const onTheWay = deliveries
    .filter((d) => d.status !== "paid" && d.status !== "cancelled")
    .reduce((sum, d) => sum + d.tons * 1000 * d.pricePerKg, 0);

  const filterChips: { key: FilterKey; label: string }[] = [
    { key: "fits", label: t("fits") },
    { key: "near", label: t("near") },
    { key: "variety", label: t("ayvalik") },
    { key: "region", label: t("aydin") },
  ];

  async function onAccept(offer: MarketOffer) {
    setBusyOfferId(offer.id);
    toast.message(t("accepting"));
    try {
      const result = await acceptOffer(offer.id);
      if (!result.ok) {
        toast.error(result.error ?? t("actionFailed"));
        return;
      }
      toast.success(t("acceptedOkDetail"));
      setTab("sales");
      await reload();
    } finally {
      setBusyOfferId(null);
    }
  }

  async function onCounter(offer: MarketOffer) {
    const suggested = roundPrice(offer.pricePerKg + 0.05);
    const raw = window.prompt(t("counterPrompt"), String(suggested));
    if (raw == null) {
      toast.message(t("counterCancelled"));
      return;
    }
    const price = Number(raw.replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) {
      toast.error(t("invalidPrice"));
      return;
    }
    setBusyOfferId(offer.id);
    toast.message(t("countering"));
    try {
      const result = await counterOffer(offer, roundPrice(price));
      if (!result.ok) {
        toast.error(result.error ?? t("actionFailed"));
        return;
      }
      toast.success(t("counteredOkDetail"));
      await reload();
    } finally {
      setBusyOfferId(null);
    }
  }

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
              {id === "offers" && openOffers.length > 0 ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-risk px-1 text-[10px] leading-none font-bold text-white">
                  {openOffers.length}
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
              counter={t("counter")}
              accept={t("accept")}
              perKg={t("perKg")}
              acceptClass="bg-ink"
              onAccept={() => void onAccept(bestOffer)}
              onCounter={() => void onCounter(bestOffer)}
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
                    <p className="mt-2 text-ap-card text-ink">
                      {card?.listedPrice != null ? euroPrice(card.listedPrice) : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{t("perKg")}</p>
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
                <div key={req.id} className="rounded-[18px] border border-line bg-card p-3">
                  <p className="text-ap-card font-extrabold text-ink">{req.variety}</p>
                  <p className="text-ap-small text-muted-foreground">
                    {req.tons} t · {req.region ?? "—"}
                    {req.windowLabel ? ` · ${req.windowLabel}` : ""}
                  </p>
                </div>
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
                    "inline-flex h-[30px] shrink-0 items-center gap-1 rounded-full border px-3 text-ap-pill font-bold",
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
              className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-line bg-card"
            >
              <SlidersHorizontal className="size-3.5" />
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="rounded-[18px] border border-line bg-card px-4 py-10 text-center text-ap-body font-semibold text-muted-foreground">
              {t("noBuyerRequests")}
            </div>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="rounded-[18px] border border-line bg-card p-3">
                <p className="text-ap-card font-extrabold text-ink">{req.variety}</p>
                <p className="text-ap-body text-muted-foreground">
                  {req.tons} t · min score {req.minScore}
                  {req.region ? ` · ${req.region}` : ""}
                </p>
                <p className="mt-1 text-ap-small text-muted-foreground">
                  {t("filledOf", { filled: req.filledTons, total: req.tons })}
                </p>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "offers" ? (
        <div className="mt-4 space-y-3">
          {marketLoading ? (
            <div className="rounded-[18px] border border-line bg-card p-4 text-ap-small font-semibold text-muted-foreground">
              {t("loadingMarket")}
            </div>
          ) : null}
          <section className="rounded-[18px] border border-line bg-card p-3">
            {activeDelivery ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-[1px] text-ap-accent uppercase">{t("inProgress")}</p>
                    <p className="text-ap-card text-ink">{activeDelivery.fieldName ?? "—"}</p>
                    <p className="text-ap-body text-muted-foreground">{activeDelivery.processorName ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[22px] font-extrabold text-ink">
                      {euroPrice(activeDelivery.tons * 1000 * activeDelivery.pricePerKg)}
                    </p>
                    <p className="text-ap-small text-muted-foreground">{t("youllGet")}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <StatusSteps steps={steps} current={DELIVERY_STEP[activeDelivery.status] ?? 0} />
                </div>
                <p className="mt-2 text-ap-small font-semibold text-muted-foreground">{t("deliveryNextHint")}</p>
                {activeDelivery.status === "scheduled" || activeDelivery.status === "weighed" ? (
                  <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-ap-accent-soft p-2.5">
                    <FlaskConical className="size-5 shrink-0 text-ap-accent" />
                    <div>
                      <p className="text-ap-body font-bold text-ink">{t("labPending")}</p>
                      <p className="text-ap-small text-muted-foreground">{t("labPendingHint")}</p>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-ap-small font-semibold text-ink">{t("noActiveSalesTitle")}</p>
                <p className="mt-1 text-ap-small text-muted-foreground">{t("noActiveSales")}</p>
                <div className="mt-3 opacity-40">
                  <StatusSteps steps={steps} current={-1} />
                </div>
              </>
            )}
          </section>

          <SectionTitle>{t("offersForField")}</SectionTitle>
          {openOffers.length === 0 ? (
            <div className="mt-2 rounded-[18px] border border-line bg-card p-3">
              <p className="text-ap-small font-semibold text-ink">{t("noIncomingOffersTitle")}</p>
              <p className="mt-1 text-ap-small text-muted-foreground">{t("noIncomingOffers")}</p>
            </div>
          ) : (
            openOffers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                busy={busyOfferId === offer.id}
                counter={t("counter")}
                accept={t("accept")}
                perKg={t("perKg")}
                acceptClass="bg-good"
                onAccept={() => void onAccept(offer)}
                onCounter={() => void onCounter(offer)}
              />
            ))
          )}
        </div>
      ) : null}

      {tab === "sales" ? (
        <div className="mt-4">
          <div className="flex items-center rounded-[18px] border border-line bg-card p-3">
            <div className="min-w-0 flex-1">
              <p className="text-ap-body text-muted-foreground">{t("paidSeason")}</p>
              <p className="text-ap-title text-ink">{euroPrice(paidSeason)}</p>
            </div>
            <div className="mx-3 h-9 w-px bg-line" />
            <div className="min-w-0 flex-1">
              <p className="text-ap-body text-muted-foreground">{t("onTheWay")}</p>
              <p className="text-ap-title text-good">{euroPrice(onTheWay)}</p>
            </div>
            <button
              type="button"
              onClick={() => toast(t("walletSoon"))}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-ink px-3 text-ap-btn font-bold text-ink"
            >
              <Wallet className="size-4" />
              {t("wallet")}
            </button>
          </div>

          <SectionTitle>{t("inProgress")}</SectionTitle>
          {activeDelivery ? (
            <div className="mt-2 rounded-[18px] border border-line bg-card p-4">
              <p className="text-ap-card text-ink">{activeDelivery.fieldName ?? "—"}</p>
              <div className="mt-4">
                <StatusSteps steps={steps} current={DELIVERY_STEP[activeDelivery.status] ?? 0} />
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-[18px] border border-line bg-card p-4">
              <p className="text-center text-ap-body font-semibold text-muted-foreground">{t("nothingOnTheWay")}</p>
              <div className="mt-4 opacity-40">
                <StatusSteps steps={steps} current={-1} />
              </div>
            </div>
          )}

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
                    {euroPrice(d.tons * 1000 * d.pricePerKg)} · {d.processorName ?? "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mt-4 text-[17px] font-extrabold text-ink">{children}</h2>;
}

function OfferCard({
  offer,
  busy,
  counter,
  accept,
  perKg,
  acceptClass,
  onAccept,
  onCounter,
}: {
  offer: MarketOffer;
  busy: boolean;
  counter: string;
  accept: string;
  perKg: string;
  acceptClass: string;
  onAccept: () => void;
  onCounter: () => void;
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
            {offer.fieldName ?? offer.lotVariety ?? "—"} · {offer.tons} t
          </p>
        </div>
        <p className="text-[22px] font-extrabold text-ink">
          {euroPrice(offer.pricePerKg)}
          <span className="text-ap-small font-medium text-muted-foreground"> {perKg}</span>
        </p>
      </div>
      {busy ? (
        <p className="mt-2 text-ap-small font-semibold text-muted-foreground">…</p>
      ) : null}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          disabled={busy || offer.status === "countered"}
          onClick={onCounter}
          className="h-9 rounded-full border border-ink bg-card px-4 text-ap-pill font-bold text-ink disabled:opacity-50"
        >
          {busy ? "…" : counter}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className={cn("h-9 rounded-full px-4 text-ap-pill font-bold text-white disabled:opacity-50", acceptClass)}
        >
          {busy ? "…" : accept}
        </button>
      </div>
    </div>
  );
}
