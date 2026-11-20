"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Pill } from "@/shared/components/brand/pill";
import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { euroPrice, euroTotal, formatTons, saleTotal } from "@/features/marketplace/pricing";
import {
  defaultVarietySlug,
  marketplaceVarietyOptions,
  resolveOliveCountry,
} from "@/features/fields/olive-varieties";
import {
  ChipGroup,
  DayChipPicker,
  Dialog,
  Initials,
  initialsOf,
  PageHeader,
  Panel,
  TextField,
} from "./processor-kit";
import { marketRegionOptions, regionLabel } from "./regions";
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
} from "./use-processor-market";
import { useVarietyLabel } from "./processor-shared";

const SCORE_OPTIONS = ["70", "75", "80", "85"] as const;
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
