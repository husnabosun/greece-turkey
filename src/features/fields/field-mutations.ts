import { tryCreateBrowserClient } from "@/core/supabase/safe-client";

export async function updateFarmerField(input: {
  fieldId: string;
  name: string;
  treeCount: number | null;
  varietySlug: string | null;
  irrigated: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "needName" };

  const { error } = await supabase
    .from("fields")
    .update({
      name,
      tree_count: input.treeCount,
      variety: input.varietySlug === "other" ? null : input.varietySlug,
      variety_slug: input.varietySlug,
      irrigated: input.irrigated,
    })
    .eq("id", input.fieldId);

  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteFarmerField(fieldId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const { error } = await supabase.from("fields").delete().eq("id", fieldId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
