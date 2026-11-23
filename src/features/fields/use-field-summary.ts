"use client";

import { useEffect, useState } from "react";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";

type State = { lastScanAt: string | null; openTasks: number | null; loading: boolean };

/** Last scan date + open task count for one field (the summary shown when no tree is selected). */
export function useFieldSummary(fieldId: string | null | undefined): State {
  const [state, setState] = useState<State>({ lastScanAt: null, openTasks: null, loading: Boolean(fieldId) });

  useEffect(() => {
    setState({ lastScanAt: null, openTasks: null, loading: Boolean(fieldId) });
    const supabase = tryCreateBrowserClient();
    if (!fieldId || !supabase) return;
    let cancelled = false;
    void (async () => {
      try {
        const [scanRes, taskRes] = await Promise.all([
          supabase
            .from("scans")
            .select("captured_at")
            .eq("field_id", fieldId)
            .order("captured_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("field_id", fieldId)
            .eq("done", false),
        ]);
        if (cancelled) return;
        setState({
          lastScanAt: (scanRes.data?.captured_at as string | undefined) ?? null,
          openTasks: taskRes.error ? null : (taskRes.count ?? 0),
          loading: false,
        });
      } catch {
        if (!cancelled) setState({ lastScanAt: null, openTasks: null, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fieldId]);

  return state;
}
