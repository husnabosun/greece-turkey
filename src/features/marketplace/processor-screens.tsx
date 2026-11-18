"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  Download,
  Euro,
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
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Pill } from "@/shared/components/brand/pill";
import { StatusSteps } from "@/shared/components/brand/status-steps";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { euroPrice, euroTotal, formatTons, saleTotal } from "@/features/marketplace/pricing";
import { trustBadges } from "@/features/marketplace/badges";
import { canAdvanceDelivery, deliveryStepIndex, nextDeliveryStatus } from "@/features/marketplace/delivery-state";
import { reverseGeocodePlace } from "@/features/fields/reverse-geocode";
import {
  defaultVarietySlug,
  marketplaceVarietyOptions,
  resolveOliveCountry,
  varietyLabelFromStored,
} from "@/features/fields/olive-varieties";
import { LotsMap } from "./lots-map";
import {
  Amount,
  ChipGroup,
  DayChipPicker,
  Dialog,
  EmptyBlock,
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
  WeekStrip,
  type LotBadge,
  type WeekDayCell,
} from "./processor-kit";
import { marketRegionOptions, regionLabel } from "./regions";
import {
  DAY_CAPACITY_TONS,
  DEFAULT_DELIVERY_IN_DAYS,
  addDaysIso,
  formatWindowLabel,
  localizeStoredWindowLabel,
  nextDeliveryWindows,
  nextSevenDays,
  parseIsoDate,
  todayIsoDate,
} from "./schedule";
import {
  acceptIncomingOffer,
  advanceDelivery,
  counterIncomingOffer,
  createBuyRequest,
  deactivateBuyRequest,
  harvestRangeLabel,
  lotPlaceLabel,
  placeLotOffer,
  rejectOffer,
  scheduleDelivery,
  useProcessorMarket,
  type ProcessorDelivery,
  type ProcessorLot,
  type ProcessorOffer,
} from "./use-processor-market";

const SCORE_OPTIONS = ["70", "75", "80", "85"] as const;
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
  return (slug: string) => varietyLabelFromStored(slug, locale);
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

function overviewGreeting(locale: string, company: string) {
  const hour = new Date().getHours();
  const hello =
    hour < 12 ? "greetingMorning" : hour < 18 ? "greetingAfternoon" : "greetingEvening";
  const date = new Date().toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return { hello, company, date };
}

function SupplyWeekBars({
  weekTons,
  labels,
}: {
  weekTons: [number, number, number, number];
  labels: [string, string, string, string];
}) {
  const max = Math.max(1, ...weekTons);
  return (
    <div className="mt-3 grid grid-cols-4 gap-2">
      {weekTons.map((tons, i) => (
        <div key={labels[i]} className="flex flex-col items-center gap-1.5">
          <div className="flex h-14 w-full items-end justify-center rounded-md bg-soft px-1 pb-1">
            <div
              className="w-full max-w-[28px] rounded-sm bg-ink/80"
              style={{ height: `${Math.max(6, Math.round((tons / max) * 100))}%` }}
              title={`${tons} t`}
            />
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground">{labels[i]}</span>
          <span className="text-[11px] font-bold text-ink">{tons > 0 ? formatTons(tons) : "–"}</span>
        </div>
      ))}
    </div>
  );
}

