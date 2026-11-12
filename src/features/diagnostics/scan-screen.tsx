"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/shared/components/page-header";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { toast } from "sonner";

type Mode = "leaf" | "fruit" | "trap";

export function ScanScreen() {
  const t = useTranslations("farmerScan");
  const [mode, setMode] = useState<Mode>("leaf");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onFile(file: File | null) {
    if (!file) return;
    if (file.size > 1_000_000) {
      toast.error(t("tooBig"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function analyse() {
    if (!preview) {
      toast.error(t("needPhoto"));
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const base64 = preview.includes(",") ? preview.split(",")[1] : preview;
      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mode }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed");
      setResult(json.data.result);
      setSource(json.data.source);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="leaf">{t("leaf")}</TabsTrigger>
          <TabsTrigger value="fruit">{t("fruit")}</TabsTrigger>
          <TabsTrigger value="trap">{t("trap")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("photo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="block w-full text-sm"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-48 w-full rounded-xl object-cover" />
          ) : null}
          <Button className="w-full" onClick={analyse} disabled={loading}>
            {loading ? t("analysing") : t("analyse")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("privacy")}</p>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("result")}</CardTitle>
            {source ? <Badge variant="secondary">{source}</Badge> : null}
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
