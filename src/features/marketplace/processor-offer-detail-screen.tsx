"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { publicEnv } from "@/core/config/env";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Pill } from "@/shared/components/brand/pill";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { euroPrice, euroTotal, formatTons, saleTotal } from "@/features/marketplace/pricing";
import { varietyLabelFromStored } from "@/features/fields/olive-varieties";
import { LotsMap, type LotMapPoint } from "@/features/marketplace/lots-map";
import { regionLabel } from "@/features/marketplace/regions";
import {
  DayChipPicker,
  Dialog,
  PageHeader,
  TextField,
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

function offerQualityBadges(offer: ProcessorOffer, t: (key: string) => string): string[] {
  const lot = offer.lot;
  const out: string[] = [];
  if (lot && !lot.hasBannedSpray) out.push(t("noBannedProducts"));
  if (lot?.labResult === "passed") out.push(t("labPassed"));
  return out;
}

async function withdrawProcessorOffer(offerId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const { error } = await supabase
    .from("offers")
    .update({ status: "withdrawn" })
    .eq("id", offerId);
  return error ? { ok: false, error: error.message } : { ok: true };
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
  const [acceptDate, setAcceptDate] = useState(() =>
    addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS),
  );
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterPrice, setCounterPrice] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const weekDates = useMemo(() => nextSevenDays(), []);

  const incomingActionable =
    offer != null && offer.initiatedBy === "farmer" && offer.status === "pending";
  const outgoingWithdrawable =
    offer != null && offer.initiatedBy === "processor" && offer.status === "pending";

  const onAcceptConfirm = async () => {
    if (!offer) return;
    setBusy(true);
    const toastId = toast.loading(t("accepting"));
    try {
      const res = await acceptIncomingOffer(offer.id, { scheduledFor: acceptDate });
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"), { id: toastId });
        return;
      }
      const dateLabel = new Date(`${acceptDate}T12:00:00`).toLocaleDateString(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      toast.success(t("acceptedScheduled", { date: dateLabel }), { id: toastId });
      setAcceptOpen(false);
      await reload();
      router.push("/processor/deliveries");
    } finally {
      setBusy(false);
    }
  };

  const onRejectConfirm = async () => {
    if (!offer) return;
    setBusy(true);
    try {
      const res = await rejectOffer(offer.id);
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"));
        return;
      }
      toast.success(t("rejectedOk"));
      setRejectOpen(false);
      await reload();
      router.push("/processor/offers");
    } finally {
      setBusy(false);
    }
  };

  const openCounterDialog = () => {
    if (!offer) return;
    const suggested = Math.max(0.05, Math.round((offer.pricePerKg - 0.05) * 100) / 100);
    setCounterPrice(String(suggested));
    setCounterOpen(true);
  };

  const onCounterConfirm = async () => {
    if (!offer) return;
    const next = Number(counterPrice.replace(",", "."));
    if (!Number.isFinite(next) || next <= 0) {
      toast.error(t("invalidPrice"));
      return;
    }
    setBusy(true);
    const toastId = toast.loading(t("countering"));
    try {
      const res = await counterIncomingOffer(offer, next);
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"), { id: toastId });
        return;
      }
      toast.success(t("counterSentDetail"), { id: toastId });
      setCounterOpen(false);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const onWithdrawConfirm = async () => {
    if (!offer) return;
    setBusy(true);
    try {
      const res = await withdrawProcessorOffer(offer.id);
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"));
        return;
      }
      toast.success(t("withdrawnOk"));
      setWithdrawOpen(false);
      await reload();
      router.push("/processor/offers");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !offer) {
    return (
      <div className="mx-auto w-full max-w-[1200px] space-y-4 px-4 py-6 sm:px-6">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-soft" />
        <div className="h-64 animate-pulse rounded-[22px] bg-soft" />
      </div>
    );
  }

  if (error === "needSupabase" || error === "needLogin") {
    return (
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">{t(error)}</ApCard>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="mx-auto w-full max-w-[1200px] space-y-4 px-4 py-6 sm:px-6">
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
  const place = lot
    ? lotPlaceLabel(
        {
          town: lot.town,
          region: regionLabel(lot.region, locale),
          farmerDisplayName: lot.farmerDisplayName,
        },
        t("anonymousGrove"),
      )
    : t("anonymousGrove");
  const variety = lot
    ? varietyLabelFromStored(lot.variety, locale)
    : request
      ? varietyLabelFromStored(request.variety, locale)
      : "—";
  const qualityBadges = offerQualityBadges(offer, t);
  const harvest =
    lot?.harvestStart || lot?.harvestEnd
      ? harvestRangeLabel(lot?.harvestStart ?? null, lot?.harvestEnd ?? null, locale)
      : "—";

  const formattedPrice = `${euroPrice(offer.pricePerKg, locale)}/kg`;
  const formattedTons = formatTons(offer.tons, locale);
  const formattedTotal = euroTotal(saleTotal(offer.tons, offer.pricePerKg), locale);
  const summaryLine = `${variety} · ${formattedTons} · ${formattedPrice} · ≈ ${formattedTotal}`;

  const parsedCounter = Number(counterPrice.replace(",", "."));
  const counterPreview =
    Number.isFinite(parsedCounter) && parsedCounter > 0
      ? euroTotal(saleTotal(offer.tons, parsedCounter), locale)
      : "—";

  const statusLabel =
    offer.status === "pending"
      ? t("pendingStatus")
      : offer.status === "countered"
        ? t("counteredStatus")
        : offer.status === "accepted"
          ? t("acceptedStatus")
          : offer.status === "rejected"
            ? t("rejectedStatus")
            : offer.status === "withdrawn"
              ? t("withdrawnStatus")
              : offer.status;

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
            title: `${variety} · ${formattedTons}`,
            subtitle: place,
            priceLabel: formattedPrice,
            useLabel: lot.useType === "table" ? t("useTable") : t("useOil"),
            harvestLabel: harvest,
          },
        ]
      : [];

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <Link
          href="/processor/offers"
          aria-label={t("backToOffers")}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-card"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <PageHeader title={t("offerDetailTitle")} subtitle={t("offerDetailPageHint")} />
      </div>

      {/* Διάλογος Αποδοχής */}
      <Dialog
        open={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        title={t("acceptOfferDialogTitle")}
        actionLabel={busy ? t("loading") : t("accept")}
        actionDisabled={busy}
        onAction={() => void onAcceptConfirm()}
      >
        <div className="rounded-xl bg-soft px-3.5 py-2.5 text-[14px] font-extrabold text-ink">
          {summaryLine}
        </div>
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

      {/* Διάλογος Αντιπροσφοράς */}
      <Dialog
        open={counterOpen}
        onClose={() => setCounterOpen(false)}
        title={t("counterDialogTitle")}
        subtitle={t("counterDialogHint")}
        actionLabel={busy ? t("loading") : t("counter")}
        actionDisabled={busy}
        onAction={() => void onCounterConfirm()}
      >
        <TextField
          label={t("price")}
          value={counterPrice}
          onChange={setCounterPrice}
          suffix="€/kg"
          inputMode="decimal"
        />
        <p className="text-[13px] font-semibold text-muted-foreground">
          {t("offerTotalPreview", { total: counterPreview })} · {formattedTons}
        </p>
      </Dialog>

      {/* Διάλογος Απόρριψης */}
      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={t("rejectDialogTitle")}
        subtitle={t("rejectConfirm")}
        actionLabel={busy ? t("loading") : t("reject")}
        actionDisabled={busy}
        onAction={() => void onRejectConfirm()}
      >
        <p className="text-[13px] font-medium text-muted-foreground">{summaryLine}</p>
      </Dialog>

      {/* Διάλογος Απόσυρσης (για outgoing processor offers) */}
      <Dialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title={t("withdrawOffer")}
        subtitle={t("withdrawOfferConfirm")}
        actionLabel={busy ? t("loading") : t("withdrawOffer")}
        actionDisabled={busy}
        onAction={() => void onWithdrawConfirm()}
      >
        <p className="text-[13px] font-medium text-muted-foreground">{summaryLine}</p>
      </Dialog>

      {/* Κύρια διάταξη: Κινητό = κάρτα τιμής πρώτη, Desktop = 2 στήλες [1fr_360px] με sticky δεξιά κάρτα */}
      <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[1fr_360px] min-[900px]:items-start">
        {/* Δεξιά στήλη στο desktop / Πρώτη κάρτα στο κινητό: Τιμή, Βαθμολογία, Σύνολο & Ενέργειες */}
        <ApCard className="space-y-4 p-5 min-[900px]:sticky min-[900px]:top-6 min-[900px]:col-start-2 min-[900px]:row-start-1">
          <div>
            <p className="text-[11px] font-bold tracking-[1px] text-muted-foreground uppercase">
              {offer.initiatedBy === "processor" ? t("yourOfferPrice") : t("asksPriceLabel")}
            </p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px] font-bold text-ink">
              <span className="text-[28px] leading-none font-extrabold text-ink">
                {formattedPrice}
              </span>
              {lot?.qualityScore != null ? (
                <span>
                  · {t("scoreInline", { score: lot.qualityScore })}
                </span>
              ) : null}
              <span className="text-muted-foreground">
                · {t("totalForTons", { total: formattedTotal, tons: formattedTons })}
              </span>
            </p>
          </div>

          {incomingActionable ? (
            <div className="space-y-2 border-t border-line pt-4">
              <ApButton
                label={busy ? t("loading") : t("accept")}
                variant="primary"
                disabled={busy}
                className="h-12 w-full"
                onClick={() => {
                  setAcceptDate(addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS));
                  setAcceptOpen(true);
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <ApButton
                  label={busy ? t("loading") : t("counter")}
                  variant="outline"
                  disabled={busy}
                  className="w-full"
                  onClick={openCounterDialog}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRejectOpen(true)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full px-4 text-ap-btn text-risk transition-colors hover:bg-risk-soft/60 disabled:opacity-50"
                >
                  {busy ? t("loading") : t("reject")}
                </button>
              </div>
            </div>
          ) : outgoingWithdrawable ? (
            <div className="space-y-3 border-t border-line pt-4">
              <Pill tone="warn">{t("waitingFarmerReply")}</Pill>
              <ApButton
                label={busy ? t("loading") : t("withdrawOffer")}
                variant="outline"
                disabled={busy}
                className="w-full"
                onClick={() => setWithdrawOpen(true)}
              />
            </div>
          ) : (
            <div className="border-t border-line pt-4">
              <Pill tone={offer.status === "accepted" ? "good" : "neutral"}>
                {t("offerClosed")}
              </Pill>
            </div>
          )}
        </ApCard>

        {/* Αριστερή στήλη: Στοιχεία παρτίδας, Χαρακτηριστικά & Χάρτης */}
        <div className="space-y-5 min-[900px]:col-start-1 min-[900px]:row-start-1">
          <ApCard className="overflow-hidden p-0">
            <div className="border-b border-line bg-soft/60 px-5 py-4">
              <p className="text-[11px] font-bold tracking-[1px] text-ap-accent uppercase">
                {offer.initiatedBy === "farmer" ? t("tabIncoming") : t("tabOutgoing")}
              </p>
              <h2 className="mt-1 text-[22px] font-extrabold text-ink">{place}</h2>
              {!lot?.farmerDisplayName ? (
                <p className="mt-1 text-[12px] font-semibold text-muted-foreground">
                  {t("identityHidden")}
                </p>
              ) : null}
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailCell label={t("variety")} value={variety} />
                <DetailCell label={t("tons")} value={formattedTons} />
                <DetailCell label={t("harvestLabel")} value={harvest} />
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
                <DetailCell label={t("status")} value={statusLabel} />
                {request ? (
                  <DetailCell
                    label={t("linkedRequest")}
                    value={`${varietyLabelFromStored(request.variety, locale)} · ${formatTons(request.tons, locale)}`}
                  />
                ) : null}
              </div>

              {qualityBadges.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {qualityBadges.map((label) => (
                    <Pill key={label} tone="good">
                      {label}
                    </Pill>
                  ))}
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
            </div>
          </ApCard>

          <div>
            <p className="mb-2 text-[11px] font-bold tracking-[1px] text-muted-foreground uppercase">
              {t("pickupMapTitle")}
            </p>
            <LotsMap
              token={mapToken}
              points={mapPoints}
              selectedId={mapPoints[0]?.id ?? null}
              onSelect={() => undefined}
              preview={false}
              labels={{
                locate: t("mapLocate"),
                zoomIn: t("mapZoomIn"),
                zoomOut: t("mapZoomOut"),
                needToken: t("mapNeedToken"),
                empty: t("mapNoCoords"),
                qualityScore: t("qualityScore"),
                openLot: t("openOffer"),
              }}
              className="!h-[240px] !min-h-[240px]"
            />
          </div>
        </div>
      </div>
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