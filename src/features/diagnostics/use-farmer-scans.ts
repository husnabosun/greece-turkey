"use client";

import { useCallback, useEffect, useState } from "react";
import { STORAGE_BUCKETS } from "@/core/config/constants";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import type { Presented, SavedScan, ScanDiagnosisJson } from "@/features/diagnostics/scan-types";
import type { PillTone } from "@/shared/components/brand";

type State = {
  scans: SavedScan[];
  loading: boolean;
  error: string | null;
};

const EMPTY: State = { scans: [], loading: true, error: null };

/** Loads the signed-in farmer's scans (with signed preview URLs). */
export function useFarmerScans() {
  const [state, setState] = useState<State>(EMPTY);

  const reload = useCallback(async () => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      setState({ scans: [], loading: false, error: "needSupabase" });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setState({ scans: [], loading: false, error: "needLogin" });
        return;
      }

      const { data, error } = await supabase
        .from("scans")
        .select("id, field_id, title, latin_name, diagnosis, confidence, source, captured_at, storage_path, fields(name)")
        .eq("farmer_id", user.id)
        .order("captured_at", { ascending: false });

      if (error) {
        setState({ scans: [], loading: false, error: error.message });
        return;
      }

      const rows = data ?? [];
      const paths = rows.map((r) => r.storage_path).filter((p): p is string => Boolean(p));
      const urlByPath = new Map<string, string>();

      if (paths.length) {
        const { data: signed } = await supabase.storage
          .from(STORAGE_BUCKETS.scans)
          .createSignedUrls(paths, 60 * 60);
        for (const item of signed ?? []) {
          if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl);
        }
      }

      const scans: SavedScan[] = rows.map((row) => {
        const fieldJoin = row.fields as { name?: string } | { name?: string }[] | null;
        const fieldName = Array.isArray(fieldJoin) ? fieldJoin[0]?.name : fieldJoin?.name;
        const presented = presentedFromRow(row);
        return {
          id: row.id,
          fieldId: row.field_id,
          fieldName: fieldName ?? null,
          at: row.captured_at,
          preview: (row.storage_path && urlByPath.get(row.storage_path)) || "",
          storagePath: row.storage_path,
          presented,
        };
      });

      setState({ scans, loading: false, error: null });
    } catch (err) {
      setState({
        scans: [],
        loading: false,
        error: err instanceof Error ? err.message : "loadFailed",
      });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    ...state,
    reload,
    setScans: (updater: SavedScan[] | ((prev: SavedScan[]) => SavedScan[])) => {
      setState((prev) => ({
        ...prev,
        scans: typeof updater === "function" ? updater(prev.scans) : updater,
      }));
    },
  };
}

function presentedFromRow(row: {
  title: string | null;
  latin_name: string | null;
  diagnosis: unknown;
  confidence: number | null;
  source: string;
}): Presented {
  const dx = row.diagnosis as ScanDiagnosisJson | null;
  if (dx?.presented && isPresented(dx.presented)) {
    return {
      ...dx.presented,
      confidence: dx.presented.confidence ?? row.confidence ?? undefined,
      source:
        dx.presented.source ??
        (row.source === "gemini" || row.source === "demo" || row.source === "model" ? row.source : undefined),
      latin: dx.presented.latin ?? row.latin_name ?? undefined,
      title: dx.presented.title || row.title || "Scan",
    };
  }

  const mode = dx?.mode === "fruit" || dx?.mode === "trap" || dx?.mode === "leaf" ? dx.mode : "leaf";
  return {
    mode,
    title: row.title ?? "Scan",
    latin: row.latin_name ?? undefined,
    summary: "",
    tone: "neutral",
    pillKey: "watch",
    confidence: row.confidence ?? undefined,
    source: row.source === "gemini" || row.source === "demo" || row.source === "model" ? row.source : undefined,
    actionKind: mode === "trap" ? "trap" : "care",
    showNoChemicals: true,
  };
}

function isPresented(v: unknown): v is Presented {
  if (!v || typeof v !== "object") return false;
  const p = v as Presented;
  return typeof p.title === "string" && typeof p.mode === "string" && typeof p.tone === "string";
}

export function scanNeedsRecheck(scan: SavedScan, afterDays = 7): boolean {
  if (scan.presented.pillKey === "healthy") return false;
  const ageDays = (Date.now() - new Date(scan.at).getTime()) / 86_400_000;
  return ageDays >= afterDays;
}

/** @internal narrow for tone fallback */
export type { PillTone };
