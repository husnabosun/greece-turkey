"use client";

import { useCallback, useEffect, useState } from "react";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import type { Field } from "@/shared/types/database";

type State = {
  fields: Field[];
  loading: boolean;
  error: string | null;
};

/** Loads the signed-in farmer's fields from Supabase (no mock rows). */
export function useFarmerFields() {
  const [state, setState] = useState<State>({ fields: [], loading: true, error: null });

  const reload = useCallback(async () => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      setState({ fields: [], loading: false, error: "needSupabase" });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setState({ fields: [], loading: false, error: "needLogin" });
      return;
    }

    const { data, error } = await supabase
      .from("fields")
      .select("*")
      .eq("farmer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setState({ fields: [], loading: false, error: error.message });
      return;
    }
    setState({ fields: (data as Field[]) ?? [], loading: false, error: null });
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const primary = state.fields.find((f) => f.lat != null && f.lon != null) ?? state.fields[0] ?? null;
  return { ...state, primary, reload };
}
