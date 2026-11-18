"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronLeft, MapPin } from "lucide-react";
import { publicEnv } from "@/core/config/env";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Pill } from "@/shared/components/brand/pill";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { euroPrice, euroTotal, saleTotal } from "@/features/marketplace/pricing";
import { varietyLabelFromStored } from "@/features/fields/olive-varieties";
import { LotsMap, type LotMapPoint } from "@/features/marketplace/lots-map";
import { regionLabel } from "@/features/marketplace/regions";
import { formatTons } from "@/features/marketplace/pricing";
import {
  DayChipPicker,
  Dialog,
  PageHeader,
  ScoreBox,
} from "@/features/marketplace/processor-kit";
import {
  DEFAULT_DELIVERY_IN_DAYS,
  addDaysIso,
  nextSevenDays,
  todayIsoDate,
} from "@/features/marketplace/schedule";
import {
  acceptIncomingOffer,
  counterIncomingOffer,
  harvestRangeLabel,
  lotPlaceLabel,
  rejectOffer,
  useProcessorMarket,
  type ProcessorOffer,
} from "@/features/marketplace/use-processor-market";

function formatDate(iso: string | null, locale: string) {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

function offerTagLabels(offer: ProcessorOffer, t: (key: string) => string): string[] {
  const lot = offer.lot;
  const out: string[] = [];
  if (lot?.negotiable) out.push(t("openToNegotiation"));
  if (lot?.deliveryMode === "pickup") out.push(t("factoryPickup"));
  if (lot?.deliveryMode === "deliver") out.push(t("farmerDelivers"));
  if (lot && !lot.hasBannedSpray) out.push(t("noBannedProducts"));
  if (lot?.labResult === "passed") out.push(t("labPassed"));
  return out;
}

export function ProcessorOfferDetailScreen({ id }: { id: string }) {
  const t = useTranslations("processor");
  const locale = useLocale();
  const router = useRouter();
  const { offers, requests, loading, error, reload } = useProcessorMarket();
  const offer = offers.find((o) => o.id === id) ?? null;
  const request = offer?.buyRequestId
    ? requests.find((r) => r.id === offer.buyRequestId) ?? null
    : null;

  const [busy, setBusy] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptDate, setAcceptDate] = useState(() => addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS));
  const weekDates = useMemo(() => nextSevenDays(), []);

  const actionable =
    offer != null &&
    offer.initiatedBy === "farmer" &&
    (offer.status === "pending" || offer.status === "countered");

  const onAcceptConfirm = async () => {
    if (!offer) return;
    setBusy(true);
    toast.message(t("accepting"));
    try {
      const res = await acceptIncomingOffer(offer.id, { scheduledFor: acceptDate });
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"));
        return;
      }
      toast.success(t("acceptedScheduled", { date: acceptDate }));
      setAcceptOpen(false);
      await reload();
      router.push("/processor/deliveries");
    } finally {
      setBusy(false);
    }
  };

  const onReject = async () => {
    if (!offer) return;
    if (!window.confirm(t("rejectConfirm"))) return;
    setBusy(true);
    try {
      const res = await rejectOffer(offer.id);
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"));
        return;
      }
      toast.success(t("rejectedOk"));
      await reload();
      router.push("/processor/offers");
    } finally {
      setBusy(false);
    }
  };

  const onCounter = async () => {
    if (!offer) return;
    const suggested = Math.max(0.05, Math.round((offer.pricePerKg - 0.05) * 100) / 100);
    const raw = window.prompt(t("counterPrompt"), String(suggested));
    if (raw == null) return;
    const next = Number(raw.replace(",", "."));
    if (!Number.isFinite(next) || next <= 0) {
      toast.error(t("invalidPrice"));
      return;
    }
    setBusy(true);
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
      setBusy(false);
    }
  };

  if (loading && !offer) {
    return (
      <div className="mx-auto w-full max-w-[760px] space-y-4 px-4 py-6">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-soft" />
        <div className="h-64 animate-pulse rounded-[22px] bg-soft" />
      </div>
    );
  }

  if (error === "needSupabase" || error === "needLogin") {
    return (
      <div className="mx-auto w-full max-w-[760px] px-4 py-6">
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">{t(error)}</ApCard>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="mx-auto w-full max-w-[760px] space-y-4 px-4 py-6">
        <Link
          href="/processor/offers"
          className="inline-flex items-center gap-1 text-[14px] font-bold text-ink"
        >
          <ChevronLeft className="size-4" />
          {t("backToOffers")}
        </Link>
        <ApCard className="p-6 text-center text-[14px] font-semibold text-muted-foreground">
          {t("offerNotFound")}
        </ApCard>
      </div>
    );
  }

  const lot = offer.lot;
  const place = lot ? lotPlaceLabel(lot, t("anonymousGrove")) : t("anonymousGrove");
  const variety = lot
    ? varietyLabelFromStored(lot.variety, locale)
    : request
      ? varietyLabelFromStored(request.variety, locale)
      : "—";
  const tags = offerTagLabels(offer, t);
  const harvest =
    lot?.harvestStart || lot?.harvestEnd
      ? harvestRangeLabel(lot.harvestStart, lot.harvestEnd, locale)
      : "—";
  const mapToken = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;
  const mapPoints: LotMapPoint[] =
    lot?.lat != null && lot?.lon != null
      ? [
          {
            id: offer.id,
            lat: lot.lat,
            lon: lot.lon,
            label: place,
            score: lot.qualityScore,
            title: `${variety} · ${formatTons(offer.tons, locale)}`,
            subtitle: place,
            priceLabel: `${euroPrice(offer.pricePerKg, locale)} /kg`,
            useLabel: lot.useType === "table" ? t("useTable") : t("useOil"),
            harvestLabel: harvest,
          },
        ]
      : [];

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-5 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <Link
          href="/processor/offers"
          aria-label={t("backToOffers")}
          className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <PageHeader title={t("offerDetailTitle")} subtitle={t("offerDetailPageHint")} />
      </div>

      <Dialog
        open={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        title={t("acceptScheduleTitle")}
        subtitle={t("acceptScheduleHint")}
        actionLabel={busy ? t("loading") : t("accept")}
        actionDisabled={busy}
        onAction={() => void onAcceptConfirm()}
      >
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
      </Dialog>

      <div>
        <p className="mb-2 text-[11px] font-bold tracking-[1px] text-muted-foreground uppercase">
          {t("pickupMapTitle")}
        </p>
        <p className="mb-2 text-[13px] text-muted-foreground">{t("pickupMapHint")}</p>
        <LotsMap
          token={mapToken}
          points={mapPoints}
          selectedId={mapPoints[0]?.id ?? null}
          onSelect={() => undefined}
          labels={{
            locate: t("mapLocate"),
            zoomIn: t("mapZoomIn"),
            zoomOut: t("mapZoomOut"),
            needToken: t("mapNeedToken"),
            empty: t("mapNoCoords"),
            qualityScore: t("qualityScore"),
            openLot: t("openOffer"),
          }}
          className="!h-[min(42vh,380px)] !min-h-[260px]"
        />
      </div>

      <ApCard className="overflow-hidden p-0">
        <div className="border-b border-line bg-soft/60 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold tracking-[1px] text-ap-accent uppercase">
                {offer.initiatedBy === "farmer" ? t("incomingOffers") : t("outgoingOffers")}
              </p>
              <h2 className="mt-1 text-[22px] font-extrabold text-ink">{place}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                {[lot?.town, lot?.region ? regionLabel(lot.region, locale) : null].filter(Boolean).join(", ") ||
                  (lot?.region ? regionLabel(lot.region, locale) : "—")}
              </p>
              <p className="mt-1 text-[12px] font-semibold text-muted-foreground">
                {t("identityHidden")}
              </p>
            </div>
            {lot?.qualityScore != null ? <ScoreBox score={lot.qualityScore} /> : null}
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div>
            <p className="text-[11px] font-bold tracking-[1px] text-muted-foreground uppercase">
              {offer.initiatedBy === "processor" ? t("yourOfferPrice") : t("asksPriceLabel")}
            </p>
            <p className="mt-1 text-[32px] leading-none font-extrabold text-ink">
              {euroPrice(offer.pricePerKg, locale)}
              <span className="ml-1 text-[14px] font-semibold text-muted-foreground">/kg</span>
            </p>
            <p className="mt-2 text-[14px] font-semibold text-muted-foreground">
              {t("approx", { total: euroTotal(saleTotal(offer.tons, offer.pricePerKg), locale) })} ·{" "}
              {offer.tons} t
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailCell label={t("variety")} value={variety} />
            <DetailCell label={t("tons")} value={formatTons(offer.tons, locale)} />
            <DetailCell label={t("harvestPeriod")} value={harvest} />
            <DetailCell
              label={t("harvestDatesExact")}
              value={`${formatDate(lot?.harvestStart ?? null, locale)} → ${formatDate(lot?.harvestEnd ?? null, locale)}`}
            />
            <DetailCell
              label={t("deliveryLabel")}
              value={
                lot?.deliveryMode === "deliver"
                  ? t("farmerDelivers")
                  : lot?.deliveryMode === "pickup"
                    ? t("factoryPickup")
                    : "—"
              }
            />
            <DetailCell
              label={t("negotiationLabel")}
              value={lot?.negotiable ? t("openToNegotiation") : t("fixedPrice")}
            />
            <DetailCell
              label={t("status")}
              value={
                offer.status === "pending"
                  ? t("pendingStatus")
                  : offer.status === "countered"
                    ? t("counteredStatus")
                    : offer.status
              }
            />
            {request ? (
              <DetailCell
                label={t("linkedRequest")}
                value={`${varietyLabelFromStored(request.variety, locale)} · ${request.tons} t`}
              />
            ) : null}
          </div>

          {tags.length > 0 ? (
            <div>
              <p className="mb-2 text-[11px] font-bold tracking-[1px] text-muted-foreground uppercase">
                {t("lotTags")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((label) => (
                  <Pill key={label} tone="good">
                    {label}
                  </Pill>
                ))}
              </div>
            </div>
          ) : null}

          {offer.message ? (
            <div className="rounded-xl bg-soft px-3 py-2.5">
              <p className="text-[11px] font-bold tracking-[1px] text-muted-foreground uppercase">
                {t("message")}
              </p>
              <p className="mt-1 text-[14px] text-ink">{offer.message}</p>
            </div>
          ) : null}

          {actionable ? (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <ApButton
                label={busy ? t("loading") : t("reject")}
                variant="outline"
                disabled={busy}
                onClick={() => void onReject()}
              />
              <ApButton
                label={busy ? t("loading") : t("counter")}
                variant="outline"
                disabled={busy}
                onClick={() => void onCounter()}
              />
              <ApButton
                label={busy ? t("loading") : t("accept")}
                variant="dark"
                disabled={busy}
                onClick={() => {
                  setAcceptDate(addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS));
                  setAcceptOpen(true);
                }}
              />
            </div>
          ) : offer.initiatedBy === "processor" &&
            (offer.status === "pending" || offer.status === "countered") ? (
            <Pill tone="warn">{t("waitingFarmerReply")}</Pill>
          ) : (
            <Pill tone="neutral">{t("offerClosed")}</Pill>
          )}
        </div>
      </ApCard>
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2.5">
      <p className="text-[11px] font-bold tracking-[1px] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-[15px] font-extrabold text-ink">{value}</p>
    </div>
  );
}
