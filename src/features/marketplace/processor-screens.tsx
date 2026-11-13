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

const VARIETIES = ["Ayvalık", "Gemlik", "Kalamon", "Koroneiki", "Memecik"];
const PROVINCES = ["Aydın", "Balıkesir", "Crete", "İzmir", "Messinia"];
const MIN_SCORES = [
  { value: "0", label: "Any" },
  { value: "70", label: "70+" },
  { value: "75", label: "75+" },
  { value: "80", label: "80+" },
  { value: "85", label: "85+" },
];
const WINDOWS = ["5–15 Nov", "15–25 Nov", "25 Nov–5 Dec", "5–15 Dec"];
const SCORE_OPTIONS = ["70", "75", "80", "85"];
const DELIVERY_STEPS = ["Scheduled", "Weighed", "Lab checked", "Paid"];

export function ProcessorOverviewScreen() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        subtitle="What needs your attention today."
        action={
          <Link href="/processor/lots">
            <ApButton label="Find olives" variant="dark" icon={<Search className="size-4" />} />
          </Link>
        }
      />

      <div className="flex flex-wrap gap-3">
        <StatCard label="Open requests" value="0" hint="Waiting for farmers" icon={<ClipboardList className="size-[18px]" />} />
        <StatCard label="Incoming offers" value="0" hint="Waiting for your answer" icon={<Inbox className="size-[18px]" />} />
        <StatCard label="Deliveries this week" value="0" hint="Not paid yet" icon={<Truck className="size-[18px]" />} />
        <StatCard label="Average quality score" value="–" hint="Of incoming lots" icon={<Gauge className="size-[18px]" />} />
      </div>

      <Panel title="Incoming offers" subtitle="Farmers who want to sell to you. Names show after you accept.">
        <div className="border-t border-line px-4 py-8 text-center text-[13px] font-semibold text-muted-foreground">
          No open offers right now.
        </div>
      </Panel>

      <Panel
        title="Supply outlook"
        subtitle="Tonnes ready to harvest in the next 4 weeks, from the harvest dates of the lots. Risk comes from the AgroPulse risk engine."
      >
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="bg-soft text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Region</th>
                <th className="px-4 py-2.5 font-semibold">This week</th>
                <th className="px-4 py-2.5 font-semibold">Week 2</th>
                <th className="px-4 py-2.5 font-semibold">Week 3</th>
                <th className="px-4 py-2.5 font-semibold">Week 4</th>
                <th className="px-4 py-2.5 font-semibold">Pest risk this week</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-medium text-muted-foreground">
                  No harvest outlook yet.
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
  const [useFilter, setUseFilter] = useState<"all" | "oil" | "table">("all");
  const [variety, setVariety] = useState("all");
  const [province, setProvince] = useState("all");
  const [minScore, setMinScore] = useState("0");
  const [noBanned, setNoBanned] = useState(false);
  const [labSuggested, setLabSuggested] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Find olives" subtitle="Lots from farmers with a quality score. Names show after an offer is accepted." />
        <Segmented
          value={useFilter}
          onChange={setUseFilter}
          options={[
            { value: "all", label: "All" },
            { value: "oil", label: "For oil" },
            { value: "table", label: "Table olives" },
          ]}
        />
      </div>

      <div className="space-y-3">
        <ChipGroup
          label="Variety"
          value={variety}
          onChange={setVariety}
          options={[{ value: "all", label: "All" }, ...VARIETIES.map((v) => ({ value: v, label: v }))]}
        />
        <ChipGroup
          label="Province"
          value={province}
          onChange={setProvince}
          options={[{ value: "all", label: "All" }, ...PROVINCES.map((v) => ({ value: v, label: v }))]}
        />
        <ChipGroup label="Minimum quality score" value={minScore} onChange={setMinScore} options={MIN_SCORES} />
        <div className="flex flex-wrap gap-2">
          <Chip tone="black" on={noBanned} onClick={() => setNoBanned((v) => !v)}>
            <span className={cn("text-[13px] font-bold", noBanned ? "text-white" : "text-ink")}>No banned products</span>
          </Chip>
          <Chip tone="black" on={labSuggested} onClick={() => setLabSuggested((v) => !v)}>
            <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-bold", labSuggested ? "text-white" : "text-ink")}>
              <FlaskConical className="size-3.5" />
              Lab test suggested
            </span>
          </Chip>
        </div>
      </div>

      <Panel title="0 lots" subtitle="Best quality score first.">
        <div className="border-t border-line px-4 py-10 text-center text-[13px] font-semibold text-muted-foreground">
          No lots match these filters yet.
        </div>
      </Panel>
    </div>
  );
}

