"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Gauge,
  Inbox,
  MapPin,
  Plus,
  Scale,
  Search,
  Truck,
  Wheat,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Pill } from "@/shared/components/brand/pill";
import { Link, useRouter } from "@/shared/i18n/navigation";
import {
  formatEuro,
  formatEuroPerKg,
  formatTons,
  saleTotal,
  MARKET_LIMITS,
  parseBounded,
} from "@/features/marketplace/pricing";
import { trustBadges } from "@/features/marketplace/badges";
import { canAdvanceDelivery } from "@/features/marketplace/delivery-state";
import {
  DayChipPicker,
  Dialog,
  EmptyBlock,
  LotBadges,
  LotRow,
  Panel,
  ScoreBox,
  StatCard,
  WeekStrip,
  type LotBadge,
  type WeekDayCell,
  useAsyncDialog,
} from "./processor-kit";
import { regionLabel } from "./regions";
import {
  DAY_CAPACITY_TONS,
  DEFAULT_DELIVERY_IN_DAYS,
  addDaysIso,
  nextSevenDays,
  parseIsoDate,
  todayIsoDate,
} from "./schedule";
import {
  acceptIncomingOffer,
  counterIncomingOffer,
  lotPlaceLabel,
  rejectOffer,
  scheduleDelivery,
  useProcessorMarket,
  type ProcessorDelivery,
  type ProcessorLot,
  type ProcessorOffer,
} from "./use-processor-market";
import { useVarietyLabel } from "./processor-shared";
import { useBoundsMessage, useErrorMessage } from "@/shared/lib/error-message";

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

/** `now` is null during SSR/hydration (server runs in UTC), so greeting and date render only on the client. */
function overviewGreeting(locale: string, company: string, now: Date | null) {
  const hour = now?.getHours() ?? 12;
  const hello =
    hour < 12 ? "greetingMorning" : hour < 18 ? "greetingAfternoon" : "greetingEvening";
  const date = now
    ? now.toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "\u00a0";
  return { hello, company, date };
}

function titleCaseName(name: string) {
  return name
    .toLocaleLowerCase("el-GR")
    .replace(/(^|[\s/-])\S/g, (ch) => ch.toLocaleUpperCase("el-GR"));
}

