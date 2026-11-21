import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { euCheck } from "@/features/logbook/eu-check";
import type { LogbookEntryView } from "@/features/logbook/use-farmer-logbook";

type Draft = {
  product: string;
  substances: string[];
  licence: string | null;
  dose: string | null;
  fieldId: string;
  fieldName: string;
  /** ISO date YYYY-MM-DD; defaults to today. */
  appliedOn?: string | null;
  preHarvestDays?: number | null;
};

type SaveResult =
  | { ok: true; entry: LogbookEntryView }
  | { ok: false; error: "needSupabase" | "needLogin" | "insertFailed"; detail?: string };

function appliedAtFromDate(isoDate: string | null | undefined): string {
  if (isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return `${isoDate}T12:00:00.000Z`;
  }
  return new Date().toISOString();
}

/** Insert a spray row into `logbook_entries` with EU check flags. */
export async function saveLogbookEntry(draft: Draft): Promise<SaveResult> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "needLogin" };

  const check = euCheck(draft.substances, draft.product);
  const appliedAt = appliedAtFromDate(draft.appliedOn);
  const phi =
    draft.preHarvestDays != null && Number.isFinite(draft.preHarvestDays)
      ? Math.max(0, Math.round(draft.preHarvestDays))
      : null;

  const { data: row, error } = await supabase
    .from("logbook_entries")
    .insert({
      field_id: draft.fieldId,
      farmer_id: user.id,
      kind: "spray",
      product_name: draft.product.trim(),
      active_substances: draft.substances,
      dose: draft.dose,
      licence: draft.licence,
      eu_banned: check.banned,
      eu_status: check.status,
      eu_hits: check.hits,
      applied_at: appliedAt,
      pre_harvest_days: phi,
      from_label_scan: false,
    })
    .select("id, applied_at, pre_harvest_days")
    .single();

  if (error || !row) {
    return { ok: false, error: "insertFailed", detail: error?.message };
  }

  return {
    ok: true,
    entry: {
      id: row.id,
      product: draft.product.trim(),
      substances: draft.substances,
      banned: check.banned,
      euStatus: check.status,
      hits: check.hits,
      at: row.applied_at,
      fieldId: draft.fieldId,
      fieldName: draft.fieldName,
      licence: draft.licence,
      dose: draft.dose,
      preHarvestDays: row.pre_harvest_days,
    },
  };
}

export async function deleteLogbookEntry(entryId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const { error } = await supabase.from("logbook_entries").delete().eq("id", entryId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
