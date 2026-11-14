"use client";

import { useMemo, useState } from "react";
import {
  ClipboardList,
  Download,
  Euro,
  FlaskConical,
  Gauge,
  Inbox,
  Leaf,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  Truck,
  Wheat,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { ApButton } from "@/shared/components/brand/ap-button";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Pill } from "@/shared/components/brand/pill";
import { Chip } from "@/shared/components/brand/chip";
import { StatusSteps } from "@/shared/components/brand/status-steps";
import { Link } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import {
  ChipGroup,
  Dialog,
  PageHeader,
  Panel,
  Segmented,
  StatCard,
  TextField,
} from "./processor-kit";

import { defaultVarietySlug, marketplaceVarietyOptions, resolveOliveCountry } from "@/features/fields/olive-varieties";

const PROVINCES = ["Aydın", "Balıkesir", "Crete", "İzmir", "Messinia"];
const WINDOW_KEYS = ["window1", "window2", "window3", "window4"] as const;
const SCORE_OPTIONS = ["70", "75", "80", "85"];

export function ProcessorOverviewScreen() {
  const t = useTranslations("processor");
  const tNav = useTranslations("processorNav");

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

      <div className="flex flex-wrap gap-3">
        <StatCard label={t("openRequests")} value="0" hint={t("waitingFarmers")} icon={<ClipboardList className="size-[18px]" />} />
        <StatCard label={t("incomingOffers")} value="0" hint={t("waitingAnswer")} icon={<Inbox className="size-[18px]" />} />
        <StatCard label={t("deliveriesWeek")} value="0" hint={t("notPaidYet")} icon={<Truck className="size-[18px]" />} />
        <StatCard label={t("avgQualityScore")} value="–" hint={t("ofIncoming")} icon={<Gauge className="size-[18px]" />} />
      </div>

      <Panel title={t("incomingOffers")} subtitle={t("incomingHint")}>
        <div className="border-t border-line px-4 py-8 text-center text-[13px] font-semibold text-muted-foreground">
          {t("noOpenOffers")}
        </div>
      </Panel>

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
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-medium text-muted-foreground">
                  {t("noHarvestOutlook")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export function ProcessorLotsScreen() {
  const t = useTranslations("processor");
  const locale = useLocale();
  const varietyOptions = useMemo(() => marketplaceVarietyOptions(locale), [locale]);
  const [useFilter, setUseFilter] = useState<"all" | "oil" | "table">("all");
  const [variety, setVariety] = useState("all");
  const [province, setProvince] = useState("all");
  const [minScore, setMinScore] = useState("0");
  const [noBanned, setNoBanned] = useState(false);
  const [labSuggested, setLabSuggested] = useState(false);

  const minScores = useMemo(
    () => [
      { value: "0", label: t("anyScore") },
      { value: "70", label: t("scorePlus", { score: "70" }) },
      { value: "75", label: t("scorePlus", { score: "75" }) },
      { value: "80", label: t("scorePlus", { score: "80" }) },
      { value: "85", label: t("scorePlus", { score: "85" }) },
    ],
    [t],
  );

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

      <div className="space-y-3">
        <ChipGroup
          label={t("variety")}
          value={variety}
          onChange={setVariety}
          options={[
            { value: "all", label: t("filterAll") },
            ...varietyOptions.map((v) => ({ value: v.value, label: v.label })),
          ]}
        />
        <ChipGroup
          label={t("province")}
          value={province}
          onChange={setProvince}
          options={[{ value: "all", label: t("filterAll") }, ...PROVINCES.map((v) => ({ value: v, label: v }))]}
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

      <Panel title={t("lotsCount", { count: 0 })} subtitle={t("bestScoreFirst")}>
        <div className="border-t border-line px-4 py-10 text-center text-[13px] font-semibold text-muted-foreground">
          {t("noLotsMatch")}
        </div>
      </Panel>
    </div>
  );
}

export function ProcessorRequestsScreen() {
  const t = useTranslations("processor");
  const locale = useLocale();
  const varietyOptions = useMemo(() => marketplaceVarietyOptions(locale), [locale]);
  const [open, setOpen] = useState(false);
  const [variety, setVariety] = useState(() => defaultVarietySlug(resolveOliveCountry({ locale }).country));
  const [tons, setTons] = useState("10");
  const [minScore, setMinScore] = useState("75");
  const [window, setWindow] = useState<string>(WINDOW_KEYS[1]!);
  const [province, setProvince] = useState("Aydın");
  const [noBanned, setNoBanned] = useState<"required" | "optional">("required");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("requestsTitle")}
        subtitle={t("requestsSubtitle")}
        action={
          <ApButton label={t("newRequest")} variant="dark" icon={<Plus className="size-4" />} onClick={() => setOpen(true)} />
        }
      />

      <Panel title={t("openRequestsCount", { count: 0 })}>
        <div className="border-t border-line px-4 py-10 text-center text-[13px] font-semibold text-muted-foreground">
          {t("noOpenRequests")}
        </div>
      </Panel>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("newRequest")}
        subtitle={t("newRequestSubtitle")}
        actionLabel={t("createRequest")}
        onAction={() => {
          setOpen(false);
          toast.success(t("requestCreated"));
        }}
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
            value={window}
            onChange={setWindow}
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
  const [tab, setTab] = useState<"active" | "completed">("active");

  const deliverySteps = useMemo(
    () => [t("step.scheduled"), t("step.weighed"), t("step.lab_checked"), t("step.paid")],
    [t],
  );

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
            { value: "active", label: t("active") },
            { value: "completed", label: t("completed") },
          ]}
        />
      </div>

      {tab === "active" ? (
        <ApCard className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 opacity-45">
            <div className="min-w-[200px] flex-1">
              <p className="text-[11px] font-bold tracking-[1px] text-ap-accent uppercase">{t("inProgress")}</p>
              <p className="text-[16px] font-extrabold text-ink">—</p>
              <p className="text-[13px] text-muted-foreground">{t("noActiveDeliveries")}</p>
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
          <div className="flex flex-wrap gap-3">
            <StatCard compact label={t("tonnesBought")} value="0 t" hint={t("deliveriesCount", { count: 0 })} icon={<Wheat className="size-4" />} />
            <StatCard compact label={t("totalSpent")} value="€0" hint={t("seasonYear", { year: 2026 })} icon={<Euro className="size-4" />} />
            <StatCard compact label={t("avgQualityScore")} value="–" hint={t("ofLotsBought")} icon={<Gauge className="size-4" />} />
            <StatCard compact label={t("noBannedProducts")} value="–" hint={t("shareOfLots")} icon={<ShieldCheck className="size-4" />} />
          </div>
          <Panel title={t("purchaseHistory")} subtitle={t("purchaseHistoryHint")}>
            <div className="border-t border-line px-4 py-10 text-center text-[13px] font-semibold text-muted-foreground">
              {t("noCompletedDeliveries")}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

export function ProcessorLotDetailScreen({ id }: { id: string }) {
  const t = useTranslations("processor");
  const title = useMemo(() => t("lotTitle", { id }), [id, t]);
  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle={t("lotDetailEmptySubtitle")} />
      <ApCard className="flex items-center gap-3 p-5">
        <span className="flex size-11 items-center justify-center rounded-xl bg-good-soft">
          <Leaf className="size-5 text-good" />
        </span>
        <div>
          <p className="text-[16px] font-extrabold text-ink">{t("notAvailable")}</p>
          <p className="text-[13px] text-muted-foreground">{t("lotEmptyBody")}</p>
        </div>
      </ApCard>
      <div className="flex flex-wrap gap-2">
        <Pill tone="good">{t("noBannedProducts")}</Pill>
        <Pill tone="neutral">{t("completeRecords")}</Pill>
        <Pill tone="warn">{t("labTestSuggested")}</Pill>
      </div>
      <Link href="/processor/lots" className="text-[13px] font-semibold text-muted-foreground hover:text-ink">
        {t("backToFindOlives")}
      </Link>
    </div>
  );
}
