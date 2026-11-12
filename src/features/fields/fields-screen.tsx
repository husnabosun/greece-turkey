"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { hasSupabaseConfig, publicEnv } from "@/core/config/env";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import type { FieldPolygon } from "./field-map-editor";

const FieldMapEditor = dynamic(() => import("./field-map-editor").then((m) => m.FieldMapEditor), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted" />,
});

export function FieldsScreen() {
  const t = useTranslations("farmerFields");
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_TOKEN;
  const supabaseReady = hasSupabaseConfig();
  const [name, setName] = useState("");
  const [polygon, setPolygon] = useState<FieldPolygon | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSave() {
    if (!supabaseReady) {
      toast.error(t("needSupabase"));
      return;
    }
    if (!polygon) {
      toast.error(t("needPolygon"));
      return;
    }
    const fieldName = name.trim() || t("defaultName");
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      toast.error(t("needSupabase"));
      return;
    }

    setSaving(true);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setSaving(false);
      toast.error(t("needLogin"));
      return;
    }

    const { error } = await supabase.rpc("create_field_from_geojson", {
      p_name: fieldName,
      p_geojson: JSON.stringify(polygon),
      p_variety: null,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(t("saveOk"));
    setName("");
    setPolygon(null);
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {!token ? (
        <EmptyState title={t("needMapboxTitle")} description={t("needMapboxBody")} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("drawTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="field-name">{t("nameLabel")}</Label>
              <Input
                id="field-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
            </div>
            <FieldMapEditor
              token={token}
              onPolygonChange={(next) => setPolygon(next)}
            />
            <p className="text-xs text-muted-foreground">{t("drawHint")}</p>
            <Button
              type="button"
              className="w-full"
              disabled={saving || !polygon}
              onClick={onSave}
            >
              {saving ? t("saving") : t("save")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
