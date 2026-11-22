import { DEFAULT_LOCALE } from "@/core/config/constants";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { varietyAgronomyContext } from "@/features/fields/olive-varieties";
import type { OilCategory, OilStorage, ProductKind } from "@/shared/types/database";

export type PublishLotInput = {
  /** Optional for oil (bulk stock); required for olives. */
  fieldId?: string | null;
  product?: ProductKind;
  variety: string | null;
  varietySlug: string | null;
  /** Always in tons for DB (oil: pass kg/1000). */
  tons: number;
  pricePerKg: number;
  negotiable: boolean;
  delivery: "pickup" | "deliver";
  /** Legacy preset window index; ignored when harvestStart/End are set. */
  periodIndex?: number;
  /** Inclusive harvest window (YYYY-MM-DD), preferred over periodIndex. */
  harvestStart?: string;
  harvestEnd?: string;
  region?: string | null;
  country?: "GR" | "TR" | null;
  qualityScore?: number | null;
  oilCategory?: OilCategory | null;
  acidity?: number | null;
  harvestSeason?: string | null;
  storage?: OilStorage | null;
  peroxide?: number | null;
  polyphenols?: number | null;
  pdoPgi?: string | null;
  organic?: boolean;
  /**
   * Flow B: offer to a mill buy-request.
   * Creates a non-public (`draft`) lot + farmer-initiated offer so mills don't
   * also see it as an open listing for Flow A bids.
   */
  processorId?: string | null;
  buyRequestId?: string | null;
};

type PublishResult =
  | { ok: true; lotId: string; offerId?: string }
  | {
      ok: false;
      error: "needSupabase" | "needLogin" | "insertFailed" | "offerFailed";
      detail?: string;
    };

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

  const product: ProductKind = input.product ?? "olives";
  if (product === "olives" && !input.fieldId) {
    return { ok: false, error: "insertFailed", detail: "field required for olives" };
  }
  if (product === "oil" && (input.oilCategory == null || input.acidity == null)) {
    return { ok: false, error: "insertFailed", detail: "oil category and acidity required" };
  }

  const agro = varietyAgronomyContext(input.varietySlug ?? input.variety);
  const useType = agro?.primary_use === "TABLE" ? "table" : "oil";
  const variety =
    (input.varietySlug && input.varietySlug !== "other" ? input.varietySlug : null) ||
    input.variety ||
    "olive";
  const period =
    input.harvestStart && input.harvestEnd
      ? { start: input.harvestStart, end: input.harvestEnd }
      : PERIOD_DATES[input.periodIndex ?? 0] ?? PERIOD_DATES[0]!;

  let region = input.region?.trim() || null;
  let country = input.country ?? null;
  if (!region || !country) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("place, country")
      .eq("id", user.id)
      .maybeSingle();
    region = region || profile?.place?.trim() || null;
    if (!country && (profile?.country === "GR" || profile?.country === "TR")) {
      country = profile.country;
    }
  }

  let qualityScore = input.qualityScore ?? null;
  if (qualityScore == null && input.fieldId) {
    const { data: qs } = await supabase
      .from("quality_scores")
      .select("score")
      .eq("field_id", input.fieldId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    qualityScore = qs?.score ?? null;
  }

  let lat: number | null = null;
  let lon: number | null = null;
  if (input.fieldId) {
    const { data: field } = await supabase
      .from("fields")
      .select("lat, lon")
      .eq("id", input.fieldId)
      .maybeSingle();
    lat = field?.lat ?? null;
    lon = field?.lon ?? null;
  }

  const { data: localeProfile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .maybeSingle();
  const geoLocale =
    localeProfile?.locale === "tr" || localeProfile?.locale === "en" || localeProfile?.locale === "el"
      ? localeProfile.locale
      : DEFAULT_LOCALE;

  // Prefer a Mapbox place label when coords exist (same source as the farmer home line).
  let town: string | null = null;
  if (lat != null && lon != null) {
    try {
      const { reverseGeocodePlace } = await import("@/features/fields/reverse-geocode");
      const place = await reverseGeocodePlace(lat, lon, geoLocale);
      if (place) {
        const [t, ...rest] = place.split(",").map((s) => s.trim());
        town = t || null;
        if (rest.length) region = rest.join(", ");
      }
    } catch {
      /* keep region fallback */
    }
  }

  if (!region) {
    region = country === "TR" ? "İzmir" : country === "GR" ? "Βόρειο Αιγαίο" : "—";
  }

  const targetedOffer = Boolean(input.processorId);
  // Flow A: public listed lot for mills to bid on.
  // Flow B: draft lot + direct offer to one mill (not open marketplace).
  const { data: row, error } = await supabase
    .from("lots")
    .insert({
      farmer_id: user.id,
      field_id: input.fieldId ?? null,
      status: targetedOffer ? "draft" : "listed",
      product,
      use_type: useType,
      variety,
      tons: input.tons,
      price_per_kg: input.pricePerKg,
      negotiable: input.negotiable,
      delivery_mode: input.delivery,
      town,
      region,
      country,
      lat,
      lon,
      harvest_start: period.start,
      harvest_end: period.end,
      quality_score: qualityScore,
      oil_category: product === "oil" ? input.oilCategory ?? null : null,
      acidity: product === "oil" ? input.acidity ?? null : null,
      harvest_season: product === "oil" ? input.harvestSeason ?? null : null,
      storage: product === "oil" ? input.storage ?? null : null,
      peroxide: product === "oil" ? input.peroxide ?? null : null,
      polyphenols: product === "oil" ? input.polyphenols ?? null : null,
      pdo_pgi: product === "oil" ? input.pdoPgi ?? null : null,
      organic: product === "oil" ? Boolean(input.organic) : false,
      listed_at: targetedOffer ? null : new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !row) {
    return { ok: false, error: "insertFailed", detail: error?.message };
  }

  if (input.processorId) {
    const { data: offer, error: offerError } = await supabase
      .from("offers")
      .insert({
        lot_id: row.id,
        farmer_id: user.id,
        processor_id: input.processorId,
        initiated_by: "farmer",
        status: "pending",
        tons: input.tons,
        price_per_kg: input.pricePerKg,
        delivery_in_days: input.delivery === "deliver" ? 2 : 0,
        buy_request_id: input.buyRequestId || null,
      })
      .select("id")
      .single();
    if (offerError || !offer) {
      return { ok: false, error: "offerFailed", detail: offerError?.message };
    }
    return { ok: true, lotId: row.id, offerId: offer.id };
  }

  return { ok: true, lotId: row.id };
}
