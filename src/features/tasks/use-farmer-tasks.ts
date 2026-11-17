"use client";

import { useCallback, useEffect, useState } from "react";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import type { TaskKind } from "@/shared/types/database";

export type FarmerTask = {
  id: string;
  fieldId: string;
  fieldName: string | null;
  treeId: string | null;
  title: string;
  meta: string | null;
  kind: TaskKind;
  why: string | null;
  urgent: boolean;
  dueOn: string | null;
  done: boolean;
};

type State = {
  tasks: FarmerTask[];
  loading: boolean;
  error: string | null;
};

/** Load and complete farmer tasks from Supabase. */
export function useFarmerTasks() {
  const [state, setState] = useState<State>({ tasks: [], loading: true, error: null });

  const reload = useCallback(async () => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      setState({ tasks: [], loading: false, error: "needSupabase" });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setState({ tasks: [], loading: false, error: "needLogin" });
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .select("id, field_id, tree_id, title, meta, kind, why, urgent, due_on, done, fields(name)")
        .eq("farmer_id", user.id)
        .order("done", { ascending: true })
        .order("urgent", { ascending: false })
        .order("due_on", { ascending: true });

      if (error) {
        setState({ tasks: [], loading: false, error: error.message });
        return;
      }

      const tasks: FarmerTask[] = (data ?? []).map((row) => {
        const fieldJoin = row.fields as { name?: string } | { name?: string }[] | null;
        const fieldName = Array.isArray(fieldJoin) ? fieldJoin[0]?.name : fieldJoin?.name;
        return {
          id: row.id,
          fieldId: row.field_id,
          fieldName: fieldName ?? null,
          treeId: row.tree_id,
          title: row.title,
          meta: row.meta,
          kind: row.kind as TaskKind,
          why: row.why,
          urgent: row.urgent,
          dueOn: row.due_on,
          done: row.done,
        };
      });

      setState({ tasks, loading: false, error: null });
    } catch (err) {
      setState({
        tasks: [],
        loading: false,
        error: err instanceof Error ? err.message : "loadFailed",
      });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

export async function completeTask(taskId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const { error } = await supabase
    .from("tasks")
    .update({ done: true, completed_at: new Date().toISOString() })
    .eq("id", taskId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
