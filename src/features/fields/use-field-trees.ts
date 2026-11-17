"use client";

import { useEffect, useState } from "react";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import type { FieldTree } from "@/shared/types/database";
import type { MapTree, MapTreeStatus } from "@/features/fields/field-health-map";
import { DEMO_FIELD_TREES, pickDefaultTreeId } from "@/features/fields/demo-trees";

type State = {
  trees: MapTree[];
  loading: boolean;
  fromDemo: boolean;
};

function toMapTree(row: FieldTree, displayId: number): MapTree | null {
  if (row.x_pct == null || row.y_pct == null) return null;
  const status = row.status as MapTreeStatus;
  if (status !== "healthy" && status !== "suspicious" && status !== "diseased") return null;
  return {
    id: displayId,
    uuid: row.id,
    x: Number(row.x_pct),
    y: Number(row.y_pct),
    status,
    issue: row.issue,
  };
}

/** Loads `field_trees` for one field. Falls back to demo dots when the table is empty. */
export function useFieldTrees(fieldId: string | null | undefined) {
  const [state, setState] = useState<State>({ trees: [], loading: Boolean(fieldId), fromDemo: false });

  useEffect(() => {
    if (!fieldId) {
      setState({ trees: [], loading: false, fromDemo: false });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    void (async () => {
      const supabase = tryCreateBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setState({ trees: DEMO_FIELD_TREES, loading: false, fromDemo: true });
        }
        return;
      }

      const { data, error } = await supabase
        .from("field_trees")
        .select("*")
        .eq("field_id", fieldId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error || !data?.length) {
        setState({ trees: DEMO_FIELD_TREES, loading: false, fromDemo: true });
        return;
      }

      const trees = (data as FieldTree[])
        .map((row, i) => toMapTree(row, i + 1))
        .filter((t): t is MapTree => t != null);

      setState({
        trees: trees.length ? trees : DEMO_FIELD_TREES,
        loading: false,
        fromDemo: trees.length === 0,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [fieldId]);

  return { ...state, defaultSelectedId: pickDefaultTreeId(state.trees) };
}
