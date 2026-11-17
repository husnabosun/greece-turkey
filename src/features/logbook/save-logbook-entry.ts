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
};

type SaveResult =
  | { ok: true; entry: LogbookEntryView }
  | { ok: false; error: "needSupabase" | "needLogin" | "insertFailed"; detail?: string };

/** Insert a spray row into `logbook_entries` with EU check flags. */
export async function saveLogbookEntry(draft: Draft): Promise<SaveResult> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "needLogin" };

  const check = euCheck(draft.substances);
  const appliedAt = new Date().toISOString();

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
      eu_hits: check.hits,
      applied_at: appliedAt,
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
