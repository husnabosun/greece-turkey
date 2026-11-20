"use client";

import { useCallback, useEffect, useState } from "react";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";

export type LogbookEntryView = {
  id: string;
  product: string;
  substances: string[];
  banned: boolean;
  hits: string[];
  at: string;
  fieldId: string | null;
  fieldName: string | null;
  licence: string | null;
  dose: string | null;
  preHarvestDays: number | null;
};

type State = {
  entries: LogbookEntryView[];
  loading: boolean;
  error: string | null;
};

/** Loads spray/logbook rows for the signed-in farmer. */
export function useFarmerLogbook() {
  const [state, setState] = useState<State>({ entries: [], loading: true, error: null });

  const reload = useCallback(async () => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      setState({ entries: [], loading: false, error: "needSupabase" });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setState({ entries: [], loading: false, error: "needLogin" });
        return;
      }

      const { data, error } = await supabase
        .from("logbook_entries")
        .select(
          "id, field_id, product_name, active_substances, dose, licence, eu_banned, eu_hits, applied_at, pre_harvest_days, fields(name)",
        )
        .eq("farmer_id", user.id)
        .order("applied_at", { ascending: false });

      if (error) {
        setState({ entries: [], loading: false, error: error.message });
        return;
      }

      const entries: LogbookEntryView[] = (data ?? []).map((row) => {
        const fieldJoin = row.fields as { name?: string } | { name?: string }[] | null;
        const fieldName = Array.isArray(fieldJoin) ? fieldJoin[0]?.name : fieldJoin?.name;
        return {
          id: row.id,
          product: row.product_name,
          substances: row.active_substances ?? [],
          banned: row.eu_banned,
          hits: row.eu_hits ?? [],
          at: row.applied_at,
          fieldId: row.field_id,
          fieldName: fieldName ?? null,
          licence: row.licence,
          dose: row.dose,
          preHarvestDays: row.pre_harvest_days,
        };
      });

      setState({ entries, loading: false, error: null });
    } catch (err) {
      setState({
        entries: [],
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
    setEntries: (updater: LogbookEntryView[] | ((prev: LogbookEntryView[]) => LogbookEntryView[])) => {
      setState((prev) => ({
        ...prev,
        entries: typeof updater === "function" ? updater(prev.entries) : updater,
      }));
    },
  };
}

/** Days until safe harvest from the latest spray with PHI, or null. */
export function safeHarvestDays(entries: LogbookEntryView[]): number | null {
  let best: number | null = null;
  for (const e of entries) {
    if (e.preHarvestDays == null || e.preHarvestDays < 0) continue;
    const applied = new Date(e.at).getTime();
    const unlock = applied + e.preHarvestDays * 86_400_000;
    const daysLeft = Math.ceil((unlock - Date.now()) / 86_400_000);
    const clamped = Math.max(0, daysLeft);
    if (best == null || clamped > best) best = clamped;
  }
  return best;
}
