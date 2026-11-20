"use client";

import { useCallback, useEffect, useState } from "react";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import type { QualityBreakdown, QualityPlanItem } from "@/features/quality/score-engine";

export type FieldQuality = {
  id: string;
  score: number;
  breakdown: QualityBreakdown;
  plan: QualityPlanItem[];
  engineVersion: string;
  computedAt: string;
};

type State = {
  current: FieldQuality | null;
  previous: FieldQuality | null;
  loading: boolean;
  error: string | null;
};

function parseBreakdown(raw: unknown): QualityBreakdown {
  const b = (raw ?? {}) as Partial<QualityBreakdown>;
  return {
    tree: Number(b.tree ?? 0),
    spray: Number(b.spray ?? 0),
    harvest: Number(b.harvest ?? 0),
    records: Number(b.records ?? 0),
  };
}

function parsePlan(raw: unknown): QualityPlanItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { text?: string; points?: number };
      if (typeof row.text !== "string") return null;
      return { text: row.text, points: Number(row.points ?? 0) };
    })
    .filter((x): x is QualityPlanItem => x != null);
}

/** Latest + previous quality_scores rows for one field (delta / history). */
export function useFieldQuality(fieldId: string | null) {
  const [state, setState] = useState<State>({
    current: null,
    previous: null,
    loading: Boolean(fieldId),
    error: null,
  });

  const reload = useCallback(async () => {
    if (!fieldId) {
      setState({ current: null, previous: null, loading: false, error: null });
      return;
    }
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      setState({ current: null, previous: null, loading: false, error: "needSupabase" });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const { data, error } = await supabase
        .from("quality_scores")
        .select("id, score, breakdown, plan, engine_version, computed_at")
        .eq("field_id", fieldId)
        .order("computed_at", { ascending: false })
        .limit(2);

      if (error) {
        setState({ current: null, previous: null, loading: false, error: error.message });
        return;
      }

      const rows = (data ?? []).map((row) => ({
        id: row.id,
        score: row.score,
        breakdown: parseBreakdown(row.breakdown),
        plan: parsePlan(row.plan),
        engineVersion: row.engine_version,
        computedAt: row.computed_at,
      }));

      setState({
        current: rows[0] ?? null,
        previous: rows[1] ?? null,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState({
        current: null,
        previous: null,
        loading: false,
        error: err instanceof Error ? err.message : "loadFailed",
      });
    }
  }, [fieldId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
