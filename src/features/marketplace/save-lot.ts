import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { varietyAgronomyContext } from "@/features/fields/olive-varieties";

export type PublishLotInput = {
  fieldId: string;
  variety: string | null;
  varietySlug: string | null;
  tons: number;
  pricePerKg: number;
  negotiable: boolean;
  delivery: "pickup" | "deliver";
  /** Free-text harvest window label stored via harvest dates approx. */
  periodIndex: number;
  region?: string | null;
  country?: "GR" | "TR" | null;
  qualityScore?: number | null;
};

type PublishResult =
  | { ok: true; lotId: string }
  | { ok: false; error: "needSupabase" | "needLogin" | "insertFailed"; detail?: string };

const PERIOD_DATES: { start: string; end: string }[] = [
  { start: "2026-11-03", end: "2026-11-10" },
  { start: "2026-11-11", end: "2026-11-18" },
  { start: "2026-11-19", end: "2026-11-26" },
  { start: "2026-11-27", end: "2026-12-04" },
];

/** Insert a listed lot for the signed-in farmer. */
export async function publishLot(input: PublishLotInput): Promise<PublishResult> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "needLogin" };

  const agro = varietyAgronomyContext(input.varietySlug ?? input.variety);
  const useType = agro?.primary_use === "TABLE" ? "table" : "oil";
  const variety =
    (input.varietySlug && input.varietySlug !== "other" ? input.varietySlug : null) ||
    input.variety ||
    "olive";
  const period = PERIOD_DATES[input.periodIndex] ?? PERIOD_DATES[0]!;

  let region = input.region?.trim() || null;
  let country = input.country ?? null;
  if (!region || !country) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("place, country")
      .eq("id", user.id)
      .maybeSingle();
    region = region || profile?.place?.trim() || "Peloponnese";
    if (!country && (profile?.country === "GR" || profile?.country === "TR")) {
      country = profile.country;
    }
  }

  let qualityScore = input.qualityScore ?? null;
  if (qualityScore == null) {
    const { data: qs } = await supabase
      .from("quality_scores")
      .select("score")
      .eq("field_id", input.fieldId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    qualityScore = qs?.score ?? null;
  }

  const { data: row, error } = await supabase
    .from("lots")
    .insert({
      farmer_id: user.id,
      field_id: input.fieldId,
      status: "listed",
      use_type: useType,
      variety,
      tons: input.tons,
      price_per_kg: input.pricePerKg,
      negotiable: input.negotiable,
      delivery_mode: input.delivery,
      region,
      country,
      harvest_start: period.start,
      harvest_end: period.end,
      quality_score: qualityScore,
      listed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !row) {
    return { ok: false, error: "insertFailed", detail: error?.message };
  }

  return { ok: true, lotId: row.id };
}