export function ProcessorRequestsScreen() {
  const [open, setOpen] = useState(false);
  const [variety, setVariety] = useState("Ayvalık");
  const [tons, setTons] = useState("10");
  const [minScore, setMinScore] = useState("75");
  const [window, setWindow] = useState(WINDOWS[1]!);
  const [province, setProvince] = useState("Aydın");
  const [noBanned, setNoBanned] = useState<"required" | "optional">("required");

  return (
    <div className="space-y-5">
      <PageHeader
        title="My requests"
        subtitle="What you want to buy. Farmers send offers against your request."
        action={
          <ApButton label="New request" variant="dark" icon={<Plus className="size-4" />} onClick={() => setOpen(true)} />
        }
      />

      <Panel title="0 open requests">
        <div className="border-t border-line px-4 py-10 text-center text-[13px] font-semibold text-muted-foreground">
          No open requests yet.
        </div>
      </Panel>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New request"
        subtitle="Farmers can see it in the farmer app, under Market > Requests."
        actionLabel="Create request"
        onAction={() => {
          setOpen(false);
          toast.success("Request created");
        }}
      >
        <div className="space-y-4">
          <ChipGroup
            label="Variety"
            value={variety}
            onChange={setVariety}
            options={VARIETIES.map((v) => ({ value: v, label: v }))}
          />
          <TextField label="Tonnes needed" value={tons} onChange={setTons} suffix="t" inputMode="decimal" />
          <ChipGroup
            label="Minimum quality score"
            value={minScore}
            onChange={setMinScore}
            options={SCORE_OPTIONS.map((s) => ({ value: s, label: `${s}+` }))}
          />
          <ChipGroup
            label="Delivery window"
            value={window}
            onChange={setWindow}
            options={WINDOWS.map((w) => ({ value: w, label: w }))}
          />
          <ChipGroup
            label="Province"
            value={province}
            onChange={setProvince}
            options={PROVINCES.map((p) => ({ value: p, label: p }))}
          />
          <ChipGroup
            label="No banned products"
            value={noBanned}
            onChange={(v) => setNoBanned(v as "required" | "optional")}
            options={[
              { value: "required", label: "Required" },
              { value: "optional", label: "Not required" },
            ]}
          />
        </div>
      </Dialog>
    </div>
  );
}

export function ProcessorDeliveriesScreen() {
  const [tab, setTab] = useState<"active" | "completed">("active");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Deliveries"
          subtitle={
            tab === "active"
              ? "Accepted lots, from the weighbridge to payment. Farmer names are shown here."
              : "What you bought in the 2026 season."
          }
        />
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
          ]}
        />
      </div>

      {tab === "active" ? (
        <ApCard className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3 opacity-45">
            <div className="min-w-[200px] flex-1">
              <p className="text-[11px] font-bold tracking-[1px] text-ap-accent uppercase">IN PROGRESS</p>
              <p className="text-[16px] font-extrabold text-ink">—</p>
              <p className="text-[13px] text-muted-foreground">No active deliveries.</p>
            </div>
            <div className="text-right">
              <p className="text-[22px] font-extrabold text-ink">€0</p>
              <p className="text-[12px] text-muted-foreground">expected</p>
            </div>
          </div>
          <div className="mt-3 max-w-[760px] opacity-45">
            <StatusSteps steps={DELIVERY_STEPS} current={-1} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ApButton label="Record weighbridge" variant="dark" icon={<Scale className="size-4" />} disabled />
            <ApButton label="Download report" variant="outline" icon={<Download className="size-4" />} disabled />
          </div>
        </ApCard>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <StatCard compact label="Tonnes bought" value="0 t" hint="0 deliveries" icon={<Wheat className="size-4" />} />
            <StatCard compact label="Total spent" value="€0" hint="Season 2026" icon={<Euro className="size-4" />} />
            <StatCard compact label="Average quality score" value="–" hint="Of the lots you bought" icon={<Gauge className="size-4" />} />
            <StatCard compact label="No banned products" value="–" hint="Share of lots" icon={<ShieldCheck className="size-4" />} />
          </div>
          <Panel title="Purchase history" subtitle="Newest first. Totals are rounded to €50.">
            <div className="border-t border-line px-4 py-10 text-center text-[13px] font-semibold text-muted-foreground">
              No completed deliveries yet.
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

export function ProcessorLotDetailScreen({ id }: { id: string }) {
  const title = useMemo(() => `Lot ${id}`, [id]);
  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle="Lot details appear after a farmer publishes a listing." />
      <ApCard className="flex items-center gap-3 p-5">
        <span className="flex size-11 items-center justify-center rounded-xl bg-good-soft">
          <Leaf className="size-5 text-good" />
        </span>
        <div>
          <p className="text-[16px] font-extrabold text-ink">Not available</p>
          <p className="text-[13px] text-muted-foreground">This lot is empty until live marketplace data exists.</p>
        </div>
      </ApCard>
      <div className="flex flex-wrap gap-2">
        <Pill tone="good">No banned products</Pill>
        <Pill tone="neutral">Complete records</Pill>
        <Pill tone="warn">Lab test suggested</Pill>
      </div>
      <Link href="/processor/lots" className="text-[13px] font-semibold text-muted-foreground hover:text-ink">
        ← Back to Find olives
      </Link>
    </div>
  );
}
