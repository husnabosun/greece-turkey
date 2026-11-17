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

  const markLocalDone = useCallback((taskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, done: true } : task)),
    }));
  }, []);

  const removeLocal = useCallback((taskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((task) => task.id !== taskId),
    }));
  }, []);

  const prependLocal = useCallback((task: FarmerTask) => {
    setState((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
  }, []);

  return { ...state, reload, markLocalDone, removeLocal, prependLocal };
}

export async function completeTask(taskId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const { data, error } = await supabase
    .from("tasks")
    .update({ done: true, completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("done", false)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "notFound" };
  return { ok: true };
}

/** Remove a task the farmer does not want (hard dismiss). */
export async function dismissTask(taskId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function createFarmerTask(input: {
  fieldId: string;
  title: string;
  kind?: TaskKind;
  meta?: string | null;
  why?: string | null;
  urgent?: boolean;
  dueOn?: string | null;
}): Promise<{ ok: true; task: FarmerTask } | { ok: false; error: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "needLogin" };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "needTitle" };

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      field_id: input.fieldId,
      farmer_id: user.id,
      title,
      meta: input.meta ?? null,
      kind: input.kind ?? "plain",
      why: input.why ?? null,
      urgent: input.urgent ?? false,
      due_on: input.dueOn ?? new Date().toISOString().slice(0, 10),
      done: false,
    })
    .select("id, field_id, tree_id, title, meta, kind, why, urgent, due_on, done, fields(name)")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "insertFailed" };

  const fieldJoin = data.fields as { name?: string } | { name?: string }[] | null;
  const fieldName = Array.isArray(fieldJoin) ? fieldJoin[0]?.name : fieldJoin?.name;
  return {
    ok: true,
    task: {
      id: data.id,
      fieldId: data.field_id,
      fieldName: fieldName ?? null,
      treeId: data.tree_id,
      title: data.title,
      meta: data.meta,
      kind: data.kind as TaskKind,
      why: data.why,
      urgent: data.urgent,
      dueOn: data.due_on,
      done: data.done,
    },
  };
}

/**
 * After a scan is saved: finish the task that opened the camera, or the first
 * open photo/recheck task on that field (demo parity with Expo store.saveScan).
 */
export async function completeTasksAfterScan(opts: {
  fieldId: string;
  taskId?: string | null;
  treeId?: string | null;
}): Promise<{ ok: boolean; completedId?: string; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "needLogin" };

  if (opts.taskId) {
    const { data: row } = await supabase
      .from("tasks")
      .select("id, done, field_id")
      .eq("id", opts.taskId)
      .eq("farmer_id", user.id)
      .maybeSingle();
    if (row && !row.done && row.field_id === opts.fieldId) {
      const result = await completeTask(row.id);
      return result.ok ? { ok: true, completedId: row.id } : result;
    }
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("id, kind, tree_id")
    .eq("farmer_id", user.id)
    .eq("field_id", opts.fieldId)
    .eq("done", false)
    .in("kind", ["photo", "recheck"])
    .order("urgent", { ascending: false })
    .order("due_on", { ascending: true });

  if (error) return { ok: false, error: error.message };

  const match =
    (opts.treeId
      ? data?.find((row) => row.kind === "recheck" && row.tree_id === opts.treeId)
      : undefined) ??
    data?.find((row) => row.kind === "photo") ??
    data?.find((row) => row.kind === "recheck");

  if (!match) return { ok: true };
  const result = await completeTask(match.id);
  return result.ok ? { ok: true, completedId: match.id } : result;
}