function SupplyWeekBars({
  weekTons,
  labels,
  globalMax,
  compact = false,
}: {
  weekTons: [number, number, number, number];
  labels: [string, string, string, string];
  globalMax: number;
  compact?: boolean;
}) {
  const locale = useLocale();
  const max = Math.max(1, globalMax);
  if (compact) {
    return (
      <div className="flex h-8 items-end gap-1">
        {weekTons.map((tons, i) => (
          <div key={labels[i]} className="flex h-full w-3 items-end rounded-sm bg-soft" title={formatTons(tons, locale)}>
            {tons > 0 ? (
              <div
                className="w-full rounded-sm bg-good"
                style={{ height: `${Math.max(12, Math.round((tons / max) * 100))}%` }}
              />
            ) : null}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-4 gap-2">
      {weekTons.map((tons, i) => (
        <div key={labels[i]} className="flex flex-col items-center gap-1.5">
          <div className="flex h-14 w-full items-end justify-center rounded-md bg-soft px-1 pb-1">
            {tons > 0 ? (
              <div
                className="w-full max-w-[28px] rounded-sm bg-good"
                style={{ height: `${Math.max(6, Math.round((tons / max) * 100))}%` }}
                title={formatTons(tons, locale)}
              />
            ) : null}
          </div>
          <span className="text-[12px] font-semibold text-muted-foreground">{labels[i]}</span>
          <span className="text-[12px] font-bold text-ink">{tons > 0 ? formatTons(tons, locale) : "–"}</span>
        </div>
      ))}
    </div>
  );
}

export function ProcessorOverviewScreen() {
  const t = useTranslations("processor");
  const errMsg = useErrorMessage();
  const boundsMsg = useBoundsMessage();
  const { confirm: confirmDialog, prompt: promptDialog, dialog: asyncDialog } = useAsyncDialog();
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
  const [showAllSupply, setShowAllSupply] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const greet = overviewGreeting(locale, company, now);
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
    const toastId = toast.loading(t("accepting"));
    try {
      const res = await acceptIncomingOffer(acceptOffer.id, { scheduledFor: acceptDate });
      if (!res.ok) {
        toast.error(errMsg(res.error, "saveFailed"), { id: toastId });
        return;
      }
      toast.success(t("acceptedScheduled", { date: new Date(`${acceptDate}T12:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" }) }), { id: toastId });
      setAcceptOffer(null);
      setSelectedDay(acceptDate);
      await reload();
    } finally {
      setBusyOfferId(null);
    }
  };

  const onCounter = async (offer: ProcessorOffer) => {
    const suggested = Math.max(0.05, Math.round((offer.pricePerKg - 0.05) * 100) / 100);
    const raw = await promptDialog(t("counterPrompt"), String(suggested).replace(".", ","));
    if (raw == null) {
      toast.message(t("counterCancelled"));
      return;
    }
    const pc = parseBounded(raw, MARKET_LIMITS.pricePerKg);
    if (!pc.ok) {
      toast.error(boundsMsg(pc, "price", locale));
      return;
    }
    const next = pc.value;
    setBusyOfferId(offer.id);
    const toastId = toast.loading(t("countering"));
    try {
      const res = await counterIncomingOffer(offer, next);
      if (!res.ok) {
        toast.error(errMsg(res.error, "saveFailed"), { id: toastId });
        return;
      }
      toast.success(t("counterSentDetail"), { id: toastId });
      await reload();
    } finally {
      setBusyOfferId(null);
    }
  };

  const onReject = async (offer: ProcessorOffer) => {
    if (!(await confirmDialog(t("rejectConfirm")))) return;
    setBusyOfferId(offer.id);
    try {
      const res = await rejectOffer(offer.id);
      if (!res.ok) {
        toast.error(errMsg(res.error, "saveFailed"));
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
        deliveryCount: dayDeliveries.length,
        chips: [],
      };
    });
  }, [weekDates, openDeliveries, locale]);

  const supplyGlobalMax = useMemo(
    () => Math.max(1, ...supply.flatMap((row) => row.weekTons)),
    [supply],
  );
  const supplyRows = showAllSupply ? supply : supply.slice(0, 3);

  const selectedDayDeliveries = selectedDay
    ? openDeliveries.filter((d) => parseIsoDate(d.scheduledFor) === selectedDay)
    : [];

  const onAdvanceFromDay = async (d: ProcessorDelivery) => {
    if (!canAdvanceDelivery(d.status, d.labResult)) return;
    // Weighbridge / lab need inputs — open the Deliveries page for the confirm dialog.
    router.push("/processor/deliveries");
  };

  const onQuickSchedule = async (deliveryId: string, iso: string) => {
    setSchedulingId(deliveryId);
    try {
      const res = await scheduleDelivery(deliveryId, iso);
      if (!res.ok) {
        toast.error(errMsg(res.error, "saveFailed"));
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
      {asyncDialog}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[240px] shrink">
          <p className="text-[13px] font-semibold text-muted-foreground capitalize">{greet.date}</p>
          <h1 className="mt-1 text-[32px] leading-[38px] font-extrabold text-ink">
            {t(greet.hello as "greetingMorning", { name: company })}
          </h1>
          <p className="mt-1 text-[16px] leading-5 font-medium text-muted-foreground">{t("overviewSubtitle")}</p>
        </div>
        <Link href="/processor/lots" className="hidden min-[900px]:block">
          <ApButton label={tNav("findOlives")} variant="dark" icon={<Search className="size-4" />} />
        </Link>
      </div>

      {error === "needSupabase" || error === "needLogin" ? (
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">{t(error)}</ApCard>
      ) : null}

      <div className="grid grid-cols-2 gap-3 min-[900px]:flex min-[900px]:flex-wrap">
        <StatCard
          href="#incoming-offers"
          label={t("kpiOffers")}
          value={loading ? "…" : String(incoming.length)}
          hint={t("waitingAnswer")}
          icon={<Inbox className="size-[18px]" />}
          iconTone={incoming.length > 0 ? "warn" : "soft"}
          attention={incoming.length > 0}
        />
        <StatCard
          href="/processor/requests"
          label={t("kpiRequests")}
          value={loading ? "…" : String(openRequests.length)}
          hint={t("waitingFarmers")}
          icon={<ClipboardList className="size-[18px]" />}
          iconTone="accent"
        />
        <StatCard
          href="/processor/deliveries"
          label={t("kpiDeliveriesWeek")}
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
          legendScheduled={t("weekLegendScheduled")}
          legendOverloaded={t("weekLegendOverloaded")}
          deliveriesLabel={(count) => t("deliveriesCount", { count })}
        />

        {selectedDay ? (
          <ApCard className="overflow-hidden">
            {selectedDayDeliveries.length === 0 ? (
              <p className="px-4 py-3 text-[13px] font-semibold text-muted-foreground">{t("dayDetailEmpty")}</p>
            ) : (
              <>
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
                      {t("dayDetailTons", {
                        n: selectedDayDeliveries.reduce((s, d) => s + d.tons, 0),
                        count: selectedDayDeliveries.length,
                      })}
                    </p>
                  </div>
                  <Link href="/processor/deliveries" className="text-[12px] font-bold text-ink hover:underline">
                    {t("seeAllDeliveries")}
                  </Link>
                </div>
                {selectedDayDeliveries.map((d) => {
                  const nextLabel =
                    d.status === "scheduled"
                      ? t("recordWeighbridge")
                      : d.status === "weighed"
                        ? t("markLab")
                        : d.status === "lab_checked"
                          ? t("markPaid")
                          : t("advance");
                  const farmer =
                    d.farmerName
                      ? titleCaseName(d.farmerName)
                      : d.lotRegion
                        ? regionLabel(d.lotRegion, locale)
                        : t("anonymousGrove");
                  return (
                    <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-extrabold text-ink">{farmer}</p>
                        <p className="text-[12px] font-medium text-muted-foreground">
                          {[
                            d.lotVariety ? varietyLabel(d.lotVariety) : null,
                            formatTons(d.tons, locale),
                            t(`step.${d.status}` as "step.scheduled"),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-extrabold text-ink">
                          {formatEuro(saleTotal(d.tons, d.pricePerKg), locale)}
                        </span>
                        {canAdvanceDelivery(d.status, d.labResult) ? (
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
                })}
              </>
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
                  <p className="text-[14px] font-extrabold text-ink">
                    {d.farmerName
                      ? titleCaseName(d.farmerName)
                      : d.lotRegion
                        ? regionLabel(d.lotRegion, locale)
                        : t("anonymousGrove")}
                  </p>
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
                      className="rounded-full border border-line bg-card px-2.5 py-1 text-[12px] font-bold text-ink hover:bg-soft disabled:opacity-50"
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
        onAction={() => onAcceptConfirm()}
      >
        {acceptOffer ? (
          <div className="mb-4 space-y-2 rounded-xl bg-soft p-3">
            <p className="text-[15px] font-extrabold text-ink">
              {acceptOffer.lot
                ? lotPlaceLabel(acceptOffer.lot, t("anonymousGrove"), undefined, locale)
                : t("anonymousGrove")}
            </p>
            <p className="text-[13px] font-medium text-muted-foreground">
              {acceptOffer.lot
                ? t("incomingSub", {
                    variety: varietyLabel(acceptOffer.lot.variety),
                    tons: acceptOffer.tons,
                    region: regionLabel(acceptOffer.lot.region, locale),
                  })
                : formatTons(acceptOffer.tons, locale)}
            </p>
            <p className="text-[18px] font-extrabold text-ink">
              {formatEuroPerKg(acceptOffer.pricePerKg, locale)}
              <span className="ml-2 text-[12px] font-semibold text-muted-foreground">
                {t("approx", { total: formatEuro(saleTotal(acceptOffer.tons, acceptOffer.pricePerKg), locale) })}
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
                const place = lot ? lotPlaceLabel(lot, t("anonymousGrove"), undefined, locale) : t("anonymousGrove");
                const badges = lot ? lotBadgesFor(lot, t) : [];
                const priceLine = `${formatEuroPerKg(offer.pricePerKg, locale)} · ${t("approx", {
                  total: formatEuro(saleTotal(offer.tons, offer.pricePerKg), locale),
                })}`;
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
                            region: regionLabel(lot.region, locale),
                          })
                        : formatTons(offer.tons, locale)
                    }
                    badges={<LotBadges badges={badges} max={3} />}
                    score={lot?.qualityScore != null ? <ScoreBox score={lot.qualityScore} /> : <span />}
                    value={<span className="text-[14px] font-extrabold text-ink">{priceLine}</span>}
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
                const place = lot ? lotPlaceLabel(lot, t("anonymousGrove"), undefined, locale) : t("anonymousGrove");
                return (
                  <div key={offer.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
                    <div>
                      <p className="text-[15px] font-extrabold text-ink">{place}</p>
                      <p className="text-[12px] font-medium text-muted-foreground">
                        {t("waitingFarmerAnswer", {
                          price: formatEuro(offer.pricePerKg, locale),
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
            right={
              <Link href="/processor/deliveries" className="text-[12px] font-bold text-ink hover:underline">
                {t("seeAllDeliveries")}
              </Link>
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
                const farmer =
                  d.farmerName
                    ? titleCaseName(d.farmerName)
                    : d.lotRegion
                      ? regionLabel(d.lotRegion, locale)
                      : t("anonymousGrove");
                return (
                  <div key={d.id} className="border-t border-line px-4 py-3">
                    <p className="text-[14px] font-extrabold text-ink">{farmer}</p>
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
                    <p className="mt-1 text-[13px] font-extrabold text-ink">
                      {formatEuro(saleTotal(d.tons, d.pricePerKg), locale)}
                    </p>
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
          <>
            {/* Mobile compact rows */}
            <div className="space-y-2 border-t border-line p-3 min-[640px]:hidden">
              {supplyRows.map((row) => {
                const total = row.weekTons.reduce((a, b) => a + b, 0);
                return (
                  <div
                    key={row.region}
                    className="flex h-16 items-center justify-between gap-3 rounded-[14px] border border-line bg-background px-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-extrabold text-ink">{regionLabel(row.region, locale)}</p>
                      <p className="text-[12px] font-medium text-muted-foreground">{formatTons(total, locale)}</p>
                    </div>
                    <SupplyWeekBars weekTons={row.weekTons} labels={weekLabels} globalMax={supplyGlobalMax} compact />
                  </div>
                );
              })}
              {supply.length > 3 ? (
                <button
                  type="button"
                  onClick={() => setShowAllSupply((v) => !v)}
                  className="w-full rounded-full border border-line px-3 py-2 text-[13px] font-bold text-ink hover:bg-soft"
                >
                  {showAllSupply ? t("clearFilters") : t("seeAllRegions")}
                </button>
              ) : null}
            </div>

            {/* Desktop cards */}
            <div className="hidden gap-3 border-t border-line p-4 min-[640px]:grid min-[640px]:grid-cols-2">
              {supply.map((row) => {
                const total = row.weekTons.reduce((a, b) => a + b, 0);
                return (
                  <div key={row.region} className="rounded-[16px] border border-line bg-background p-4">
                    <div>
                      <p className="text-[15px] font-extrabold text-ink">{regionLabel(row.region, locale)}</p>
                      <p className="text-[12px] font-medium text-muted-foreground">
                        {t("regionTotalTonsLabel", { tons: formatTons(total, locale) })}
                      </p>
                    </div>
                    <SupplyWeekBars weekTons={row.weekTons} labels={weekLabels} globalMax={supplyGlobalMax} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Panel>

      {lots.length === 0 && !loading ? (
        <p className="text-[12px] font-medium text-muted-foreground">{t("lotsEmptyHint")}</p>
      ) : null}
    </div>
  );
}
