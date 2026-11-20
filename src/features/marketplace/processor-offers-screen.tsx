"use client";

import { useState } from "react";
import { ChevronRight, Inbox, Send, History } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ApCard } from "@/shared/components/brand/ap-card";
import { Pill } from "@/shared/components/brand/pill";
import { Link } from "@/shared/i18n/navigation";
import { euroPrice, formatTons } from "@/features/marketplace/pricing";
import { regionLabel } from "@/features/marketplace/regions";
import { EmptyBlock, PageHeader, Panel, Segmented } from "./processor-kit";
import { useProcessorMarket, type ProcessorOffer } from "./use-processor-market";
import { useVarietyLabel } from "./processor-shared";

function formatShortDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const tag = locale.startsWith("el") ? "el-GR" : locale.startsWith("tr") ? "tr-TR" : "en-GB";
  return d.toLocaleDateString(tag, { day: "numeric", month: "short" });
}

function historyPill(
  status: string,
  t: (key: string) => string,
): { label: string; tone: "good" | "risk" | "warn" | "neutral" } {
  if (status === "accepted") return { label: t("acceptedStatus"), tone: "good" };
  if (status === "rejected") return { label: t("rejectedStatus"), tone: "risk" };
  if (status === "withdrawn") return { label: t("withdrawnStatus"), tone: "risk" };
  if (status === "countered") return { label: t("counteredStatus"), tone: "warn" };
  return { label: status, tone: "neutral" };
}

export function ProcessorOffersScreen() {
  const t = useTranslations("processor");
  const locale = useLocale();
  const varietyLabel = useVarietyLabel();
  const { offers, loading, error } = useProcessorMarket();
  const [tab, setTab] = useState<"incoming" | "outgoing" | "history">("incoming");

  const incoming = offers.filter(
    (o) => o.initiatedBy === "farmer" && o.status === "pending",
  );
  const outgoing = offers.filter(
    (o) => o.initiatedBy === "processor" && o.status === "pending",
  );
  const history = offers.filter(
    (o) =>
      o.status === "accepted" ||
      o.status === "rejected" ||
      o.status === "countered" ||
      o.status === "withdrawn",
  );

  const visible: ProcessorOffer[] =
    tab === "incoming" ? incoming : tab === "outgoing" ? outgoing : history;

  const emptyConfig =
    tab === "incoming"
      ? {
          icon: <Inbox className="size-5" />,
          title: t("emptyIncomingTab"),
          body: t("noOpenOffersHint"),
        }
      : tab === "outgoing"
        ? {
            icon: <Send className="size-5" />,
            title: t("emptyOutgoingTab"),
            body: t("noOutgoingOffers"),
          }
        : {
            icon: <History className="size-5" />,
            title: t("emptyHistoryTab"),
            body: t("emptyHistoryHint"),
          };

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title={t("offersTitle")} subtitle={t("offersSubtitle")} />
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            {
              value: "incoming",
              label: t("tabIncoming"),
              badge: incoming.length || undefined,
            },
            {
              value: "outgoing",
              label: t("tabOutgoing"),
            },
            {
              value: "history",
              label: t("tabHistory"),
            },
          ]}
        />
      </div>

      {error === "needSupabase" || error === "needLogin" ? (
        <ApCard className="p-4 text-[13px] font-semibold text-muted-foreground">
          {t(error)}
        </ApCard>
      ) : error ? (
        <p className="text-ap-small text-risk">{error}</p>
      ) : null}

      {loading && offers.length === 0 ? (
        <p className="text-ap-small text-muted-foreground">{t("loading")}</p>
      ) : null}

      <Panel>
        {visible.length === 0 ? (
          <EmptyBlock
            icon={emptyConfig.icon}
            title={emptyConfig.title}
            body={emptyConfig.body}
          />
        ) : (
          visible.map((offer, i) => {
            const lot = offer.lot;
            const variety = lot ? varietyLabel(lot.variety) : t("oliveDefault");
            const title = `${variety} · ${formatTons(offer.tons, locale)}`;
            const region = lot?.region ? regionLabel(lot.region, locale) : null;
            const dateStr = formatShortDate(lot?.listedAt ?? lot?.harvestStart, locale);
            const sub = [region, dateStr].filter(Boolean).join(" · ");
            const badge = tab === "history" ? historyPill(offer.status, t) : null;

            return (
              <Link
                key={offer.id}
                href={`/processor/offers/${offer.id}`}
                className={`flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-background ${
                  i > 0 ? "border-t border-line" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[16px] leading-5 font-extrabold text-ink">
                      {title}
                    </p>
                    {badge ? <Pill tone={badge.tone}>{badge.label}</Pill> : null}
                  </div>
                  {sub ? (
                    <p className="mt-0.5 truncate text-[13px] leading-[18px] font-medium text-muted-foreground">
                      {sub}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[16px] font-extrabold text-ink">
                    {euroPrice(offer.pricePerKg, locale)}/kg
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </div>
              </Link>
            );
          })
        )}
      </Panel>
    </div>
  );
}