"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { nextDeliveryStatus } from "@/features/marketplace/delivery-state";
import { trustBadges } from "@/features/marketplace/badges";
import { roundPrice, saleTotal } from "@/features/marketplace/pricing";
import type { DeliveryStatus } from "@/shared/types/database";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { toast } from "sonner";
import { Link } from "@/shared/i18n/navigation";

type LotCard = {
  id: string;
  region: string;
  variety: string;
  tons: number;
  score: number;
  priceHint: number;
  hasBanned: boolean;
  records: number;
};

/** Live lots only — no seeded marketplace mock rows. */
const LIVE_LOTS: LotCard[] = [];

type OfferRow = {
  id: string;
  lotId: string;
  tons: number;
  price: number;
  status: "pending" | "accepted" | "rejected";
};

type DeliveryRow = {
  id: string;
  lotId: string;
  tons: number;
  price: number;
  status: DeliveryStatus;
  actualKg?: number;
};

export function ProcessorOverviewScreen() {
  const t = useTranslations("processor");
  const supply = useMemo(
    () =>
      Object.entries(
        LIVE_LOTS.reduce<Record<string, number>>((acc, lot) => {
          acc[lot.region] = (acc[lot.region] ?? 0) + lot.tons;
          return acc;
        }, {}),
      ),
    [],
  );
  const totalTons = LIVE_LOTS.reduce((s, l) => s + l.tons, 0);
  const avgScore =
    LIVE_LOTS.length === 0 ? 0 : Math.round(LIVE_LOTS.reduce((s, l) => s + l.score, 0) / LIVE_LOTS.length);

  return (
    <div className="space-y-4">
      <PageHeader title={t("overviewTitle")} description={t("overviewSubtitle")} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("openLots")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-extrabold">{LIVE_LOTS.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("supplyTons")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-extrabold">{totalTons}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t("avgScore")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-extrabold">{avgScore}</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("byRegion")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {supply.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noLotsYet")}</p>
          ) : (
            supply.map(([region, tons]) => (
              <div key={region} className="flex justify-between text-sm">
                <span>{region}</span>
                <span className="font-medium">{tons} t</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Button asChild>
        <Link href="/processor/lots">{t("browseLots")}</Link>
      </Button>
    </div>
  );
}

export function ProcessorLotsScreen() {
  const t = useTranslations("processor");
  return (
    <div className="space-y-4">
      <PageHeader title={t("lotsTitle")} description={t("lotsSubtitle")} />
      <div className="grid gap-3">
        {LIVE_LOTS.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noLotsYet")}</p>
        ) : null}
        {LIVE_LOTS.map((lot) => {
          const badges = trustBadges({
            records: lot.records,
            hasBanned: lot.hasBanned,
            paidDeliveries: lot.score > 80 ? 2 : 0,
            labFailed: 0,
          });
          return (
            <Card key={lot.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">
                    {lot.variety} · {lot.region}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {lot.tons} t · score {lot.score}
                  </p>
                </div>
                <Badge variant="secondary">€{lot.priceHint.toFixed(2)}</Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {badges.map((b) => (
                  <Badge key={b.id} variant="outline">
                    {b.label}
                  </Badge>
                ))}
                <Button asChild size="sm" className="ml-auto">
                  <Link href={`/processor/lots/${lot.id}`}>{t("openLot")}</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function ProcessorLotDetailScreen({ lotId }: { lotId: string }) {
  const t = useTranslations("processor");
  const lot = LIVE_LOTS.find((l) => l.id === lotId) ?? null;
  const [tons, setTons] = useState(lot ? String(lot.tons) : "");
  const [price, setPrice] = useState(lot ? String(lot.priceHint) : "");

  if (!lot) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("lotsTitle")} description={t("noLotsYet")} />
        <Button asChild variant="outline">
          <Link href="/processor/lots">{t("back")}</Link>
        </Button>
      </div>
    );
  }

  function bid(e: React.FormEvent) {
    e.preventDefault();
    const offer = {
      lotId: lot.id,
      tons: Number(tons),
      price: roundPrice(Number(price)),
    };
    const raw = sessionStorage.getItem("ap.offers");
    const list: OfferRow[] = raw ? (JSON.parse(raw) as OfferRow[]) : [];
    list.unshift({
      id: crypto.randomUUID(),
      lotId: offer.lotId,
      tons: offer.tons,
      price: offer.price,
      status: "pending",
    });
    sessionStorage.setItem("ap.offers", JSON.stringify(list));
    toast.success(t("offerSent"));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${lot.variety} · ${lot.region}`}
        description={t("lotDetailSubtitle")}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/processor/lots">{t("back")}</Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="space-y-1 pt-6 text-sm">
          <p>
            {lot.tons} t · score {lot.score}
          </p>
          <p className="text-muted-foreground">{t("identityHidden")}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("makeOffer")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={bid} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("tons")}</Label>
              <Input value={tons} onChange={(e) => setTons(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("price")}</Label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <Button type="submit" className="sm:col-span-2">
              {t("sendOffer")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProcessorOffersScreen() {
  const t = useTranslations("processor");
  const [offers, setOffers] = useState<OfferRow[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem("ap.offers");
    if (raw) setOffers(JSON.parse(raw) as OfferRow[]);
  }, []);

  function accept(id: string) {
    const next = offers.map((o) => (o.id === id ? { ...o, status: "accepted" as const } : o));
    setOffers(next);
    sessionStorage.setItem("ap.offers", JSON.stringify(next));
    const offer = next.find((o) => o.id === id);
    if (!offer) return;
    const raw = sessionStorage.getItem("ap.deliveries");
    const deliveries: DeliveryRow[] = raw ? (JSON.parse(raw) as DeliveryRow[]) : [];
    deliveries.unshift({
      id: crypto.randomUUID(),
      lotId: offer.lotId,
      tons: offer.tons,
      price: offer.price,
      status: "scheduled",
    });
    sessionStorage.setItem("ap.deliveries", JSON.stringify(deliveries));
    toast.success(t("accepted"));
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("offersTitle")} description={t("offersSubtitle")} />
      {offers.length === 0 ? <p className="text-sm text-muted-foreground">{t("noOffers")}</p> : null}
      {offers.map((o) => (
        <Card key={o.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div className="text-sm">
              <p className="font-medium">
                {o.lotId} · {o.tons} t · €{o.price.toFixed(2)}/kg
              </p>
              <p className="text-muted-foreground">€{saleTotal(o.tons, o.price).toLocaleString("en-US")}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{o.status}</Badge>
              {o.status === "pending" ? (
                <Button size="sm" onClick={() => accept(o.id)}>
                  {t("accept")}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ProcessorDeliveriesScreen() {
  const t = useTranslations("processor");
  const [rows, setRows] = useState<DeliveryRow[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem("ap.deliveries");
    if (raw) setRows(JSON.parse(raw) as DeliveryRow[]);
  }, []);

  function advance(id: string) {
    const next = rows.map((d) => {
      if (d.id !== id) return d;
      const n = nextDeliveryStatus(d.status);
      if (!n) return d;
      const updated: DeliveryRow = { ...d, status: n };
      if (n === "weighed") updated.actualKg = Math.round(d.tons * 1000);
      return updated;
    });
    setRows(next);
    sessionStorage.setItem("ap.deliveries", JSON.stringify(next));
    toast.success(t("advanced"));
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("deliveriesTitle")} description={t("deliveriesSubtitle")} />
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("noDeliveries")}</p> : null}
      {rows.map((d) => {
        const next = nextDeliveryStatus(d.status);
        return (
          <Card key={d.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
              <div className="text-sm">
                <p className="font-medium">
                  {d.lotId} · {d.status}
                </p>
                <p className="text-muted-foreground">
                  {d.tons} t · €{d.price.toFixed(2)}/kg
                  {d.actualKg ? ` · ${d.actualKg} kg` : ""}
                </p>
              </div>
              {next ? (
                <Button size="sm" onClick={() => advance(d.id)}>
                  {t("advanceTo", { status: next })}
                </Button>
              ) : (
                <Badge variant="secondary">{t("done")}</Badge>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
