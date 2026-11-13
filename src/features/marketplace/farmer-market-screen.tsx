"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  ChevronRight,
  FlaskConical,
  Plus,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { StatusSteps } from "@/shared/components/brand";
import { useFarmerFields } from "@/features/fields/use-farmer-fields";
import { Link, useRouter } from "@/shared/i18n/navigation";
import { FIELD_DOTS } from "@/shared/theme/tokens";
import { cn } from "@/shared/lib/utils";

type Tab = "overview" | "requests" | "offers" | "sales";
type FilterKey = "fits" | "near" | "variety" | "region";

const TABS: Tab[] = ["overview", "requests", "offers", "sales"];

function isTab(value: string | undefined): value is Tab {
  return !!value && (TABS as string[]).includes(value);
}

export function FarmerMarketScreen({ initialTab }: { initialTab?: string }) {
  const t = useTranslations("farmerMarket");
  const router = useRouter();
  const { fields, loading, error } = useFarmerFields();
  const [tab, setTab] = useState<Tab>(isTab(initialTab) ? initialTab : "overview");
  const [filters, setFilters] = useState<FilterKey[]>(["fits"]);
  const openOfferCount = 0;

  const steps = useMemo(
    () => [t("stepAgreed"), t("stepPicked"), t("stepWeighed"), t("stepLab"), t("stepPaid")],
    [t],
  );

  const filterChips: { key: FilterKey; label: string }[] = [
    { key: "fits", label: t("fits") },
    { key: "near", label: t("near") },
    { key: "variety", label: t("variety") },
    { key: "region", label: t("aydin") },
  ];

  return (
    <div className="w-full flex-1">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-ap-title text-ink">{t("title")}</h1>
        <button
          type="button"
          aria-label={t("search")}
          onClick={() => toast(t("searchSoon"))}
          className="flex size-10 items-center justify-center rounded-full border border-line bg-card"
        >
          <Search className="size-[18px]" />
        </button>
      </div>

      <div
        role="tablist"
        className="mt-3 flex h-10 gap-1 overflow-x-auto rounded-full bg-soft p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((id) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(id)}
              className={cn(
                "relative flex min-w-[72px] flex-1 items-center justify-center gap-1 rounded-full px-2 text-ap-pill font-bold whitespace-nowrap",
                on ? "bg-ink text-white" : "text-muted-foreground",
              )}
            >
              {t(id)}
              {id === "offers" && openOfferCount > 0 ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-risk px-1 text-[10px] leading-none font-bold text-white">
                  {openOfferCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "overview" ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => router.push("/farmer/market/new")}
            className="flex h-14 w-full items-center gap-3 rounded-[18px] bg-ink px-3 text-left text-white"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-white/15">
              <Plus className="size-5" />
            </span>
            <span className="flex-1 text-ap-card font-extrabold">{t("sellOlives")}</span>
            <span className="flex size-8 items-center justify-center rounded-full bg-white text-ink">
              <ArrowRight className="size-4" />
            </span>
          </button>

          <SectionTitle>{t("bestOffer")}</SectionTitle>
          <div className="mt-2 rounded-[18px] border border-line bg-card p-3">
            <div className="flex items-center gap-2.5 opacity-45">
              <span className="size-11 shrink-0 rounded-xl bg-soft" />
              <div className="min-w-0 flex-1">
                <p className="text-ap-card text-ink">—</p>
                <p className="text-ap-small text-muted-foreground">{t("noOffers")}</p>
              </div>
              <p className="text-[22px] font-extrabold text-ink">
                —
                <span className="text-ap-small font-medium text-muted-foreground"> {t("perKg")}</span>
              </p>
            </div>
            <ActionPair counter={t("counter")} accept={t("accept")} acceptClass="bg-ink" />
          </div>

          <SectionTitle>{t("yourFields")}</SectionTitle>
          {loading ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="h-28 animate-pulse rounded-[18px] bg-soft" />
              <div className="h-28 animate-pulse rounded-[18px] bg-soft" />
            </div>
          ) : null}
          {error ? <p className="mt-2 text-ap-small text-risk">{error}</p> : null}
          {!loading && fields.length === 0 ? (
            <div className="mt-2 rounded-[18px] border border-line bg-card px-4 py-6 text-center text-ap-body font-semibold text-muted-foreground">
              {t("noFieldScores")}
            </div>
          ) : null}
          {!loading && fields.length > 0 ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {fields.map((field, i) => (
                <div key={field.id} className="rounded-[18px] border border-line bg-card p-3">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: FIELD_DOTS[i % FIELD_DOTS.length] }}
                      />
                      <p className="truncate text-ap-body font-extrabold text-ink">{field.name}</p>
                    </div>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-soft text-ap-small font-extrabold text-muted-foreground">
                      —
                    </span>
                  </div>
                  <p className="mt-2 text-ap-card text-ink">—</p>
                  <p className="text-[10px] text-muted-foreground">{t("perKg")}</p>
                  <Link
                    href={`/farmer/market/new?field=${field.id}`}
                    className="mt-1 inline-flex h-6 items-center text-ap-body font-bold text-ink"
                  >
                    {t("listNow")}
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          ) : null}

          <SectionTitle>{t("factoriesLooking")}</SectionTitle>
          <div className="mt-2 rounded-[18px] border border-line bg-card px-4 py-8 text-center text-ap-body font-semibold text-muted-foreground">
            {t("noFactories")}
          </div>
        </div>
      ) : null}

      {tab === "requests" ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3 rounded-[18px] bg-good-soft p-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card">
              <TrendingUp className="size-5 text-good" />
            </span>
            <div>
              <p className="text-ap-card font-extrabold text-good">{t("pricesUp")}</p>
              <p className="text-ap-body text-muted-foreground">{t("pricesUpHint")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filterChips.map((chip) => {
              const on = filters.includes(chip.key);
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() =>
                    setFilters((prev) => (on ? prev.filter((k) => k !== chip.key) : [...prev, chip.key]))
                  }
                  className={cn(
                    "inline-flex h-[30px] shrink-0 items-center gap-1 rounded-full border px-3 text-ap-pill font-bold",
                    on ? "border-good bg-good-soft text-good" : "border-line bg-card text-ink",
                  )}
                >
                  {on ? <Check className="size-3" strokeWidth={3} /> : null}
                  {chip.label}
                </button>
              );
            })}
            <button
              type="button"
              aria-label={t("filters")}
              onClick={() => setFilters([])}
              className="flex size-[30px] shrink-0 items-center justify-center rounded-full border border-line bg-card"
            >
              <SlidersHorizontal className="size-3.5" />
            </button>
          </div>

          <div className="rounded-[18px] border border-line bg-card px-4 py-10 text-center text-ap-body font-semibold text-muted-foreground">
            {t("noBuyerRequests")}
          </div>
        </div>
      ) : null}

      {tab === "offers" ? (
        <div className="mt-4 space-y-3">
          <section className="rounded-[18px] border border-line bg-card p-3">
            <div className="flex items-start justify-between gap-3 opacity-45">
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-[1px] text-ap-accent uppercase">{t("inProgress")}</p>
                <p className="text-ap-card text-ink">—</p>
                <p className="text-ap-body text-muted-foreground">{t("noActiveSales")}</p>
              </div>
              <div className="text-right">
                <p className="text-[22px] font-extrabold text-ink">€0</p>
                <p className="text-ap-small text-muted-foreground">{t("youllGet")}</p>
              </div>
            </div>
            <div className="mt-3 opacity-40">
              <StatusSteps steps={steps} current={-1} />
            </div>
            <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-ap-accent-soft p-2.5 opacity-40">
              <FlaskConical className="size-5 shrink-0 text-ap-accent" />
              <div>
                <p className="text-ap-body font-bold text-ink">{t("labPending")}</p>
                <p className="text-ap-small text-muted-foreground">{t("labPendingHint")}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[18px] border border-good/20 bg-good-soft/50 p-3">
            <div className="flex items-center gap-2.5 opacity-55">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-good-soft">
                <Check className="size-4 text-good" strokeWidth={2.6} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-ap-body font-extrabold text-ink">{t("paidAmount", { amount: "€0" })}</p>
                <p className="text-ap-small text-muted-foreground">—</p>
              </div>
              <button
                type="button"
                disabled
                className="inline-flex h-7 items-center gap-1 rounded-lg bg-card px-2 text-ap-small font-bold text-good"
              >
                <Wallet className="size-3.5" />
                {t("goToWallet")}
                <ChevronRight className="size-3" />
              </button>
            </div>
          </section>

          <SectionTitle>{t("offersForField")}</SectionTitle>
          <div className="mt-2 rounded-[18px] border border-line bg-card p-3">
            <div className="flex items-center gap-2.5 opacity-45">
              <span className="size-11 shrink-0 rounded-full bg-soft" />
              <div className="min-w-0 flex-1">
                <p className="text-ap-card text-ink">—</p>
                <p className="text-ap-small text-muted-foreground">{t("noIncomingOffers")}</p>
              </div>
              <p className="text-[22px] font-extrabold text-ink">
                —
                <span className="text-ap-small font-medium text-muted-foreground"> {t("perKg")}</span>
              </p>
            </div>
            <ActionPair counter={t("counter")} accept={t("accept")} acceptClass="bg-good" />
          </div>
        </div>
      ) : null}

      {tab === "sales" ? (
        <div className="mt-4">
          <div className="flex items-center rounded-[18px] border border-line bg-card p-3">
            <div className="min-w-0 flex-1">
              <p className="text-ap-body text-muted-foreground">{t("paidSeason")}</p>
              <p className="text-ap-title text-ink">€0</p>
            </div>
            <div className="mx-3 h-9 w-px bg-line" />
            <div className="min-w-0 flex-1">
              <p className="text-ap-body text-muted-foreground">{t("onTheWay")}</p>
              <p className="text-ap-title text-good">€0</p>
            </div>
            <button
              type="button"
              onClick={() => toast(t("walletSoon"))}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-ink px-3 text-ap-btn font-bold text-ink"
            >
              <Wallet className="size-4" />
              {t("wallet")}
            </button>
          </div>

          <SectionTitle>{t("inProgress")}</SectionTitle>
          <div className="mt-2 rounded-[18px] border border-line bg-card p-4">
            <p className="text-center text-ap-body font-semibold text-muted-foreground">{t("nothingOnTheWay")}</p>
            <div className="mt-4 opacity-40">
              <StatusSteps steps={steps} current={-1} />
            </div>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <h2 className="text-[17px] font-extrabold text-ink">{t("completed")}</h2>
            <span className="text-ap-body font-medium text-muted-foreground">
              {t("seeAll")}
              <ChevronRight className="inline size-3.5" />
            </span>
          </div>
          <div className="mt-2 rounded-[18px] border border-line bg-card px-4 py-8 text-center text-ap-body font-semibold text-muted-foreground">
            {t("noCompleted")}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mt-4 text-[17px] font-extrabold text-ink">{children}</h2>;
}

function ActionPair({
  counter,
  accept,
  acceptClass,
}: {
  counter: string;
  accept: string;
  acceptClass: string;
}) {
  return (
    <div className="mt-3 flex justify-end gap-2 opacity-40">
      <button
        type="button"
        disabled
        className="h-9 rounded-full border border-ink bg-card px-4 text-ap-pill font-bold text-ink"
      >
        {counter}
      </button>
      <button type="button" disabled className={cn("h-9 rounded-full px-4 text-ap-pill font-bold text-white", acceptClass)}>
        {accept}
      </button>
    </div>
  );
}
