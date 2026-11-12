"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { euCheck } from "@/features/logbook/eu-check";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { toast } from "sonner";

type Entry = {
  id: string;
  product: string;
  substances: string[];
  banned: boolean;
  hits: string[];
  at: string;
};

export function LogbookScreen() {
  const t = useTranslations("farmerLogbook");
  const [product, setProduct] = useState("");
  const [substances, setSubstances] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [labelLoading, setLabelLoading] = useState(false);

  function addManual(e: React.FormEvent) {
    e.preventDefault();
    const list = substances
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const check = euCheck(list);
    setEntries((prev) => [
      {
        id: crypto.randomUUID(),
        product: product || list[0] || "Spray",
        substances: list,
        banned: check.banned,
        hits: check.hits,
        at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setProduct("");
    setSubstances("");
    toast.success(t("savedLocal"));
  }

  async function onLabel(file: File | null) {
    if (!file) return;
    setLabelLoading(true);
    try {
      const dataUrl = await readAsDataUrl(file);
      const base64 = dataUrl.split(",")[1] ?? dataUrl;
      const res = await fetch("/api/ai/read-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed");
      setProduct(json.data.label.productName);
      setSubstances(json.data.label.activeSubstances.join(", "));
      toast.success(t("labelOk", { source: json.data.source }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("labelFail"));
    } finally {
      setLabelLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("add")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("scanLabel")}</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => void onLabel(e.target.files?.[0] ?? null)}
              disabled={labelLoading}
            />
          </div>
          <form onSubmit={addManual} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="product">{t("product")}</Label>
              <Input id="product" value={product} onChange={(e) => setProduct(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subs">{t("substances")}</Label>
              <Input
                id="subs"
                placeholder="copper oxychloride, …"
                value={substances}
                onChange={(e) => setSubstances(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              {t("save")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex items-start justify-between gap-3 pt-4">
                <div>
                  <p className="font-medium">{entry.product}</p>
                  <p className="text-xs text-muted-foreground">{entry.substances.join(", ") || "—"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(entry.at).toLocaleString()}</p>
                </div>
                <Badge variant={entry.banned ? "destructive" : "secondary"}>
                  {entry.banned ? t("banned") : t("ok")}
                </Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
