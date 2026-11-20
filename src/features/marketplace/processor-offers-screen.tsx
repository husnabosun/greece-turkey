"use client";

import {
  ClipboardList,
  Inbox,
  MapPin,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ApButton } from "@/shared/components/brand/ap-button";
import { Pill } from "@/shared/components/brand/pill";
import { Link } from "@/shared/i18n/navigation";
import { euroPrice } from "@/features/marketplace/pricing";
import {
  Amount,
  EmptyBlock,
  LotRow,
  PageHeader,
  Panel,
  ScoreBox,
} from "./processor-kit";
import {
  lotPlaceLabel,
  useProcessorMarket,
} from "./use-processor-market";
import { useVarietyLabel } from "./processor-shared";

/** Dedicated inbox: Flow B farmer offers in, Flow A mill bids out. */
export function ProcessorOffersScreen() {
  const t = useTranslations("processor");
  const tNav = useTranslations("processorNav");
  const varietyLabel = useVarietyLabel();
  const { offers, loading, error } = useProcessorMarket();

  const incoming = offers.filter(
    (o) => o.initiatedBy === "farmer" && (o.status === "pending" || o.status === "countered"),
  );
  const outgoing = offers.filter(
    (o) => o.initiatedBy === "processor" && (o.status === "pending" || o.status === "countered"),
  );

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 px-4 py-6 sm:px-6">
      <PageHeader title={t("offersTitle")} subtitle={t("offersSubtitle")} />
      {error ? <p className="text-ap-small text-risk">{error}</p> : null}
      {loading ? <p className="text-ap-small text-muted-foreground">{t("loading")}</p> : null}

      <Panel title={t("incomingOffers")} subtitle={t("incomingHint")}>
        {incoming.length === 0 ? (
          <EmptyBlock
            icon={<Inbox className="size-5" />}
            title={t("noOpenOffersTitle")}
            body={t("noOpenOffersHint")}
            action={
              <Link href="/processor/requests">
                <ApButton label={tNav("requests")} variant="dark" icon={<ClipboardList className="size-4" />} />
              </Link>
            }
          />
        ) : (
          incoming.map((offer, i) => {
            const lot = offer.lot;
            const place = lot ? lotPlaceLabel(lot, t("anonymousGrove")) : t("anonymousGrove");
            return (
              <LotRow
                key={offer.id}
                first={i === 0}
                href={`/processor/offers/${offer.id}`}
                lead={
                  <span className="flex size-11 items-center justify-center rounded-xl bg-soft">
                    <MapPin className="size-5 text-ink" />
                  </span>
                }
                title={place}
                sub={
                  lot
                    ? t("incomingSub", {
                        variety: varietyLabel(lot.variety),
                        tons: offer.tons,
                        region: lot.region,
                      })
                    : `${offer.tons} t`
                }
                badges={<span />}
                score={lot?.qualityScore != null ? <ScoreBox score={lot.qualityScore} /> : <span />}
                value={
                  <>
                    <Amount value={euroPrice(offer.pricePerKg)} unit="/kg" />
                    <span className="text-[11px] font-semibold text-ink">
                      {t("asksPrice", { price: euroPrice(offer.pricePerKg) })}
                    </span>
                  </>
                }
                actions={
                  <Link href={`/processor/offers/${offer.id}`}>
                    <ApButton label={t("openOffer")} variant="dark" />
                  </Link>
                }
              />
            );
          })
        )}
      </Panel>

      <Panel title={t("outgoingOffers")} subtitle={t("outgoingHint")}>
        {outgoing.length === 0 ? (
          <EmptyBlock
            icon={<Search className="size-5" />}
            title={t("noOutgoingTitle")}
            body={t("noOutgoingOffers")}
            action={
              <Link href="/processor/lots">
                <ApButton label={tNav("findOlives")} variant="outline" icon={<Search className="size-4" />} />
              </Link>
            }
          />
        ) : (
          outgoing.map((offer) => {
            const lot = offer.lot;
            const place = lot ? lotPlaceLabel(lot, t("anonymousGrove")) : t("anonymousGrove");
            return (
              <Link
                key={offer.id}
                href={`/processor/offers/${offer.id}`}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 hover:bg-background"
              >
                <div>
                  <p className="text-[15px] font-extrabold text-ink">{place}</p>
                  <p className="text-[12px] font-medium text-muted-foreground">
                    {t("waitingFarmerAnswer", {
                      price: euroPrice(offer.pricePerKg),
                      tons: offer.tons,
                    })}
                  </p>
                </div>
                <Pill tone="warn">{t("pendingStatus")}</Pill>
              </Link>
            );
          })
        )}
      </Panel>
    </div>
  );
}
