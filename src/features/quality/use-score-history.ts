"use client";

import { useEffect, useState } from "react";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import {
  buildScoreHistory,
  historyWindowStart,
  type ScoreHistory,
} from "@/features/quality/score-history";

type State = { history: ScoreHistory | null; loading: boolean };

/**
 * Last 6 months of `quality_scores` for one field, shaped for the chart.
 * Selects only score + timestamp: no farmer id, so it is safe to show to processors (RLS limits them to
 * listed / unlocked lots).
 */
export function useScoreHistory(fieldId: string | null | undefined, refreshKey?: string | number | null) {
  const [state, setState] = useState<State>({ history: null, loading: Boolean(fieldId) });

  useEffect(() => {
    if (!fieldId) {
      setState({ history: null, loading: false });
      return;
    }
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      setState({ history: null, loading: false });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("quality_scores")
          .select("score, computed_at")
          .eq("field_id", fieldId)
          .gte("computed_at", historyWindowStart().toISOString())
          .order("computed_at", { ascending: true })
          .limit(500);
        if (cancelled) return;
        if (error) {
          setState({ history: null, loading: false });
          return;
        }
        const rows = (data ?? []).map((r) => ({ score: r.score, computedAt: r.computed_at }));
        setState({ history: buildScoreHistory(rows), loading: false });
      } catch {
        if (!cancelled) setState({ history: null, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fieldId, refreshKey]);

  return state;
}
