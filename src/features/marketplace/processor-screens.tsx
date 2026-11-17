"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  Download,
  Euro,
  FlaskConical,
  Gauge,
  Inbox,
  Leaf,
  MapPin,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  Truck,
  Wheat,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { publicEnv } from "@/core/config/env";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Pill } from "@/shared/components/brand/pill";
import { Chip } from "@/shared/components/brand/chip";
import { StatusSteps } from "@/shared/components/brand/status-steps";
import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { euroPrice, euroTotal, saleTotal } from "@/features/marketplace/pricing";
import { trustBadges } from "@/features/marketplace/badges";
import { canAdvanceDelivery, deliveryStepIndex, nextDeliveryStatus } from "@/features/marketplace/delivery-state";
import { reverseGeocodePlace } from "@/features/fields/reverse-geocode";
import { defaultVarietySlug, marketplaceVarietyOptions, resolveOliveCountry } from "@/features/fields/olive-varieties";
import { LotsMap } from "./lots-map";
import {
  Amount,
  ChipGroup,
  Dialog,
  Initials,
  initialsOf,
  LotBadges,
  LotRow,
  PageHeader,
  Panel,
  ScoreBox,
  Segmented,
  StatCard,
  TextField,
  type LotBadge,
} from "./processor-kit";
import {
  acceptIncomingOffer,
  advanceDelivery,
  counterIncomingOffer,
  createBuyRequest,
  harvestRangeLabel,
  lotPlaceLabel,
  placeLotOffer,
  useProcessorMarket,
  type ProcessorLot,
  type ProcessorOffer,
} from "./use-processor-market";

const PROVINCES = ["Aydın", "Balıkesir", "Crete", "İzmir", "Messinia", "Peloponnese", "Laconia"];
const WINDOW_KEYS = ["window1", "window2", "window3", "window4"] as const;
const SCORE_OPTIONS = ["70", "75", "80", "85"];
const DEMO_EXCHANGE = 0.8;

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
    out.unshift({ id: "banned", label: t("noBannedProducts") });
  }
  return out;
}

function useVarietyLabel() {
  const locale = useLocale();
  const options = useMemo(() => marketplaceVarietyOptions(locale), [locale]);
  return (slug: string) => options.find((o) => o.value === slug)?.label ?? slug;
}

