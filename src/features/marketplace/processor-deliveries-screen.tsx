"use client";

import { useMemo, useState } from "react";
import {
  Download,
  Euro,
  Gauge,
  Scale,
  ShieldCheck,
  Wheat,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Pill } from "@/shared/components/brand/pill";
import { StatusSteps } from "@/shared/components/brand/status-steps";
import { cn } from "@/shared/lib/utils";
import { euroPrice, euroTotal, formatTons, saleTotal } from "@/features/marketplace/pricing";
import { canAdvanceDelivery, deliveryStepIndex, nextDeliveryStatus } from "@/features/marketplace/delivery-state";
import {
  ChipGroup,
  Dialog,
  PageHeader,
  Panel,
  Segmented,
  StatCard,
  TextField,
} from "./processor-kit";
import { regionLabel } from "./regions";
import { parseIsoDate } from "./schedule";
import {
  advanceDelivery,
  useProcessorMarket,
} from "./use-processor-market";
import { useVarietyLabel } from "./processor-shared";

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
