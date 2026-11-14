"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, Check, ChevronDown, ChevronLeft, Minus, Plus, Trees } from "lucide-react";
import { formatStremmata } from "@/features/fields/area";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { varietyAgronomyContext, varietyLabelFromStored } from "@/features/fields/olive-varieties";
import { euroPrice, roundPrice } from "@/features/marketplace/pricing";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { cn } from "@/shared/lib/utils";
import { useLocale } from "next-intl";

const PERIOD_KEYS = ["period1", "period2", "period3", "period4"] as const;

function useLabel(use: string, t: (key: "useOil" | "useDual" | "useTable") => string) {
  if (use === "OIL") return t("useOil");
  if (use === "DUAL") return t("useDual");
  if (use === "TABLE") return t("useTable");
  return use;
}

export function NewListingScreen({ fieldId }: { fieldId?: string; factoryId?: string }) {
  const t = useTranslations("farmerMarket");
  const locale = useLocale();
  const router = useRouter();
  const { fields, loading } = useFarmerFields();
  const [currentId, setCurrentId] = useState(fieldId ?? "");
  const field = fields.find((f) => f.id === currentId) ?? fields[0];

  useEffect(() => {
    if (!fields.length) return;
    if (fieldId && fields.some((f) => f.id === fieldId)) {
      setCurrentId(fieldId);
      return;
    }
    if (!fields.some((f) => f.id === currentId)) setCurrentId(fields[0]!.id);
  }, [fields, fieldId, currentId]);

  const [tons, setTons] = useState(2.5);
  const [periodIdx, setPeriodIdx] = useState(0);
  const [negotiable, setNegotiable] = useState(false);
  const [delivery, setDelivery] = useState<"pickup" | "deliver">("pickup");
  const [price, setPrice] = useState(0.8);

  if (loading) {
    return (
      <div className="w-full flex-1">
        <Header title={t("newListing")} />
        <div className="mt-4 h-28 animate-pulse rounded-[18px] bg-soft" />
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="w-full flex-1">
        <Header title={t("newListing")} />
        <p className="mt-6 text-ap-body text-muted-foreground">{t("noFieldsForListing")}</p>
        <Link
          href="/farmer/fields/new"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-ap-btn font-bold text-white"
        >
          {t("newLot")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full flex-1">
      <Header title={t("newListing")} />

      <Label>{t("fieldLabel")}</Label>
      <div className="flex items-center gap-2.5 rounded-[18px] border border-line bg-card p-3">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[10px] bg-good-soft">
          <Trees className="size-6 text-good" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-ap-card font-extrabold text-ink">{field?.name ?? "—"}</p>
            <button
              type="button"
              className="shrink-0 text-ap-body font-bold text-ap-accent disabled:opacity-40"
              disabled={fields.length < 2}
              onClick={() => {
                const i = fields.findIndex((f) => f.id === field?.id);
                const next = fields[(i + 1) % fields.length];
                if (next) setCurrentId(next.id);
              }}
            >
              {t("change")}
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {field?.variety || field?.variety_slug ? (
              <span className="rounded-full bg-soft px-2 py-0.5 text-ap-pill font-bold text-ink">
                {varietyLabelFromStored(field.variety_slug ?? field.variety, locale)}
              </span>
            ) : null}
            {(() => {
              const agro = varietyAgronomyContext(field?.variety_slug ?? field?.variety);
              if (!agro) return null;
              return (
                <span className="rounded-full bg-soft px-2 py-0.5 text-ap-pill font-bold text-muted-foreground">
                  {useLabel(agro.primary_use, t)} · {agro.avg_oil_yield_pct[0]}–{agro.avg_oil_yield_pct[1]}%
                </span>
              );
            })()}
            {field?.tree_count != null ? (
              <span className="rounded-full bg-soft px-2 py-0.5 text-ap-pill font-bold text-ink">
                {t("treesPill", { n: field.tree_count })}
              </span>
            ) : null}
            {field?.area_ha != null ? (
              <span className="rounded-full bg-soft px-2 py-0.5 text-ap-pill font-bold text-ink">
                {t("haPill", { n: formatStremmata(Number(field.area_ha)) })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 rounded-xl bg-soft px-2.5 py-1.5 text-center">
          <p className="text-[10px] font-semibold text-muted-foreground">{t("qualityScore")}</p>
          <p className="text-[22px] leading-none font-extrabold text-muted-foreground">—</p>
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <div className="flex-1 rounded-[18px] border border-line bg-card p-3">
          <p className="text-ap-body text-muted-foreground">{t("howMuch")}</p>
          <div className="mt-1.5 flex h-10 items-center justify-between">
            <RoundBtn label={t("less")} onClick={() => setTons((n) => Math.max(0.5, Math.round((n - 0.5) * 10) / 10))}>
              <Minus className="size-4" />
            </RoundBtn>
            <span className="text-ap-card text-ink">{tons} t</span>
            <RoundBtn label={t("more")} onClick={() => setTons((n) => Math.min(25, Math.round((n + 0.5) * 10) / 10))}>
              <Plus className="size-4" />
            </RoundBtn>
          </div>
        </div>
        <div className="flex-1 rounded-[18px] border border-line bg-card p-3">
          <p className="text-ap-body text-muted-foreground">{t("harvestPeriod")}</p>
          <button
            type="button"
            onClick={() => setPeriodIdx((i) => (i + 1) % PERIOD_KEYS.length)}
            className="mt-1.5 flex h-10 w-full items-center justify-between rounded-xl border border-line bg-background px-3 text-ap-body font-semibold text-ink"
          >
            <span className="truncate">{t(PERIOD_KEYS[periodIdx]!)}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </div>

      <button
        type="button"
        role="checkbox"
        aria-checked={negotiable}
        onClick={() => setNegotiable((v) => !v)}
        className="mt-2 flex h-12 w-full items-center gap-3 rounded-[18px] border border-line bg-card px-3 text-left"
      >
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-md border-2",
            negotiable ? "border-primary bg-primary text-white" : "border-ink/60",
          )}
        >
          {negotiable ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>
        <span className="text-ap-btn font-semibold text-ink">{t("openNegotiation")}</span>
      </button>

      <Label>{t("deliveryLabel")}</Label>
      <div className="grid h-11 grid-cols-2 gap-1 rounded-xl bg-soft p-1">
        {(
          [
            ["pickup", t("factoryPickup")],
            ["deliver", t("iDeliver")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setDelivery(id)}
            className={cn(
              "rounded-lg text-ap-body font-bold",
              delivery === id ? "border border-ink bg-card text-ink" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Label>{t("priceLabel")}</Label>
      <div className="rounded-[18px] border border-line bg-card p-3">
        <div className="rounded-xl bg-good-soft px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-ap-body font-extrabold text-good">{t("exchangeRange")}</p>
            <p className="text-ap-card font-extrabold text-ink">
              —
              <span className="text-ap-small font-medium text-muted-foreground"> {t("perKg")}</span>
            </p>
          </div>
          <p className="mt-0.5 text-ap-small text-muted-foreground">{t("noExchange")}</p>
        </div>
        <p className="mt-3 text-ap-body text-muted-foreground">{t("yourPrice")}</p>
        <div className="mt-1.5 flex h-12 items-center justify-between rounded-xl border border-line px-2">
          <RoundBtn label={t("less")} onClick={() => setPrice((n) => roundPrice(Math.max(0.4, n - 0.05)))}>
            <Minus className="size-4" />
          </RoundBtn>
          <span className="text-[22px] font-extrabold text-ink">{euroPrice(price)}</span>
          <RoundBtn label={t("more")} onClick={() => setPrice((n) => roundPrice(Math.min(2, n + 0.05)))}>
            <Plus className="size-4" />
          </RoundBtn>
        </div>
        <p className="mt-2 text-ap-small text-muted-foreground">{t("setByMarket")}</p>
      </div>

      <button
        type="button"
        onClick={() => {
          toast.success(t("publishedLocal"));
          router.push("/farmer/market");
        }}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-ap-btn font-bold text-white"
      >
        {t("publishListing")}
        <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

function Header({ title }: { title: string }) {
  const t = useTranslations("farmerMarket");
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/farmer/market"
        aria-label={t("back")}
        className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
      <h1 className="flex-1 text-[22px] font-extrabold tracking-tight text-ink">{title}</h1>
      <div className="flex gap-1" aria-hidden>
        <span className="h-1 w-6 rounded-full bg-ink" />
        <span className="h-1 w-6 rounded-full bg-ink/70" />
        <span className="h-1 w-6 rounded-full bg-line" />
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mt-3 mb-1.5 text-[11px] font-bold tracking-[1px] text-muted-foreground uppercase">{children}</p>;
}

function RoundBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full bg-soft"
    >
      {children}
    </button>
  );
}
