"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { compareToRange, roundPrice, saleTotal } from "@/features/marketplace/pricing";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { toast } from "sonner";

const RANGE = { min: 0.75, max: 0.95, avg: 0.85 };

export function FarmerMarketScreen() {
  const t = useTranslations("farmerMarket");
  const [tons, setTons] = useState("2.5");
  const [price, setPrice] = useState("0.90");
  const [listed, setListed] = useState<{ tons: number; price: number; total: number } | null>(null);

  function publish(e: React.FormEvent) {
    e.preventDefault();
    const tNum = Number(tons);
    const pNum = roundPrice(Number(price));
    if (!Number.isFinite(tNum) || tNum <= 0 || !Number.isFinite(pNum) || pNum <= 0) {
      toast.error(t("invalid"));
      return;
    }
    setListed({ tons: tNum, price: pNum, total: saleTotal(tNum, pNum) });
    toast.success(t("publishedLocal"));
  }

  const verdict = listed ? compareToRange(listed.price, RANGE) : null;

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("exchange")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          €{RANGE.min.toFixed(2)} – €{RANGE.max.toFixed(2)} / kg
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("newLot")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={publish} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tons">{t("tons")}</Label>
              <Input id="tons" inputMode="decimal" value={tons} onChange={(e) => setTons(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">{t("price")}</Label>
              <Input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <Button type="submit" className="w-full">
              {t("publish")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {listed ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("yourLot")}</CardTitle>
            {verdict ? <Badge>{verdict.label}</Badge> : null}
          </CardHeader>
          <CardContent className="text-sm">
            <p>
              {listed.tons} t · €{listed.price.toFixed(2)}/kg
            </p>
            <p className="font-semibold">€{listed.total.toLocaleString("en-US")}</p>
            <p className="mt-2 text-xs text-muted-foreground">{t("localNote")}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
