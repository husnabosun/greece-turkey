"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Calendar,
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
import {
  canAdvanceDelivery,
  deliveryStepIndex,
  nextDeliveryStatus,
} from "@/features/marketplace/delivery-state";
import {
  ChipGroup,
  DayChipPicker,
  Dialog,
  PageHeader,
  Panel,
  Segmented,
  TextField,
} from "./processor-kit";
import { regionLabel } from "./regions";
import {
  DEFAULT_DELIVERY_IN_DAYS,
  addDaysIso,
  nextSevenDays,
  parseIsoDate,
  todayIsoDate,
} from "./schedule";
import {
  advanceDelivery,
  scheduleDelivery,
  useProcessorMarket,
  type ProcessorDelivery,
} from "./use-processor-market";
import { useVarietyLabel } from "./processor-shared";

function effectiveTons(d: ProcessorDelivery): number {
  return d.actualKg != null && d.actualKg > 0 ? d.actualKg / 1000 : d.tons;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function localeTag(locale: string): string {
  if (locale.startsWith("el")) return "el-GR";
  if (locale.startsWith("tr")) return "tr-TR";
  return "en-GB";
}

function capitalize(str: string, tag: string): string {
  if (!str) return str;
  return str[0].toLocaleUpperCase(tag) + str.slice(1);
}

export function ProcessorDeliveriesScreen() {
  const t = useTranslations("processor");
  const locale = useLocale();
  const tag = localeTag(locale);
  const varietyLabel = useVarietyLabel();
  const { deliveries, loading, error, reload } = useProcessorMarket();
  const [tab, setTab] = useState<"active" | "completed">("active");

  const deliverySteps = useMemo(
    () => [t("step.scheduled"), t("step.weighed"), t("step.lab_checked"), t("step.paid")],
    [t],
  );

  const active = deliveries.filter((d) => d.status !== "paid" && d.status !== "cancelled");
  const completed = deliveries.filter((d) => d.status === "paid");

  const tonnesBought = completed.reduce((s, d) => s + effectiveTons(d), 0);
  const totalSpent = completed.reduce(
    (s, d) => s + saleTotal(effectiveTons(d), d.pricePerKg),
    0,
  );
  const scoredCompleted = completed.filter((d) => d.qualityScoreSnapshot != null);
  const avgQuality =
    scoredCompleted.length === 0
      ? null
      : Math.round(
          scoredCompleted.reduce((s, d) => s + (d.qualityScoreSnapshot as number), 0) /
            scoredCompleted.length,
        );
  const bannedFreeShare =
    completed.length === 0
      ? null
      : Math.round(
          (completed.filter((d) => d.bannedFree !== false).length / completed.length) * 100,
        );

  const [advanceTarget, setAdvanceTarget] = useState<ProcessorDelivery | null>(null);
  const [weighKg, setWeighKg] = useState("");
  const [labOk, setLabOk] = useState<"passed" | "failed">("passed");
  const [advancing, setAdvancing] = useState(false);

  const [scheduleTarget, setScheduleTarget] = useState<ProcessorDelivery | null>(null);
  const [scheduleDate, setScheduleDate] = useState(() =>
    addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS),
  );
  const [scheduling, setScheduling] = useState(false);
  const weekDates = useMemo(() => nextSevenDays(), []);

  const openAdvance = (d: ProcessorDelivery) => {
    setAdvanceTarget(d);
    setWeighKg(
      String(d.actualKg != null ? Math.round(d.actualKg) : Math.round(d.tons * 1000)),
    );
    setLabOk("passed");
  };

  const openSchedule = (d: ProcessorDelivery) => {
    setScheduleTarget(d);
    setScheduleDate(
      parseIsoDate(d.scheduledFor) ?? addDaysIso(todayIsoDate(), DEFAULT_DELIVERY_IN_DAYS),
    );
  };

  const onScheduleConfirm = async () => {
    if (!scheduleTarget) return;
    setScheduling(true);
    try {
      const res = await scheduleDelivery(scheduleTarget.id, scheduleDate);
      if (!res.ok) {
        toast.error(res.error ?? t("saveFailed"));
        return;
      }
      toast.success(t("deliveryScheduled", { date: scheduleDate }));
      setScheduleTarget(null);
      await reload();
    } finally {
      setScheduling(false);
    }
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
        next
          ? t("advancedDetail", { status: t(`step.${next}` as "step.weighed") })
          : t("advanced"),
      );
      setAdvanceTarget(null);
      await reload();
    } finally {
      setAdvancing(false);
    }
  };

  const downloadTraceabilityReport = (d: ProcessorDelivery) => {
    const grower = d.farmerName ?? d.lotRegion ?? t("anonymousGrove");
    const variety = d.lotVariety ? varietyLabel(d.lotVariety) : "—";
    const region = d.lotRegion ? regionLabel(d.lotRegion, locale) : "—";
    const tons = effectiveTons(d);
    const total = euroTotal(saleTotal(tons, d.pricePerKg), locale);
    const scheduled = parseIsoDate(d.scheduledFor) ?? t("unscheduledShort");
    const statusText = t(`step.${d.status}` as "step.scheduled");
    const scoreText = d.qualityScoreSnapshot != null ? `${d.qualityScoreSnapshot} / 100` : "—";
    const euCompliance =
      d.bannedFree === false ? t("sprayNotApproved") : t("noBannedProducts");

    const html = `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8" />
  <title>AgroPulse Traceability — ${escapeHtml(d.id.slice(0, 8))}</title>
  <style>
    body { font-family: Inter, system-ui, -apple-system, sans-serif; color: #11181c; max-width: 680px; margin: 32px auto; padding: 0 20px; }
    .header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #11181c; padding-bottom: 12px; }
    h1 { font-size: 22px; margin: 0; }
    .meta { color: #5b6670; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; }
    .cell { border: 1px solid #e4e7ec; border-radius: 12px; padding: 12px; }
    .label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #5b6670; letter-spacing: 0.05em; }
    .val { font-size: 16px; font-weight: 800; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>AgroPulse · Traceability Report</h1>
    <span class="meta">ID: ${escapeHtml(d.id)}</span>
  </div>
  <div class="grid">
    <div class="cell"><div class="label">${escapeHtml(t("deliveriesTitle"))}</div><div class="val">${escapeHtml(grower)}</div></div>
    <div class="cell"><div class="label">${escapeHtml(t("status"))}</div><div class="val">${escapeHtml(statusText)}</div></div>
    <div class="cell"><div class="label">${escapeHtml(t("variety"))}</div><div class="val">${escapeHtml(variety)}</div></div>
    <div class="cell"><div class="label">${escapeHtml(t("region"))}</div><div class="val">${escapeHtml(region)}</div></div>
    <div class="cell"><div class="label">${escapeHtml(t("tons"))}</div><div class="val">${escapeHtml(formatTons(tons, locale))}${d.actualKg != null ? ` (${d.actualKg.toLocaleString(tag)} kg)` : ""}</div></div>
    <div class="cell"><div class="label">${escapeHtml(t("price"))}</div><div class="val">${escapeHtml(euroPrice(d.pricePerKg, locale))}/kg (${escapeHtml(total)})</div></div>
    <div class="cell"><div class="label">${escapeHtml(t("qualityScore"))}</div><div class="val">${escapeHtml(scoreText)}</div></div>
    <div class="cell"><div class="label">${escapeHtml(t("noBannedProducts"))}</div><div class="val">${escapeHtml(euCompliance)}</div></div>
    <div class="cell"><div class="label">${escapeHtml(t("arriveOn"))}</div><div class="val">${escapeHtml(scheduled)}</div></div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agropulse-traceability-${d.id.slice(0, 8)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(t("reportDownloaded"));
  };

  const sortedActive = useMemo(() => {
    return [...active].sort((a, b) => {
      const da = parseIsoDate(a.scheduledFor) ?? "9999-99-99";
      const db = parseIsoDate(b.scheduledFor) ?? "9999-99-99";
      return da.localeCompare(db);
    });
  }, [active]);

  const completedGroups = useMemo(() => {
    const sorted = [...completed].sort((a, b) => {
      const da = parseIsoDate(a.scheduledFor) ?? todayIsoDate();
      const db = parseIsoDate(b.scheduledFor) ?? todayIsoDate();
      return db.localeCompare(da);
    });
    const map = new Map<string, { heading: string; items: ProcessorDelivery[] }>();
    for (const d of sorted) {
      const iso = parseIsoDate(d.scheduledFor) ?? todayIsoDate();
      const monthKey = iso.slice(0, 7);
      const dt = new Date(`${iso}T12:00:00`);
      const heading = capitalize(
        dt.toLocaleDateString(tag, { month: "long", year: "numeric" }),
        tag,
      );
      const group = map.get(monthKey) ?? { heading, items: [] };
      group.items.push(d);
      map.set(monthKey, group);
    }
    return [...map.entries()].map(([key, val]) => ({ key, ...val }));
  }, [completed, tag]);

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title={t("deliveriesTitle")}
          subtitle={
            tab === "active"
              ? t("deliveriesActiveSubtitle")
              : t("deliveriesCompletedSubtitle")
          }
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
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">
          {t(error)}
        </ApCard>
      ) : null}

      {tab === "active" ? (
        active.length === 0 ? (
          <ApCard className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 opacity-45">
              <div className="min-w-[200px] flex-1">
                <p className="text-[11px] font-bold tracking-[1px] text-ap-accent uppercase">
                  {t("inProgress")}
                </p>
                <p className="text-[16px] font-extrabold text-ink">—</p>
                <p className="text-[13px] text-muted-foreground">
                  {loading ? t("loading") : t("noActiveDeliveries")}
                </p>
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
              <ApButton
                label={t("recordWeighbridge")}
                variant="dark"
                icon={<Scale className="size-4" />}
                disabled
              />
              <ApButton
                label={t("downloadReport")}
                variant="outline"
                icon={<Download className="size-4" />}
                disabled
              />
            </div>
          </ApCard>
        ) : (
          <div className="space-y-4">
            {sortedActive.map((d) => {
              const step = deliveryStepIndex(d.status);
              const parsedDate = parseIsoDate(d.scheduledFor);
              const tons = effectiveTons(d);
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
                          parsedDate
                            ? new Date(`${parsedDate}T12:00:00`).toLocaleDateString(tag, {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })
                            : t("unscheduledShort"),
                          d.lotVariety ? varietyLabel(d.lotVariety) : null,
                          formatTons(tons, locale),
                          `${euroPrice(d.pricePerKg, locale)}/kg`,
                          d.lotRegion ? regionLabel(d.lotRegion, locale) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[22px] font-extrabold text-ink">
                        {euroTotal(saleTotal(tons, d.pricePerKg), locale)}
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
                      disabled={!canAdvanceDelivery(d.status, d.labResult)}
                      onClick={() => openAdvance(d)}
                    />
                    {d.status === "scheduled" ? (
                      <ApButton
                        label={parsedDate ? t("reschedule") : t("setSchedule")}
                        variant="outline"
                        icon={<Calendar className="size-4" />}
                        onClick={() => openSchedule(d)}
                      />
                    ) : null}
                    <ApButton
                      label={t("downloadReport")}
                      variant="outline"
                      icon={<Download className="size-4" />}
                      onClick={() => downloadTraceabilityReport(d)}
                    />
                  </div>
                </ApCard>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {/* 4 KPI Cards — text-[26px] ώστε μεγάλα ποσά όπως 42.000 € να χωράνε άνετα στο κινητό */}
          <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-4">
            <DeliveryKpiCard
              label={t("tonnesBought")}
              value={`${tonnesBought.toFixed(tonnesBought >= 10 ? 0 : 1)} t`}
              hint={t("deliveriesCount", { count: completed.length })}
              icon={<Wheat className="size-4" />}
            />
            <DeliveryKpiCard
              label={t("totalSpent")}
              value={euroTotal(totalSpent, locale)}
              hint={t("seasonYear", { year: 2026 })}
              icon={<Euro className="size-4" />}
            />
            <DeliveryKpiCard
              label={t("avgQualityScore")}
              value={avgQuality == null || Number.isNaN(avgQuality) ? "–" : String(avgQuality)}
              hint={t("ofLotsBought")}
              icon={<Gauge className="size-4" />}
            />
            <DeliveryKpiCard
              label={t("noBannedProducts")}
              value={bannedFreeShare == null ? "–" : `${bannedFreeShare}%`}
              hint={t("shareOfLots")}
              icon={<ShieldCheck className="size-4" />}
            />
          </div>

          <Panel title={t("purchaseHistory")}>
            {completedGroups.length === 0 ? (
              <div className="border-t border-line px-4 py-10 text-center text-[13px] font-semibold text-muted-foreground">
                {loading ? t("loading") : t("noCompletedDeliveries")}
              </div>
            ) : (
              completedGroups.map((group) => (
                <div key={group.key}>
                  <div className="border-t border-line bg-soft/60 px-4 py-2">
                    <p className="text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
                      {group.heading}
                    </p>
                  </div>
                  {group.items.map((d) => {
                    const tons = effectiveTons(d);
                    const total = euroTotal(saleTotal(tons, d.pricePerKg), locale);
                    const iso = parseIsoDate(d.scheduledFor);
                    const dayLabel = iso
                      ? new Date(`${iso}T12:00:00`).toLocaleDateString(tag, {
                          day: "numeric",
                          month: "short",
                        })
                      : null;
                    const summaryLine = [
                      d.lotVariety ? varietyLabel(d.lotVariety) : null,
                      formatTons(tons, locale),
                      total,
                    ]
                      .filter(Boolean)
                      .join(" · ");

                    return (
                      <div
                        key={d.id}
                        className={cn(
                          "flex items-center justify-between gap-3 border-t border-line px-4 py-3",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            {dayLabel ? (
                              <span className="text-[12px] font-bold text-muted-foreground">
                                {dayLabel}
                              </span>
                            ) : null}
                            <p className="truncate text-[15px] font-extrabold text-ink">
                              {summaryLine}
                            </p>
                          </div>
                          {d.farmerName ? (
                            <p className="mt-0.5 truncate text-[12px] font-medium text-muted-foreground">
                              {d.farmerName}
                            </p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => downloadTraceabilityReport(d)}
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-ink bg-card px-3.5 text-[12px] font-bold text-ink transition-colors hover:bg-soft"
                        >
                          <Download className="size-3.5" aria-hidden />
                          {t("reportShort")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </Panel>
        </div>
      )}

      <Dialog
        open={scheduleTarget != null}
        onClose={() => setScheduleTarget(null)}
        title={t("scheduleDialogTitle")}
        subtitle={t("scheduleDialogHint")}
        actionLabel={scheduling ? t("loading") : t("scheduleDialogTitle")}
        actionDisabled={scheduling}
        onAction={() => void onScheduleConfirm()}
      >
        <DayChipPicker
          label={t("arriveOn")}
          days={weekDates}
          value={scheduleDate}
          onChange={setScheduleDate}
          formatDay={(iso) =>
            new Date(`${iso}T12:00:00`).toLocaleDateString(tag, {
              weekday: "short",
              day: "numeric",
            })
          }
          todayLabel={t("todayShort")}
        />
      </Dialog>

      <Dialog
        open={advanceTarget != null}
        onClose={() => setAdvanceTarget(null)}
        title={t("advanceStepTitle")}
        subtitle={
          advanceTarget
            ? `${advanceTarget.farmerName ?? advanceTarget.lotRegion ?? ""} · ${formatTons(effectiveTons(advanceTarget), locale)}`
            : undefined
        }
        actionLabel={advancing ? t("loading") : t("advance")}
        actionDisabled={advancing}
        onAction={() => void onAdvanceConfirm()}
      >
        {advanceTarget?.status === "scheduled" ? (
          <>
            <TextField
              label={t("weighKgLabel")}
              value={weighKg}
              onChange={setWeighKg}
              suffix="kg"
              inputMode="decimal"
            />
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
              total: euroTotal(
                saleTotal(effectiveTons(advanceTarget), advanceTarget.pricePerKg),
                locale,
              ),
            })}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}

function DeliveryKpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
}) {
  return (
    <ApCard className="min-w-0 rounded-[18px] border border-line p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-soft text-ink">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] leading-4 font-semibold text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 truncate text-[26px] leading-8 font-extrabold tracking-tight text-ink">
            {value}
          </p>
          <p className="mt-0.5 truncate text-[11px] leading-[14px] font-medium text-muted-foreground">
            {hint}
          </p>
        </div>
      </div>
    </ApCard>
  );
}