export function ProcessorOverviewScreen() {
  const t = useTranslations("processor");
  const tNav = useTranslations("processorNav");
  const locale = useLocale();
  const router = useRouter();
  const varietyLabel = useVarietyLabel();
  const { lots, offers, requests, deliveries, supply, loading, error, reload } = useProcessorMarket();
  const [company, setCompany] = useState(tNav("processorFallback"));

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
  const [acceptOffer, setAcceptOffer] = useState<ProcessorOffer | null>(null);
  const [acceptDate, setAcceptDate] = useState(() => addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const greet = overviewGreeting(locale, company);
  const weekDates = useMemo(() => nextSevenDays(), []);

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) return;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_name, display_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      const name =
        profile?.company_name?.trim() ||
        profile?.display_name?.trim() ||
        auth.user.email?.split("@")[0] ||
        tNav("processorFallback");
      setCompany(name);
    })();
  }, [tNav]);

  const onAcceptConfirm = async () => {
    if (!acceptOffer) return;
    setBusyOfferId(acceptOffer.id);
    toast.message(t("accepting"));
    try {
      const res = await acceptIncomingOffer(acceptOffer.id, { scheduledFor: acceptDate });
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"));
        return;
      }
      toast.success(t("acceptedScheduled", { date: acceptDate }));
      setAcceptOffer(null);
      setSelectedDay(acceptDate);
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

  const onReject = async (offer: ProcessorOffer) => {
    if (!window.confirm(t("rejectConfirm"))) return;
    setBusyOfferId(offer.id);
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
      setBusyOfferId(null);
    }
  };

  const weekLabels: [string, string, string, string] = [t("thisWeek"), t("week2"), t("week3"), t("week4")];

  const openDeliveries = useMemo(
    () => deliveries.filter((d) => d.status !== "paid" && d.status !== "cancelled"),
    [deliveries],
  );
  const unscheduled = useMemo(
    () => openDeliveries.filter((d) => !parseIsoDate(d.scheduledFor)),
    [openDeliveries],
  );

  const weekCells: WeekDayCell[] = useMemo(() => {
    return weekDates.map((iso) => {
      const dt = new Date(`${iso}T12:00:00`);
      const dayDeliveries = openDeliveries.filter((d) => parseIsoDate(d.scheduledFor) === iso);
      const tons = dayDeliveries.reduce((s, d) => s + d.tons, 0);
      return {
        iso,
        weekday: dt.toLocaleDateString(locale, { weekday: "short" }),
        dayNum: String(dt.getDate()),
        isToday: iso === todayIsoDate(),
        tons,
        overloaded: tons >= DAY_CAPACITY_TONS,
        chips: dayDeliveries.map((d) => ({
          id: d.id,
          label: `${d.lotVariety ? varietyLabel(d.lotVariety) : t("anonymousGrove")} · ${formatTons(d.tons, locale)}`,
        })),
      };
    });
  }, [weekDates, openDeliveries, locale, varietyLabel, t]);

  const selectedDayDeliveries = selectedDay
    ? openDeliveries.filter((d) => parseIsoDate(d.scheduledFor) === selectedDay)
    : [];

  const onAdvanceFromDay = async (d: ProcessorDelivery) => {
    if (!canAdvanceDelivery(d.status)) return;
    // Weighbridge / lab need inputs — open the Deliveries page for the confirm dialog.
    router.push("/processor/deliveries");
  };

  const onQuickSchedule = async (deliveryId: string, iso: string) => {
    setSchedulingId(deliveryId);
    try {
      const res = await scheduleDelivery(deliveryId, iso);
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"));
        return;
      }
      toast.success(t("deliveryScheduled", { date: iso }));
      setSelectedDay(iso);
      await reload();
    } finally {
      setSchedulingId(null);
    }
  };

  const formatChipDay = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: "short" });

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[240px] shrink">
          <p className="text-[13px] font-semibold text-muted-foreground capitalize">{greet.date}</p>
          <h1 className="mt-1 text-[32px] leading-[38px] font-extrabold text-ink">
            {t(greet.hello as "greetingMorning", { name: company })}
          </h1>
          <p className="mt-1 text-[16px] leading-5 font-medium text-muted-foreground">{t("overviewSubtitle")}</p>
        </div>
        <Link href="/processor/lots">
          <ApButton label={tNav("findOlives")} variant="dark" icon={<Search className="size-4" />} />
        </Link>
      </div>

      {error === "needSupabase" || error === "needLogin" ? (
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">{t(error)}</ApCard>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <StatCard
          href="#incoming-offers"
          label={t("incomingOffers")}
          value={loading ? "…" : String(incoming.length)}
          hint={t("waitingAnswer")}
          icon={<Inbox className="size-[18px]" />}
          iconTone={incoming.length > 0 ? "warn" : "soft"}
          attention={incoming.length > 0}
        />
        <StatCard
          href="/processor/requests"
          label={t("openRequests")}
          value={loading ? "…" : String(openRequests.length)}
          hint={t("waitingFarmers")}
          icon={<ClipboardList className="size-[18px]" />}
          iconTone="accent"
        />
        <StatCard
          href="/processor/deliveries"
          label={t("deliveriesWeek")}
          value={loading ? "…" : String(deliveriesWeek.length)}
          hint={t("notPaidYet")}
          icon={<Truck className="size-[18px]" />}
          iconTone={deliveriesWeek.length > 0 ? "good" : "soft"}
          attention={deliveriesWeek.length > 0}
        />
        <StatCard
          href="/processor/lots"
          label={t("avgQualityScore")}
          value={avgIncoming == null || Number.isNaN(avgIncoming) ? "–" : String(avgIncoming)}
          hint={t("ofIncoming")}
          icon={<Gauge className="size-[18px]" />}
          iconTone="good"
        />
      </div>

      {loading ? (
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">{t("loading")}</ApCard>
      ) : null}

      <div className="space-y-3">
        <WeekStrip
          title={t("weekStripTitle")}
          subtitle={t("weekStripSubtitle")}
          days={weekCells}
          selectedIso={selectedDay}
          onSelect={(iso) => setSelectedDay((cur) => (cur === iso ? null : iso))}
          emptyHint={t("weekStripEmpty")}
        />

        {selectedDay ? (
          <ApCard className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
              <div>
                <p className="text-[15px] font-extrabold text-ink">
                  {t("dayDetailTitle", {
                    date: new Date(`${selectedDay}T12:00:00`).toLocaleDateString(locale, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    }),
                  })}
                </p>
                <p className="text-[12px] font-medium text-muted-foreground">
                  {selectedDayDeliveries.length === 0
                    ? t("dayDetailEmpty")
                    : t("dayDetailTons", {
                        n: selectedDayDeliveries.reduce((s, d) => s + d.tons, 0),
                        count: selectedDayDeliveries.length,
                      })}
                </p>
              </div>
              <Link href="/processor/deliveries" className="text-[12px] font-bold text-ink hover:underline">
                {t("seeAll")}
              </Link>
            </div>
            {selectedDayDeliveries.length === 0 ? (
              <p className="border-t border-line px-4 py-6 text-center text-[13px] font-semibold text-muted-foreground">
                {t("dayDetailEmpty")}
              </p>
            ) : (
              selectedDayDeliveries.map((d) => {
                const nextLabel =
                  d.status === "scheduled"
                    ? t("recordWeighbridge")
                    : d.status === "weighed"
                      ? t("markLab")
                      : d.status === "lab_checked"
                        ? t("markPaid")
                        : t("advance");
                return (
                  <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-extrabold text-ink">
                        {d.farmerName ?? d.lotRegion ?? t("anonymousGrove")}
                      </p>
                      <p className="text-[12px] font-medium text-muted-foreground">
                        {[
                          d.lotVariety ? varietyLabel(d.lotVariety) : null,
                          `${d.tons} t`,
                          t(`step.${d.status}` as "step.scheduled"),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-extrabold text-ink">
                        {euroTotal(saleTotal(d.tons, d.pricePerKg))}
                      </span>
                      {canAdvanceDelivery(d.status) ? (
                        <ApButton
                          label={nextLabel}
                          variant="dark"
                          icon={<Scale className="size-4" />}
                          onClick={() => void onAdvanceFromDay(d)}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </ApCard>
        ) : null}

        {unscheduled.length > 0 ? (
          <ApCard className="overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="text-[15px] font-extrabold text-ink">{t("unscheduledTitle")}</p>
              <p className="text-[12px] font-medium text-muted-foreground">{t("unscheduledHint")}</p>
            </div>
            {unscheduled.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
                <div>
                  <p className="text-[14px] font-extrabold text-ink">{d.farmerName ?? d.lotRegion ?? t("anonymousGrove")}</p>
                  <p className="text-[12px] font-medium text-muted-foreground">
                    {[d.lotVariety ? varietyLabel(d.lotVariety) : null, formatTons(d.tons, locale)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {weekDates.slice(0, 5).map((iso) => (
                    <button
                      key={iso}
                      type="button"
                      disabled={schedulingId === d.id}
                      onClick={() => void onQuickSchedule(d.id, iso)}
                      className="rounded-full border border-line bg-card px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-soft disabled:opacity-50"
                    >
                      {iso === todayIsoDate() ? t("todayShort") : formatChipDay(iso)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </ApCard>
        ) : null}
      </div>

      <Dialog
        open={acceptOffer != null}
        onClose={() => setAcceptOffer(null)}
        title={t("offerDetailTitle")}
        subtitle={t("offerDetailHint")}
        actionLabel={busyOfferId ? t("loading") : t("accept")}
        actionDisabled={busyOfferId != null}
        onAction={() => void onAcceptConfirm()}
      >
        {acceptOffer ? (
          <div className="mb-4 space-y-2 rounded-xl bg-soft p-3">
            <p className="text-[15px] font-extrabold text-ink">
              {acceptOffer.lot
                ? lotPlaceLabel(acceptOffer.lot, t("anonymousGrove"))
                : t("anonymousGrove")}
            </p>
            <p className="text-[13px] font-medium text-muted-foreground">
              {acceptOffer.lot
                ? t("incomingSub", {
                    variety: varietyLabel(acceptOffer.lot.variety),
                    tons: acceptOffer.tons,
                    region: acceptOffer.lot.region,
                  })
                : `${acceptOffer.tons} t`}
            </p>
            <p className="text-[18px] font-extrabold text-ink">
              {t("asksPrice", { price: euroPrice(acceptOffer.pricePerKg) })}
              <span className="ml-2 text-[12px] font-semibold text-muted-foreground">
                {t("approx", { total: euroTotal(saleTotal(acceptOffer.tons, acceptOffer.pricePerKg)) })}
              </span>
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <ApButton
                label={busyOfferId ? t("loading") : t("reject")}
                variant="outline"
                disabled={busyOfferId != null}
                onClick={() => void onReject(acceptOffer)}
              />
              <ApButton
                label={busyOfferId ? t("loading") : t("counter")}
                variant="outline"
                disabled={busyOfferId != null}
                onClick={() => void onCounter(acceptOffer)}
              />
            </div>
          </div>
        ) : null}
        <DayChipPicker
          label={t("arriveOn")}
          days={weekDates}
          value={acceptDate}
          onChange={setAcceptDate}
          formatDay={(iso) => formatChipDay(iso)}
          todayLabel={t("todayShort")}
        />
      </Dialog>

      <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[minmax(0,1fr)_300px]">
        <div id="incoming-offers" className="scroll-mt-4 min-w-0 space-y-6">
          <Panel title={t("incomingOffers")} subtitle={t("incomingHint")}>
            {incoming.length === 0 ? (
              <EmptyBlock
                icon={<Inbox className="size-5" />}
                title={t("noOpenOffersTitle")}
                body={t("noOpenOffersHint")}
                action={
                  <Link href="/processor/requests">
                    <ApButton label={tNav("requests")} variant="dark" icon={<ClipboardList className="size-4" />} />
                  </Link>
                }
              />
            ) : (
              incoming.map((offer, i) => {
                const lot = offer.lot;
                const place = lot ? lotPlaceLabel(lot, t("anonymousGrove")) : t("anonymousGrove");
                const badges = lot ? lotBadgesFor(lot, t) : [];
                return (
                  <LotRow
                    key={offer.id}
                    first={i === 0}
                    href={`/processor/offers/${offer.id}`}
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
                        <span className="text-[11px] font-semibold text-ink">
                          {t("asksPrice", { price: euroPrice(offer.pricePerKg) })}
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {t("approx", { total: euroTotal(saleTotal(offer.tons, offer.pricePerKg)) })}
                        </span>
                      </>
                    }
                    actions={
                      <ApButton
                        label={t("openOffer")}
                        variant="dark"
                        onClick={() => router.push(`/processor/offers/${offer.id}`)}
                      />
                    }
                  />
                );
              })
            )}
          </Panel>

          <Panel title={t("outgoingOffers")} subtitle={t("outgoingHint")}>
            {outgoing.length === 0 ? (
              <EmptyBlock
                icon={<Search className="size-5" />}
                title={t("noOutgoingTitle")}
                body={t("noOutgoingOffers")}
                action={
                  <Link href="/processor/lots">
                    <ApButton label={tNav("findOlives")} variant="outline" icon={<Search className="size-4" />} />
                  </Link>
                }
              />
            ) : (
              outgoing.map((offer) => {
                const lot = offer.lot;
                const place = lot ? lotPlaceLabel(lot, t("anonymousGrove")) : t("anonymousGrove");
                return (
                  <div key={offer.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
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
        </div>

        <aside className="min-w-0">
          <Panel
            title={t("upcomingDeliveries")}
            subtitle={t("upcomingDeliveriesHint")}
            right={
              deliveriesWeek.length > 0 ? (
                <Link href="/processor/deliveries" className="text-[12px] font-bold text-ink hover:underline">
                  {t("seeAll")}
                </Link>
              ) : null
            }
          >
            {deliveriesWeek.length === 0 ? (
              <EmptyBlock
                icon={<Truck className="size-5" />}
                title={t("noUpcomingTitle")}
                body={t("noUpcomingBody")}
                action={
                  <Link href="/processor/requests">
                    <ApButton label={t("newRequest")} variant="dark" icon={<Plus className="size-4" />} />
                  </Link>
                }
              />
            ) : (
              deliveriesWeek.slice(0, 5).map((d) => {
                const when = parseIsoDate(d.scheduledFor);
                return (
                  <div key={d.id} className="border-t border-line px-4 py-3">
                    <p className="text-[14px] font-extrabold text-ink">{d.farmerName ?? d.lotRegion ?? t("anonymousGrove")}</p>
                    <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">
                      {[
                        when
                          ? new Date(`${when}T12:00:00`).toLocaleDateString(locale, {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })
                          : t("unscheduledShort"),
                        d.lotVariety ? varietyLabel(d.lotVariety) : null,
                        formatTons(d.tons, locale),
                        d.lotRegion ? regionLabel(d.lotRegion, locale) : null,
                        t(`step.${d.status}` as "step.scheduled"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-1 text-[13px] font-extrabold text-ink">{euroTotal(saleTotal(d.tons, d.pricePerKg))}</p>
                  </div>
                );
              })
            )}
          </Panel>
        </aside>
      </div>

      <Panel title={t("supplyOutlook")} subtitle={t("supplyOutlookHint")}>
        {supply.length === 0 ? (
          <EmptyBlock
            icon={<Wheat className="size-5" />}
            title={t("noHarvestOutlookTitle")}
            body={loading ? t("loading") : t("noHarvestOutlook")}
            action={
              <Link href="/processor/lots">
                <ApButton label={tNav("findOlives")} variant="outline" icon={<Search className="size-4" />} />
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 border-t border-line p-4 sm:grid-cols-2">
            {supply.map((row) => {
              const total = row.weekTons.reduce((a, b) => a + b, 0);
              return (
                <div key={row.region} className="relative rounded-[16px] border border-line bg-background p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[15px] font-extrabold text-ink">{regionLabel(row.region, locale)}</p>
                      <p className="text-[12px] font-medium text-muted-foreground">
                        {t("regionTotalTonsLabel", { tons: formatTons(total, locale) })}
                      </p>
                    </div>
                    <span className="rounded-full bg-soft px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {t("riskUnknown")}
                    </span>
                  </div>
                  <SupplyWeekBars weekTons={row.weekTons} labels={weekLabels} />
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {lots.length === 0 && !loading ? (
        <p className="text-[12px] font-medium text-muted-foreground">{t("lotsEmptyHint")}</p>
      ) : null}
    </div>
  );
}

export { ProcessorLotsScreen } from "./processor-lots-screen";

/** Dedicated inbox: Flow B farmer offers in, Flow A mill bids out. */
export function ProcessorOffersScreen() {
  const t = useTranslations("processor");
  const tNav = useTranslations("processorNav");
  const varietyLabel = useVarietyLabel();
  const { offers, loading, error } = useProcessorMarket();

  const incoming = offers.filter(
    (o) => o.initiatedBy === "farmer" && (o.status === "pending" || o.status === "countered"),
  );
  const outgoing = offers.filter(
    (o) => o.initiatedBy === "processor" && (o.status === "pending" || o.status === "countered"),
  );

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 sm:px-6">
      <PageHeader title={t("offersTitle")} subtitle={t("offersSubtitle")} />
      {error ? <p className="text-ap-small text-risk">{error}</p> : null}
      {loading ? <p className="text-ap-small text-muted-foreground">{t("loading")}</p> : null}

      <Panel title={t("incomingOffers")} subtitle={t("incomingHint")}>
        {incoming.length === 0 ? (
          <EmptyBlock
            icon={<Inbox className="size-5" />}
            title={t("noOpenOffersTitle")}
            body={t("noOpenOffersHint")}
            action={
              <Link href="/processor/requests">
                <ApButton label={tNav("requests")} variant="dark" icon={<ClipboardList className="size-4" />} />
              </Link>
            }
          />
        ) : (
          incoming.map((offer, i) => {
            const lot = offer.lot;
            const place = lot ? lotPlaceLabel(lot, t("anonymousGrove")) : t("anonymousGrove");
            return (
              <LotRow
                key={offer.id}
                first={i === 0}
                href={`/processor/offers/${offer.id}`}
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
                badges={<span />}
                score={lot?.qualityScore != null ? <ScoreBox score={lot.qualityScore} /> : <span />}
                value={
                  <>
                    <Amount value={euroPrice(offer.pricePerKg)} unit="/kg" />
                    <span className="text-[11px] font-semibold text-ink">
                      {t("asksPrice", { price: euroPrice(offer.pricePerKg) })}
                    </span>
                  </>
                }
                actions={
                  <Link href={`/processor/offers/${offer.id}`}>
                    <ApButton label={t("openOffer")} variant="dark" />
                  </Link>
                }
              />
            );
          })
        )}
      </Panel>

      <Panel title={t("outgoingOffers")} subtitle={t("outgoingHint")}>
        {outgoing.length === 0 ? (
          <EmptyBlock
            icon={<Search className="size-5" />}
            title={t("noOutgoingTitle")}
            body={t("noOutgoingOffers")}
            action={
              <Link href="/processor/lots">
                <ApButton label={tNav("findOlives")} variant="outline" icon={<Search className="size-4" />} />
              </Link>
            }
          />
        ) : (
          outgoing.map((offer) => {
            const lot = offer.lot;
            const place = lot ? lotPlaceLabel(lot, t("anonymousGrove")) : t("anonymousGrove");
            return (
              <Link
                key={offer.id}
                href={`/processor/offers/${offer.id}`}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 hover:bg-background"
              >
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
              </Link>
            );
          })
        )}
      </Panel>
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
  const [noBanned, setNoBanned] = useState<"required" | "optional">("required");
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

  const onCreate = async () => {
    const tonsN = Number(tons);
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

  const onDeleteRequest = async (requestId: string) => {
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
          <ApButton label={t("newRequest")} variant="dark" icon={<Plus className="size-4" />} onClick={() => setOpen(true)} />
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
              <div key={req.id} className={cn("px-4 py-4", i > 0 && "border-t border-line")}>
                <div className="flex flex-wrap items-center gap-4">
                  <Initials text={initialsOf(varietyLabel(req.variety))} size={44} />
                  <div className="min-w-[200px] flex-1">
                      <p className="text-[16px] font-extrabold text-ink">
                    {varietyLabel(req.variety)} · {formatTons(req.tons, locale)}
                  </p>
                  <p className="text-[13px] font-medium text-muted-foreground">
                    {[
                        req.region ? regionLabel(req.region, locale) : null,
                        localizeStoredWindowLabel(req.windowLabel, locale),
                        t("scorePlus", { score: String(req.minScore) }),
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
                  <ApButton
                    label={busyId === req.id ? t("loading") : t("deleteRequest")}
                    variant="outline"
                    disabled={busyId != null}
                    onClick={() => void onDeleteRequest(req.id)}
                  />
                </div>

                <div className="mt-3 rounded-xl border border-dashed border-line bg-background/60 p-3">
                  <p className="text-[12px] font-bold text-ink">
                    {t("offersOnRequest", { count: linked.length })}
                  </p>
                  {linked.length === 0 ? (
                    <p className="mt-1 text-[12px] text-muted-foreground">{t("noOffersOnRequest")}</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {linked.map((offer) => (
                        <div
                          key={offer.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-card px-3 py-2"
                        >
                          <div>
                            <p className="text-[14px] font-extrabold text-ink">
                              {t("asksPrice", { price: euroPrice(offer.pricePerKg) })}
                            </p>
                            <p className="text-[12px] text-muted-foreground">
                              {offer.tons} t ·{" "}
                              {t("approx", { total: euroTotal(saleTotal(offer.tons, offer.pricePerKg)) })}
                            </p>
                          </div>
                          <Link href={`/processor/offers/${offer.id}`}>
                            <ApButton label={t("openOffer")} variant="dark" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
            options={deliveryWindows.map((w) => ({
              value: w.key,
              label: formatWindowLabel(w.start, w.end, locale),
            }))}
          />
          <ChipGroup
            label={t("province")}
            value={province}
            onChange={setProvince}
            options={regionOptions}
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
  const locale = useLocale();
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
  const scoredCompleted = completed.filter((d) => d.qualityScoreSnapshot != null);
  const avgQuality =
    scoredCompleted.length === 0
      ? null
      : Math.round(
          scoredCompleted.reduce((s, d) => s + (d.qualityScoreSnapshot as number), 0) / scoredCompleted.length,
        );
  const bannedFreeShare =
    completed.length === 0
      ? null
      : Math.round((completed.filter((d) => d.bannedFree !== false).length / completed.length) * 100);

  const [advanceTarget, setAdvanceTarget] = useState<(typeof active)[number] | null>(null);
  const [weighKg, setWeighKg] = useState("");
  const [labOk, setLabOk] = useState<"passed" | "failed">("passed");
  const [advancing, setAdvancing] = useState(false);

  const openAdvance = (d: (typeof active)[number]) => {
    setAdvanceTarget(d);
    setWeighKg(String(Math.round(d.tons * 1000)));
    setLabOk("passed");
  };

  const onAdvanceConfirm = async () => {
    if (!advanceTarget) return;
    const next = nextDeliveryStatus(advanceTarget.status);
    setAdvancing(true);
    toast.message(t("advancing"));
    try {
      const extras =
        advanceTarget.status === "scheduled"
          ? { actualKg: Number(weighKg.replace(",", ".")) || undefined }
          : advanceTarget.status === "weighed"
            ? { labResult: labOk }
            : undefined;
      if (advanceTarget.status === "scheduled") {
        const kg = Number(weighKg.replace(",", "."));
        if (!Number.isFinite(kg) || kg <= 0) {
          toast.error(t("saveFailed"));
          return;
        }
      }
      const res = await advanceDelivery(advanceTarget.id, advanceTarget.status, extras);
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"));
        return;
      }
      toast.success(
        next ? t("advancedDetail", { status: t(`step.${next}` as "step.weighed") }) : t("advanced"),
      );
      setAdvanceTarget(null);
      await reload();
    } finally {
      setAdvancing(false);
    }
  };

  const sortedActive = useMemo(() => {
    return [...active].sort((a, b) => {
      const da = parseIsoDate(a.scheduledFor) ?? "9999-99-99";
      const db = parseIsoDate(b.scheduledFor) ?? "9999-99-99";
      return da.localeCompare(db);
    });
  }, [active]);

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
            {sortedActive.map((d) => {
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
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[16px] font-extrabold text-ink">
                          {d.farmerName ?? d.lotRegion ?? t("anonymousGrove")}
                        </p>
                        <Pill tone="warn">{t(`step.${d.status}` as "step.scheduled")}</Pill>
                      </div>
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        {[
                          parseIsoDate(d.scheduledFor)
                            ? new Date(`${parseIsoDate(d.scheduledFor)}T12:00:00`).toLocaleDateString(locale, {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })
                            : t("unscheduledShort"),
                          d.lotVariety ? varietyLabel(d.lotVariety) : null,
                          formatTons(d.tons, locale),
                          euroPrice(d.pricePerKg, locale),
                          d.lotRegion ? regionLabel(d.lotRegion, locale) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[22px] font-extrabold text-ink">
                        {euroTotal(saleTotal(d.tons, d.pricePerKg), locale)}
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
                      onClick={() => openAdvance(d)}
                    />
                    <ApButton
                      label={t("downloadReport")}
                      variant="outline"
                      icon={<Download className="size-4" />}
                      onClick={() => toast.message(t("downloadReportSoon"))}
                    />
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
                    <p className="text-[16px] font-extrabold text-ink">{d.farmerName ?? (d.lotRegion ? regionLabel(d.lotRegion, locale) : "—")}</p>
                    <p className="text-[13px] font-medium text-muted-foreground">
                      {[
                        d.lotVariety ? varietyLabel(d.lotVariety) : null,
                        formatTons(d.tons, locale),
                        euroPrice(d.pricePerKg, locale),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <p className="text-[16px] font-extrabold text-ink">{euroTotal(saleTotal(d.tons, d.pricePerKg), locale)}</p>
                </div>
              ))
            )}
          </Panel>
        </div>
      )}

      <Dialog
        open={advanceTarget != null}
        onClose={() => setAdvanceTarget(null)}
        title={t("advanceStepTitle")}
        subtitle={
          advanceTarget
            ? `${advanceTarget.farmerName ?? advanceTarget.lotRegion ?? ""} · ${advanceTarget.tons} t`
            : undefined
        }
        actionLabel={advancing ? t("loading") : t("advance")}
        actionDisabled={advancing}
        onAction={() => void onAdvanceConfirm()}
      >
        {advanceTarget?.status === "scheduled" ? (
          <>
            <TextField label={t("weighKgLabel")} value={weighKg} onChange={setWeighKg} suffix="kg" inputMode="decimal" />
            <p className="text-[12px] font-medium text-muted-foreground">{t("weighKgHint")}</p>
          </>
        ) : null}
        {advanceTarget?.status === "weighed" ? (
          <ChipGroup
            label={t("labResultLabel")}
            value={labOk}
            onChange={(v) => setLabOk(v as "passed" | "failed")}
            options={[
              { value: "passed", label: t("labPassed") },
              { value: "failed", label: t("labFailed") },
            ]}
          />
        ) : null}
        {advanceTarget?.status === "lab_checked" ? (
          <p className="text-[14px] font-medium text-muted-foreground">
            {t("confirmPaymentBody", {
              total: euroTotal(saleTotal(advanceTarget.tons, advanceTarget.pricePerKg), locale),
            })}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}

export function ProcessorLotDetailScreen({ id }: { id: string }) {
  const t = useTranslations("processor");
  const locale = useLocale();
  const varietyLabel = useVarietyLabel();
  const { lots, offers, loading, reload } = useProcessorMarket();
  const lot = lots.find((l) => l.id === id) ?? null;
  const placeById = useLotPlaceLabels(lot ? [lot] : []);
  const mapToken = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;
  const [tons, setTons] = useState("5");
  const [price, setPrice] = useState(String(DEMO_EXCHANGE));
  const [open, setOpen] = useState(false);
  const [arriveOn, setArriveOn] = useState(() => addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS));
  const offerWeek = useMemo(() => nextSevenDays(), []);

  const sent = offers.some(
    (o) => o.lotId === id && o.initiatedBy === "processor" && (o.status === "pending" || o.status === "countered"),
  );

  const submit = async () => {
    if (!lot?.farmerId) {
      toast.error(t("identityHidden"));
      return;
    }
    const deliveryInDays = Math.max(
      0,
      Math.round(
        (new Date(`${arriveOn}T12:00:00`).getTime() - new Date(`${todayIsoDate()}T12:00:00`).getTime()) / 86_400_000,
      ),
    );
    const res = await placeLotOffer({
      lotId: lot.id,
      farmerId: lot.farmerId,
      tons: Number(tons),
      pricePerKg: Number(price),
      deliveryInDays,
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
        title={`${varietyLabel(lot.variety)} · ${formatTons(lot.tons, locale)}`}
        subtitle={
          lot.status === "sold"
            ? t("lotDetailSubtitleSold")
            : lot.status === "reserved"
              ? t("lotDetailSubtitleReserved")
              : t("lotDetailSubtitle")
        }
        action={
          lot.status === "listed" ? (
            <ApButton
              label={sent ? t("offerSent") : t("makeOffer")}
              variant="dark"
              disabled={sent}
              onClick={() => {
                setTons(String(Math.min(5, lot.tons)));
                setPrice(String(lot.pricePerKg ?? DEMO_EXCHANGE));
                setArriveOn(addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS));
                setOpen(true);
              }}
            />
          ) : (
            <Pill tone={lot.status === "sold" ? "neutral" : "warn"}>
              {lot.status === "sold" ? t("soldStatus") : lot.status === "reserved" ? t("reservedStatus") : lot.status}
            </Pill>
          )
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
        <DayChipPicker
          label={t("arriveOn")}
          days={offerWeek}
          value={arriveOn}
          onChange={setArriveOn}
          formatDay={(iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { weekday: "short" })}
          todayLabel={t("todayShort")}
        />
      </Dialog>
    </div>
  );
}