/** Resolve "Town, Province" from lot lat/lon (same Mapbox path as farmer home). */
function useLotPlaceLabels(lots: ProcessorLot[]) {
  const locale = useLocale();
  const [labels, setLabels] = useState<Record<string, string>>({});
  const lotsRef = useRef(lots);
  lotsRef.current = lots;

  // Stable string key — do not depend on array identity (e.g. `lot ? [lot] : []`).
  const key = lots
    .filter((l) => l.lat != null && l.lon != null)
    .map((l) => `${l.id}:${l.lat},${l.lon}:${l.town ?? ""}:${l.region}`)
    .sort()
    .join("|");

  useEffect(() => {
    if (!key) {
      setLabels((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        lotsRef.current.map(async (lot) => {
          if (lot.lat == null || lot.lon == null) return;
          if (lot.town) {
            next[lot.id] = `${lot.town}${lot.region ? `, ${lot.region}` : ""}`;
            return;
          }
          const place = await reverseGeocodePlace(lot.lat, lot.lon, locale);
          if (place) next[lot.id] = place;
        }),
      );
      if (!cancelled) setLabels(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, locale]);

  return labels;
}

export function ProcessorOverviewScreen() {
  const t = useTranslations("processor");
  const tNav = useTranslations("processorNav");
  const varietyLabel = useVarietyLabel();
  const { lots, offers, requests, deliveries, supply, loading, error, reload } = useProcessorMarket();

  const openRequests = requests.filter((r) => r.active && r.filledTons < r.tons);
  const incoming = offers.filter((o) => o.initiatedBy === "farmer" && (o.status === "pending" || o.status === "countered"));
  const outgoing = offers.filter((o) => o.initiatedBy === "processor" && (o.status === "pending" || o.status === "countered"));
  const deliveriesWeek = deliveries.filter((d) => d.status !== "paid" && d.status !== "cancelled");
  const scoredIncoming = incoming.filter((o) => o.lot?.qualityScore != null);
  const avgIncoming =
    scoredIncoming.length === 0
      ? null
      : Math.round(scoredIncoming.reduce((sum, o) => sum + (o.lot!.qualityScore ?? 0), 0) / scoredIncoming.length);
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null);

  const onAccept = async (offer: ProcessorOffer) => {
    setBusyOfferId(offer.id);
    toast.message(t("accepting"));
    try {
      const res = await acceptIncomingOffer(offer.id);
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"));
        return;
      }
      toast.success(t("acceptedDetail"));
      await reload();
    } finally {
      setBusyOfferId(null);
    }
  };

  const onCounter = async (offer: ProcessorOffer) => {
    const suggested = Math.max(0.05, Math.round((offer.pricePerKg - 0.05) * 100) / 100);
    const raw = window.prompt(t("counterPrompt"), String(suggested));
    if (raw == null) {
      toast.message(t("counterCancelled"));
      return;
    }
    const next = Number(raw.replace(",", "."));
    if (!Number.isFinite(next) || next <= 0) {
      toast.error(t("invalidPrice"));
      return;
    }
    setBusyOfferId(offer.id);
    toast.message(t("countering"));
    try {
      const res = await counterIncomingOffer(offer, next);
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"));
        return;
      }
      toast.success(t("counterSentDetail"));
      await reload();
    } finally {
      setBusyOfferId(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("overviewTitle")}
        subtitle={t("overviewSubtitle")}
        action={
          <Link href="/processor/lots">
            <ApButton label={tNav("findOlives")} variant="dark" icon={<Search className="size-4" />} />
          </Link>
        }
      />

      {error === "needSupabase" || error === "needLogin" ? (
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">{t(error)}</ApCard>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <StatCard
          href="/processor/requests"
          label={t("openRequests")}
          value={loading ? "…" : String(openRequests.length)}
          hint={t("waitingFarmers")}
          icon={<ClipboardList className="size-[18px]" />}
        />
        <StatCard
          href="#incoming-offers"
          label={t("incomingOffers")}
          value={loading ? "…" : String(incoming.length)}
          hint={t("waitingAnswer")}
          icon={<Inbox className="size-[18px]" />}
        />
        <StatCard
          href="/processor/deliveries"
          label={t("deliveriesWeek")}
          value={loading ? "…" : String(deliveriesWeek.length)}
          hint={t("notPaidYet")}
          icon={<Truck className="size-[18px]" />}
        />
        <StatCard
          href="/processor/lots"
          label={t("avgQualityScore")}
          value={avgIncoming == null || Number.isNaN(avgIncoming) ? "–" : String(avgIncoming)}
          hint={t("ofIncoming")}
          icon={<Gauge className="size-[18px]" />}
        />
      </div>

      {loading ? (
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">{t("loading")}</ApCard>
      ) : null}

      {deliveriesWeek.length > 0 ? (
        <Panel
          title={t("activeDealsTitle")}
          subtitle={t("activeDealsHint")}
          right={
            <Link href="/processor/deliveries">
              <ApButton label={t("goToDeliveries")} variant="dark" icon={<Truck className="size-4" />} />
            </Link>
          }
        >
          {deliveriesWeek.slice(0, 3).map((d, i) => (
            <div key={d.id} className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-3", i > 0 && "border-t border-line")}>
              <div>
                <p className="text-[15px] font-extrabold text-ink">{d.farmerName ?? d.lotRegion ?? t("anonymousGrove")}</p>
                <p className="text-[12px] font-medium text-muted-foreground">
                  {[d.lotVariety ? varietyLabel(d.lotVariety) : null, `${d.tons} t`, t(`step.${d.status}` as "step.scheduled")]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <p className="text-[15px] font-extrabold text-ink">{euroTotal(saleTotal(d.tons, d.pricePerKg))}</p>
            </div>
          ))}
        </Panel>
      ) : null}

      <Panel
        title={t("outgoingOffers")}
        subtitle={t("outgoingHint")}
      >
        {outgoing.length === 0 ? (
          <div className="border-t border-line px-4 py-6 text-center text-[13px] font-semibold text-muted-foreground">
            {loading ? t("loading") : t("noOutgoingOffers")}
          </div>
        ) : (
          outgoing.map((offer, i) => {
            const lot = offer.lot;
            const place = lot ? lotPlaceLabel(lot, t("anonymousGrove")) : t("anonymousGrove");
            return (
              <div key={offer.id} className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-3", i > 0 ? "border-t border-line" : "border-t border-line")}>
                <div>
                  <p className="text-[15px] font-extrabold text-ink">{place}</p>
                  <p className="text-[12px] font-medium text-muted-foreground">
                    {t("waitingFarmerAnswer", {
                      price: euroPrice(offer.pricePerKg),
                      tons: offer.tons,
                    })}
                  </p>
                </div>
                <Pill tone="warn">{t("pendingStatus")}</Pill>
              </div>
            );
          })
        )}
      </Panel>

      <div id="incoming-offers" className="scroll-mt-4">
      <Panel
        title={t("incomingOffers")}
        subtitle={t("incomingHint")}
        right={<Pill tone="neutral">{t("demoPrice", { price: euroPrice(DEMO_EXCHANGE) })}</Pill>}
      >
        {incoming.length === 0 ? (
          <div className="border-t border-line px-4 py-8 text-center text-[13px] font-semibold text-muted-foreground">
            {loading ? t("loading") : t("noOpenOffersHint")}
          </div>
        ) : (
          incoming.map((offer, i) => {
            const lot = offer.lot;
            const place = lot ? lotPlaceLabel(lot, t("anonymousGrove")) : t("anonymousGrove");
            const badges = lot ? lotBadgesFor(lot, t) : [];
            const busy = busyOfferId === offer.id;
            return (
              <LotRow
                key={offer.id}
                first={i === 0}
                href={lot ? `/processor/lots/${lot.id}` : "/processor/lots"}
                lead={
                  <span className="flex size-11 items-center justify-center rounded-xl bg-soft">
                    <MapPin className="size-5 text-ink" />
                  </span>
                }
                title={place}
                sub={
                  lot
                    ? t("incomingSub", {
                        variety: varietyLabel(lot.variety),
                        tons: offer.tons,
                        region: lot.region,
                      })
                    : `${offer.tons} t`
                }
                badges={<LotBadges badges={badges} max={2} />}
                score={lot?.qualityScore != null ? <ScoreBox score={lot.qualityScore} /> : <span />}
                value={
                  <>
                    <Amount value={euroPrice(offer.pricePerKg)} unit="/kg" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {t("approx", { total: euroTotal(saleTotal(offer.tons, offer.pricePerKg)) })}
                    </span>
                  </>
                }
                actions={
                  <>
                    <ApButton
                      label={busy ? t("loading") : t("counter")}
                      variant="outline"
                      disabled={busy}
                      onClick={() => void onCounter(offer)}
                    />
                    <ApButton
                      label={busy ? t("loading") : t("accept")}
                      variant="dark"
                      disabled={busy}
                      onClick={() => void onAccept(offer)}
                    />
                  </>
                }
              />
            );
          })
        )}
      </Panel>
      </div>

      <Panel title={t("supplyOutlook")} subtitle={t("supplyOutlookHint")}>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="bg-soft text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">{t("region")}</th>
                <th className="px-4 py-2.5 font-semibold">{t("thisWeek")}</th>
                <th className="px-4 py-2.5 font-semibold">{t("week2")}</th>
                <th className="px-4 py-2.5 font-semibold">{t("week3")}</th>
                <th className="px-4 py-2.5 font-semibold">{t("week4")}</th>
                <th className="px-4 py-2.5 font-semibold">{t("pestRiskThisWeek")}</th>
              </tr>
            </thead>
            <tbody>
              {supply.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center font-medium text-muted-foreground">
                    {loading ? t("loading") : t("noHarvestOutlook")}
                  </td>
                </tr>
              ) : (
                supply.map((row) => (
                  <tr key={row.region} className="border-t border-line">
                    <td className="px-4 py-3 font-bold text-ink">{row.region}</td>
                    {row.weekTons.map((tons, idx) => (
                      <td key={idx} className="px-4 py-3 font-semibold text-ink">
                        {tons > 0 ? `${tons.toFixed(tons >= 10 ? 0 : 1)} t` : "–"}
                      </td>
                    ))}
                    <td className="px-4 py-3 font-medium text-muted-foreground">–</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {lots.length === 0 && !loading ? (
        <p className="text-[12px] font-medium text-muted-foreground">{t("lotsEmptyHint")}</p>
      ) : null}
    </div>
  );
}

export function ProcessorLotsScreen() {
  const t = useTranslations("processor");
  const locale = useLocale();
  const varietyLabel = useVarietyLabel();
  const varietyOptions = useMemo(() => marketplaceVarietyOptions(locale), [locale]);
  const { lots, offers, loading, error, reload } = useProcessorMarket();
  const placeById = useLotPlaceLabels(lots);
  const [useFilter, setUseFilter] = useState<"all" | "oil" | "table">("all");
  const [variety, setVariety] = useState("all");
  const [province, setProvince] = useState("all");
  const [minScore, setMinScore] = useState("0");
  const [noBanned, setNoBanned] = useState(false);
  const [labSuggested, setLabSuggested] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [offerLot, setOfferLot] = useState<ProcessorLot | null>(null);
  const [offerTons, setOfferTons] = useState("5");
  const [offerPrice, setOfferPrice] = useState("0.80");
  const mapToken = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;

  const regions = useMemo(() => {
    const fromGeocode = Object.values(placeById)
      .map((p) => p.split(",").slice(1).join(",").trim())
      .filter(Boolean);
    const set = new Set([...lots.map((l) => l.region).filter(Boolean), ...fromGeocode]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [lots, placeById]);

  const minScores = useMemo(
    () => [
      { value: "0", label: t("anyScore") },
      ...SCORE_OPTIONS.map((score) => ({ value: score, label: t("scorePlus", { score }) })),
    ],
    [t],
  );

  const shown = useMemo(() => {
    const min = Number(minScore) || 0;
    return lots
      .filter((l) => l.status === "listed")
      .filter((l) => (useFilter === "all" ? true : l.useType === useFilter))
      .filter((l) => (variety === "all" ? true : l.variety === variety))
      .filter((l) => {
        if (province === "all") return true;
        const place = placeById[l.id] ?? "";
        return l.region === province || place.includes(province);
      })
      .filter((l) => (l.qualityScore ?? 0) >= min)
      .filter((l) => (noBanned ? !l.hasBannedSpray : true))
      .filter((l) => (labSuggested ? l.labResult == null && (l.qualityScore ?? 100) < 80 : true));
  }, [lots, useFilter, variety, province, minScore, noBanned, labSuggested, placeById]);

  const mapPoints = useMemo(
    () =>
      shown
        .filter((l) => l.lat != null && l.lon != null)
        .map((l) => {
          const place = lotPlaceLabel(l, t("anonymousGrove"), placeById[l.id]);
          return {
            id: l.id,
            lat: l.lat!,
            lon: l.lon!,
            label: place,
            score: l.qualityScore,
            title: `${varietyLabel(l.variety)} · ${l.tons} t`,
            subtitle: t("lotSub", {
              place,
              harvest: harvestRangeLabel(l.harvestStart, l.harvestEnd),
              use: l.useType === "table" ? t("filterTable") : t("filterOil"),
            }),
            priceLabel:
              l.pricePerKg != null ? `${euroPrice(l.pricePerKg)} /kg · ${t("farmerPrice")}` : t("openToOffers"),
            useLabel: l.useType === "table" ? t("filterTable") : t("filterOil"),
            harvestLabel: harvestRangeLabel(l.harvestStart, l.harvestEnd),
          };
        }),
    [shown, placeById, t, varietyLabel],
  );

  useEffect(() => {
    if (selectedMapId && !shown.some((l) => l.id === selectedMapId)) {
      setSelectedMapId(null);
    }
  }, [shown, selectedMapId]);

  const alreadyOffered = (lotId: string) =>
    offers.some((o) => o.lotId === lotId && o.initiatedBy === "processor" && (o.status === "pending" || o.status === "countered"));

  const submitOffer = async () => {
    if (!offerLot?.farmerId) {
      toast.error(t("identityHidden"));
      return;
    }
    const tons = Number(offerTons);
    const price = Number(offerPrice);
    if (!(tons > 0) || !(price > 0)) {
      toast.error(t("invalidOfferValues"));
      return;
    }
    toast.message(t("sendingOffer"));
    const res = await placeLotOffer({
      lotId: offerLot.id,
      farmerId: offerLot.farmerId,
      tons,
      pricePerKg: price,
    });
    if (!res.ok) {
      toast.error(res.error ?? t("saveFailed"));
      return;
    }
    toast.success(t("offerSentDetail"));
    setOfferLot(null);
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title={t("findTitle")} subtitle={t("findSubtitle")} />
        <Segmented
          value={useFilter}
          onChange={setUseFilter}
          options={[
            { value: "all", label: t("filterAll") },
            { value: "oil", label: t("filterOil") },
            { value: "table", label: t("filterTable") },
          ]}
        />
      </div>

      {error === "needSupabase" || error === "needLogin" ? (
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">{t(error)}</ApCard>
      ) : null}

      <LotsMap
        token={mapToken}
        points={mapPoints}
        selectedId={selectedMapId}
        onSelect={setSelectedMapId}
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

      <div className="space-y-3">
        <ChipGroup
          label={t("variety")}
          value={variety}
          onChange={setVariety}
          options={[{ value: "all", label: t("filterAll") }, ...varietyOptions.map((v) => ({ value: v.value, label: v.label }))]}
        />
        <ChipGroup
          label={t("province")}
          value={province}
          onChange={setProvince}
          options={[
            { value: "all", label: t("filterAll") },
            ...(regions.length ? regions : PROVINCES).map((v) => ({ value: v, label: v })),
          ]}
        />
        <ChipGroup label={t("minScore")} value={minScore} onChange={setMinScore} options={minScores} />
        <div className="flex flex-wrap gap-2">
          <Chip tone="black" on={noBanned} onClick={() => setNoBanned((v) => !v)}>
            <span className={cn("text-[13px] font-bold", noBanned ? "text-white" : "text-ink")}>{t("noBannedProducts")}</span>
          </Chip>
          <Chip tone="black" on={labSuggested} onClick={() => setLabSuggested((v) => !v)}>
            <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-bold", labSuggested ? "text-white" : "text-ink")}>
              <FlaskConical className="size-3.5" />
              {t("labTestSuggested")}
            </span>
          </Chip>
        </div>
      </div>

      <Panel title={t("lotsCount", { count: shown.length })} subtitle={t("bestScoreFirst")}>
        {shown.length === 0 ? (
          <div className="border-t border-line px-4 py-10 text-center text-[13px] font-semibold text-muted-foreground">
            {loading ? t("loading") : t("noLotsMatch")}
          </div>
        ) : (
          shown.map((lot, i) => {
            const badges = lotBadgesFor(lot, t);
            const sent = alreadyOffered(lot.id);
            const place = lotPlaceLabel(lot, t("anonymousGrove"), placeById[lot.id]);
            const selected = selectedMapId === lot.id;
            return (
              <div
                key={lot.id}
                className={cn(selected && "bg-good-soft/40")}
                onMouseEnter={() => setSelectedMapId(lot.id)}
              >
                <LotRow
                  first={i === 0}
                  href={`/processor/lots/${lot.id}`}
                  lead={
                    <span className="flex size-11 items-center justify-center rounded-xl bg-good-soft">
                      <Leaf className="size-5 text-good" />
                    </span>
                  }
                  title={`${varietyLabel(lot.variety)} · ${lot.tons} t`}
                  sub={t("lotSub", {
                    place,
                    harvest: harvestRangeLabel(lot.harvestStart, lot.harvestEnd),
                    use: lot.useType === "table" ? t("filterTable") : t("filterOil"),
                  })}
                  badges={<LotBadges badges={badges} max={2} />}
                  score={lot.qualityScore != null ? <ScoreBox score={lot.qualityScore} /> : <span />}
                  value={
                    lot.pricePerKg != null ? (
                      <>
                        <Amount value={euroPrice(lot.pricePerKg)} unit="/kg" />
                        <span className="text-[11px] font-medium text-muted-foreground">{t("farmerPrice")}</span>
                      </>
                    ) : (
                      <span className="text-[13px] font-semibold text-muted-foreground">{t("openToOffers")}</span>
                    )
                  }
                  actions={
                    <ApButton
                      label={sent ? t("offerSent") : t("makeOffer")}
                      variant={sent ? "outline" : "dark"}
                      disabled={sent}
                      onClick={() => {
                        setOfferLot(lot);
                        setOfferTons(String(Math.min(5, lot.tons)));
                        setOfferPrice(String(lot.pricePerKg ?? DEMO_EXCHANGE));
                      }}
                    />
                  }
                />
              </div>
            );
          })
        )}
      </Panel>

      <Dialog
        open={offerLot != null}
        onClose={() => setOfferLot(null)}
        title={t("makeOffer")}
        subtitle={offerLot ? `${varietyLabel(offerLot.variety)} · ${offerLot.tons} t` : undefined}
        actionLabel={t("sendOffer")}
        onAction={() => void submitOffer()}
      >
        <TextField label={t("tons")} value={offerTons} onChange={setOfferTons} suffix="t" inputMode="decimal" />
        <TextField label={t("price")} value={offerPrice} onChange={setOfferPrice} suffix="€/kg" inputMode="decimal" />
      </Dialog>
    </div>
  );
}

export function ProcessorRequestsScreen() {
  const t = useTranslations("processor");
  const locale = useLocale();
  const varietyLabel = useVarietyLabel();
  const varietyOptions = useMemo(() => marketplaceVarietyOptions(locale), [locale]);
  const { requests, loading, error, reload } = useProcessorMarket();
  const [open, setOpen] = useState(false);
  const [variety, setVariety] = useState(() => defaultVarietySlug(resolveOliveCountry({ locale }).country));
  const [tons, setTons] = useState("10");
  const [minScore, setMinScore] = useState("75");
  const [windowKey, setWindowKey] = useState<string>(WINDOW_KEYS[1]!);
  const [province, setProvince] = useState("Peloponnese");
  const [noBanned, setNoBanned] = useState<"required" | "optional">("required");
  const [saving, setSaving] = useState(false);

  const openRequests = requests.filter((r) => r.active);

  const onCreate = async () => {
    const tonsN = Number(tons);
    if (!(tonsN > 0)) {
      toast.error(t("saveFailed"));
      return;
    }
    setSaving(true);
    const res = await createBuyRequest({
      variety,
      tons: tonsN,
      minScore: Number(minScore) || 0,
      region: province,
      windowLabel: t(windowKey as "window1"),
      noBanned: noBanned === "required",
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? t("saveFailed"));
      return;
    }
    setOpen(false);
    toast.success(t("requestCreated"));
    await reload();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("requestsTitle")}
        subtitle={t("requestsSubtitle")}
        action={
          <ApButton label={t("newRequest")} variant="dark" icon={<Plus className="size-4" />} onClick={() => setOpen(true)} />
        }
      />

      {error === "needSupabase" || error === "needLogin" ? (
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">{t(error)}</ApCard>
      ) : null}

      <Panel title={t("openRequestsCount", { count: openRequests.length })}>
        {openRequests.length === 0 ? (
          <div className="border-t border-line px-4 py-10 text-center text-[13px] font-semibold text-muted-foreground">
            {loading ? t("loading") : t("noOpenRequests")}
          </div>
        ) : (
          openRequests.map((req, i) => {
            const pct = req.tons > 0 ? Math.min(100, Math.round((req.filledTons / req.tons) * 100)) : 0;
            return (
              <div key={req.id} className={cn("flex flex-wrap items-center gap-4 px-4 py-4", i > 0 && "border-t border-line")}>
                <Initials text={initialsOf(varietyLabel(req.variety))} size={44} />
                <div className="min-w-[200px] flex-1">
                  <p className="text-[16px] font-extrabold text-ink">
                    {varietyLabel(req.variety)} · {req.tons} t
                  </p>
                  <p className="text-[13px] font-medium text-muted-foreground">
                    {[req.region, req.windowLabel, t("scorePlus", { score: String(req.minScore) })]
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
            );
          })
        )}
      </Panel>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("newRequest")}
        subtitle={t("newRequestSubtitle")}
        actionLabel={saving ? t("loading") : t("createRequest")}
        actionDisabled={saving}
        onAction={() => void onCreate()}
      >
        <div className="space-y-4">
          <ChipGroup
            label={t("variety")}
            value={variety}
            onChange={setVariety}
            options={varietyOptions.map((v) => ({ value: v.value, label: v.label }))}
          />
          <TextField label={t("tonnesNeeded")} value={tons} onChange={setTons} suffix="t" inputMode="decimal" />
          <ChipGroup
            label={t("minScore")}
            value={minScore}
            onChange={setMinScore}
            options={SCORE_OPTIONS.map((s) => ({ value: s, label: t("scorePlus", { score: s }) }))}
          />
          <ChipGroup
            label={t("deliveryWindow")}
            value={windowKey}
            onChange={setWindowKey}
            options={WINDOW_KEYS.map((k) => ({ value: k, label: t(k) }))}
          />
          <ChipGroup
            label={t("province")}
            value={province}
            onChange={setProvince}
            options={PROVINCES.map((p) => ({ value: p, label: p }))}
          />
          <ChipGroup
            label={t("noBannedProducts")}
            value={noBanned}
            onChange={(v) => setNoBanned(v as "required" | "optional")}
            options={[
              { value: "required", label: t("required") },
              { value: "optional", label: t("notRequired") },
            ]}
          />
        </div>
      </Dialog>
    </div>
  );
}

export function ProcessorDeliveriesScreen() {
  const t = useTranslations("processor");
  const varietyLabel = useVarietyLabel();
  const { deliveries, loading, error, reload } = useProcessorMarket();
  const [tab, setTab] = useState<"active" | "completed">("active");

  const deliverySteps = useMemo(
    () => [t("step.scheduled"), t("step.weighed"), t("step.lab_checked"), t("step.paid")],
    [t],
  );

  const active = deliveries.filter((d) => d.status !== "paid" && d.status !== "cancelled");
  const completed = deliveries.filter((d) => d.status === "paid");
  const tonnesBought = completed.reduce((s, d) => s + d.tons, 0);
  const totalSpent = completed.reduce((s, d) => s + saleTotal(d.tons, d.pricePerKg), 0);
  const avgQuality =
    completed.length === 0
      ? null
      : Math.round(
          completed.reduce((s, d) => s + (d.qualityScoreSnapshot ?? 0), 0) /
            Math.max(1, completed.filter((d) => d.qualityScoreSnapshot != null).length),
        );
  const bannedFreeShare =
    completed.length === 0
      ? null
      : Math.round((completed.filter((d) => d.bannedFree !== false).length / completed.length) * 100);

  const onAdvance = async (id: string, status: (typeof active)[number]["status"]) => {
    const next = nextDeliveryStatus(status);
    toast.message(t("advancing"));
    const res = await advanceDelivery(id, status, {
      labResult: "passed",
    });
    if (!res.ok) {
      toast.error(res.error ?? t("saveFailed"));
      return;
    }
    toast.success(
      next
        ? t("advancedDetail", { status: t(`step.${next}` as "step.weighed") })
        : t("advanced"),
    );
    await reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title={t("deliveriesTitle")}
          subtitle={tab === "active" ? t("deliveriesActiveSubtitle") : t("deliveriesCompletedSubtitle")}
        />
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: t("active"), badge: active.length || undefined },
            { value: "completed", label: t("completed") },
          ]}
        />
      </div>

      {error === "needSupabase" || error === "needLogin" ? (
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">{t(error)}</ApCard>
      ) : null}

      {tab === "active" ? (
        active.length === 0 ? (
          <ApCard className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 opacity-45">
              <div className="min-w-[200px] flex-1">
                <p className="text-[11px] font-bold tracking-[1px] text-ap-accent uppercase">{t("inProgress")}</p>
                <p className="text-[16px] font-extrabold text-ink">—</p>
                <p className="text-[13px] text-muted-foreground">{loading ? t("loading") : t("noActiveDeliveries")}</p>
              </div>
              <div className="text-right">
                <p className="text-[22px] font-extrabold text-ink">€0</p>
                <p className="text-[12px] text-muted-foreground">{t("expected")}</p>
              </div>
            </div>
            <div className="mt-3 max-w-[760px] opacity-45">
              <StatusSteps steps={deliverySteps} current={-1} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ApButton label={t("recordWeighbridge")} variant="dark" icon={<Scale className="size-4" />} disabled />
              <ApButton label={t("downloadReport")} variant="outline" icon={<Download className="size-4" />} disabled />
            </div>
          </ApCard>
        ) : (
          <div className="space-y-4">
            {active.map((d) => {
              const step = deliveryStepIndex(d.status);
              const nextLabel =
                d.status === "scheduled"
                  ? t("recordWeighbridge")
                  : d.status === "weighed"
                    ? t("markLab")
                    : d.status === "lab_checked"
                      ? t("markPaid")
                      : t("advance");
              return (
                <ApCard key={d.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-[200px] flex-1">
                      <p className="text-[11px] font-bold tracking-[1px] text-ap-accent uppercase">{t("inProgress")}</p>
                      <p className="text-[16px] font-extrabold text-ink">
                        {d.farmerName ?? d.lotRegion ?? t("anonymousGrove")}
                      </p>
                      <p className="text-[13px] text-muted-foreground">
                        {[d.lotVariety ? varietyLabel(d.lotVariety) : null, `${d.tons} t`, d.lotRegion]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[22px] font-extrabold text-ink">
                        {euroTotal(saleTotal(d.tons, d.pricePerKg))}
                      </p>
                      <p className="text-[12px] text-muted-foreground">{t("expected")}</p>
                    </div>
                  </div>
                  <div className="mt-3 max-w-[760px]">
                    <StatusSteps steps={deliverySteps} current={step} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <ApButton
                      label={nextLabel}
                      variant="dark"
                      icon={<Scale className="size-4" />}
                      disabled={!canAdvanceDelivery(d.status)}
                      onClick={() => void onAdvance(d.id, d.status)}
                    />
                    <ApButton label={t("downloadReport")} variant="outline" icon={<Download className="size-4" />} disabled />
                  </div>
                </ApCard>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <StatCard
              compact
              label={t("tonnesBought")}
              value={`${tonnesBought.toFixed(tonnesBought >= 10 ? 0 : 1)} t`}
              hint={t("deliveriesCount", { count: completed.length })}
              icon={<Wheat className="size-4" />}
            />
            <StatCard
              compact
              label={t("totalSpent")}
              value={euroTotal(totalSpent)}
              hint={t("seasonYear", { year: 2026 })}
              icon={<Euro className="size-4" />}
            />
            <StatCard
              compact
              label={t("avgQualityScore")}
              value={avgQuality == null || Number.isNaN(avgQuality) ? "–" : String(avgQuality)}
              hint={t("ofLotsBought")}
              icon={<Gauge className="size-4" />}
            />
            <StatCard
              compact
              label={t("noBannedProducts")}
              value={bannedFreeShare == null ? "–" : `${bannedFreeShare}%`}
              hint={t("shareOfLots")}
              icon={<ShieldCheck className="size-4" />}
            />
          </div>
          <Panel title={t("purchaseHistory")} subtitle={t("purchaseHistoryHint")}>
            {completed.length === 0 ? (
              <div className="border-t border-line px-4 py-10 text-center text-[13px] font-semibold text-muted-foreground">
                {loading ? t("loading") : t("noCompletedDeliveries")}
              </div>
            ) : (
              completed.map((d, i) => (
                <div key={d.id} className={cn("flex flex-wrap items-center justify-between gap-3 px-4 py-3", i > 0 && "border-t border-line")}>
                  <div>
                    <p className="text-[16px] font-extrabold text-ink">{d.farmerName ?? d.lotRegion ?? "—"}</p>
                    <p className="text-[13px] font-medium text-muted-foreground">
                      {[d.lotVariety ? varietyLabel(d.lotVariety) : null, `${d.tons} t`, euroPrice(d.pricePerKg)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <p className="text-[16px] font-extrabold text-ink">{euroTotal(saleTotal(d.tons, d.pricePerKg))}</p>
                </div>
              ))
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

export function ProcessorLotDetailScreen({ id }: { id: string }) {
  const t = useTranslations("processor");
  const varietyLabel = useVarietyLabel();
  const { lots, offers, loading, reload } = useProcessorMarket();
  const lot = lots.find((l) => l.id === id) ?? null;
  const placeById = useLotPlaceLabels(lot ? [lot] : []);
  const mapToken = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;
  const [tons, setTons] = useState("5");
  const [price, setPrice] = useState(String(DEMO_EXCHANGE));
  const [open, setOpen] = useState(false);

  const sent = offers.some(
    (o) => o.lotId === id && o.initiatedBy === "processor" && (o.status === "pending" || o.status === "countered"),
  );

  const submit = async () => {
    if (!lot?.farmerId) {
      toast.error(t("identityHidden"));
      return;
    }
    const res = await placeLotOffer({
      lotId: lot.id,
      farmerId: lot.farmerId,
      tons: Number(tons),
      pricePerKg: Number(price),
    });
    if (!res.ok) {
      toast.error(res.error ?? t("saveFailed"));
      return;
    }
    toast.success(t("offerSentDetail"));
    setOpen(false);
    await reload();
  };

  if (loading && !lot) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("lotTitle", { id: id.slice(0, 8) })} subtitle={t("loading")} />
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("lotTitle", { id: id.slice(0, 8) })} subtitle={t("lotDetailEmptySubtitle")} />
        <ApCard className="flex items-center gap-3 p-5">
          <span className="flex size-11 items-center justify-center rounded-xl bg-good-soft">
            <Leaf className="size-5 text-good" />
          </span>
          <div>
            <p className="text-[16px] font-extrabold text-ink">{t("notAvailable")}</p>
            <p className="text-[13px] text-muted-foreground">{t("lotEmptyBody")}</p>
          </div>
        </ApCard>
        <Link href="/processor/lots" className="text-[13px] font-semibold text-muted-foreground hover:text-ink">
          {t("backToFindOlives")}
        </Link>
      </div>
    );
  }

  const badges = lotBadgesFor(lot, t);
  const place = lotPlaceLabel(lot, t("anonymousGrove"), placeById[lot.id]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${varietyLabel(lot.variety)} · ${lot.tons} t`}
        subtitle={t("lotDetailSubtitle")}
        action={
          <ApButton
            label={sent ? t("offerSent") : t("makeOffer")}
            variant="dark"
            disabled={sent}
            onClick={() => {
              setTons(String(Math.min(5, lot.tons)));
              setPrice(String(lot.pricePerKg ?? DEMO_EXCHANGE));
              setOpen(true);
            }}
          />
        }
      />

      {lot.lat != null && lot.lon != null ? (
        <LotsMap
          token={mapToken}
          points={[
            {
              id: lot.id,
              lat: lot.lat,
              lon: lot.lon,
              label: place,
              score: lot.qualityScore,
              title: `${varietyLabel(lot.variety)} · ${lot.tons} t`,
              subtitle: t("lotSub", {
                place,
                harvest: harvestRangeLabel(lot.harvestStart, lot.harvestEnd),
                use: lot.useType === "table" ? t("filterTable") : t("filterOil"),
              }),
              priceLabel:
                lot.pricePerKg != null
                  ? `${euroPrice(lot.pricePerKg)} /kg · ${t("farmerPrice")}`
                  : t("openToOffers"),
              useLabel: lot.useType === "table" ? t("filterTable") : t("filterOil"),
              harvestLabel: harvestRangeLabel(lot.harvestStart, lot.harvestEnd),
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

      <ApCard className="flex flex-wrap items-center gap-4 p-5">
        <span className="flex size-11 items-center justify-center rounded-xl bg-good-soft">
          <Leaf className="size-5 text-good" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-extrabold text-ink">{place}</p>
          <p className="text-[13px] text-muted-foreground">
            {t("lotSub", {
              place,
              harvest: harvestRangeLabel(lot.harvestStart, lot.harvestEnd),
              use: lot.useType === "table" ? t("filterTable") : t("filterOil"),
            })}
          </p>
          {!lot.farmerDisplayName ? (
            <p className="mt-1 text-[12px] font-medium text-muted-foreground">{t("identityHidden")}</p>
          ) : null}
        </div>
        {lot.qualityScore != null ? <ScoreBox score={lot.qualityScore} large /> : null}
        {lot.pricePerKg != null ? (
          <div className="text-right">
            <Amount value={euroPrice(lot.pricePerKg)} unit="/kg" large />
            <p className="text-[11px] font-medium text-muted-foreground">{t("farmerPrice")}</p>
          </div>
        ) : null}
      </ApCard>

      <LotBadges badges={badges} />

      <Link href="/processor/lots" className="text-[13px] font-semibold text-muted-foreground hover:text-ink">
        {t("backToFindOlives")}
      </Link>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("makeOffer")}
        subtitle={`${varietyLabel(lot.variety)} · ${lot.tons} t`}
        actionLabel={t("sendOffer")}
        onAction={() => void submit()}
      >
        <TextField label={t("tons")} value={tons} onChange={setTons} suffix="t" inputMode="decimal" />
        <TextField label={t("price")} value={price} onChange={setPrice} suffix="€/kg" inputMode="decimal" />
      </Dialog>
    </div>
  );
}
