"use client";

import { useCallback, useEffect, useState } from "react";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { nextDeliveryStatus } from "@/features/marketplace/delivery-state";
import { formatDateRange, formatDateShort } from "@/features/marketplace/pricing";
import { regionLabel } from "@/features/marketplace/regions";
import {
  DEFAULT_DELIVERY_IN_DAYS,
  addDaysIso,
  deliveryInDaysFromIso,
  todayIsoDate,
} from "@/features/marketplace/schedule";
import type { DeliveryStatus, LabResult, LotUse } from "@/shared/types/database";

export type ProcessorLot = {
  id: string;
  status: string;
  useType: LotUse;
  variety: string;
  tons: number;
  pricePerKg: number | null;
  negotiable: boolean;
  deliveryMode: "pickup" | "deliver" | null;
  town: string | null;
  region: string;
  country: string | null;
  lat: number | null;
  lon: number | null;
  harvestStart: string | null;
  harvestEnd: string | null;
  qualityScore: number | null;
  hasBannedSpray: boolean;
  labResult: LabResult | null;
  labAcidity: number | null;
  fieldId: string | null;
  farmerId: string | null;
  farmerDisplayName: string | null;
  listedAt: string | null;
};

export type ProcessorOffer = {
  id: string;
  lotId: string;
  farmerId: string;
  status: string;
  tons: number;
  pricePerKg: number;
  initiatedBy: "farmer" | "processor";
  message: string | null;
  buyRequestId: string | null;
  lot: ProcessorLot | null;
};

export type ProcessorRequest = {
  id: string;
  variety: string;
  tons: number;
  filledTons: number;
  minScore: number;
  region: string | null;
  windowLabel: string | null;
  noBanned: boolean;
  active: boolean;
};

export type ProcessorDelivery = {
  id: string;
  offerId: string;
  lotId: string;
  status: DeliveryStatus;
  tons: number;
  pricePerKg: number;
  scheduledFor: string | null;
  actualKg: number | null;
  qualityScoreSnapshot: number | null;
  bannedFree: boolean | null;
  farmerName: string | null;
  lotVariety: string | null;
  lotRegion: string | null;
};

export type SupplyRow = {
  region: string;
  weekTons: [number, number, number, number];
};

type State = {
  lots: ProcessorLot[];
  offers: ProcessorOffer[];
  requests: ProcessorRequest[];
  deliveries: ProcessorDelivery[];
  supply: SupplyRow[];
  loading: boolean;
  error: string | null;
};

const EMPTY: State = {
  lots: [],
  offers: [],
  requests: [],
  deliveries: [],
  supply: [],
  loading: true,
  error: null,
};

function mapLot(row: Record<string, unknown>): ProcessorLot {
  return {
    id: String(row.id),
    status: String(row.status),
    useType: (row.use_type as LotUse) ?? "oil",
    variety: String(row.variety ?? "olive"),
    tons: Number(row.tons),
    pricePerKg: row.price_per_kg == null ? null : Number(row.price_per_kg),
    negotiable: Boolean(row.negotiable ?? true),
    deliveryMode: (row.delivery_mode as "pickup" | "deliver" | null) ?? null,
    town: (row.town as string | null) ?? null,
    region: String(row.region ?? "—"),
    country: (row.country as string | null) ?? null,
    lat: row.lat == null ? null : Number(row.lat),
    lon: row.lon == null ? null : Number(row.lon),
    harvestStart: (row.harvest_start as string | null) ?? null,
    harvestEnd: (row.harvest_end as string | null) ?? null,
    qualityScore: row.quality_score == null ? null : Number(row.quality_score),
    hasBannedSpray: Boolean(row.has_banned_spray),
    labResult: (row.lab_result as LabResult | null) ?? null,
    labAcidity: row.lab_acidity == null ? null : Number(row.lab_acidity),
    fieldId: (row.field_id as string | null) ?? null,
    farmerId: (row.farmer_id as string | null) ?? null,
    farmerDisplayName: (row.farmer_display_name as string | null) ?? null,
    listedAt: (row.listed_at as string | null) ?? null,
  };
}

function weekBucket(harvestStart: string | null, now = new Date()): 0 | 1 | 2 | 3 | null {
  if (!harvestStart) return null;
  const start = new Date(`${harvestStart}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  const diffDays = Math.floor((start.getTime() - now.getTime()) / 86_400_000);
  if (diffDays < 0) return 0;
  if (diffDays < 7) return 0;
  if (diffDays < 14) return 1;
  if (diffDays < 21) return 2;
  if (diffDays < 28) return 3;
  return null;
}

function buildSupply(lots: ProcessorLot[]): SupplyRow[] {
  const byRegion = new Map<string, [number, number, number, number]>();
  for (const lot of lots) {
    if (lot.status !== "listed" && lot.status !== "reserved") continue;
    const bucket = weekBucket(lot.harvestStart);
    if (bucket == null) continue;
    const row = byRegion.get(lot.region) ?? [0, 0, 0, 0];
    row[bucket] += lot.tons;
    byRegion.set(lot.region, row);
  }
  return [...byRegion.entries()]
    .map(([region, weekTons]) => ({ region, weekTons }))
    .sort((a, b) => a.region.localeCompare(b.region));
}

/** Processor marketplace: listed lots, own requests/offers/deliveries. */
export function useProcessorMarket() {
  const [state, setState] = useState<State>(EMPTY);

  const reload = useCallback(async () => {
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      setState({ ...EMPTY, loading: false, error: "needSupabase" });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setState({ ...EMPTY, loading: false, error: "needLogin" });
        return;
      }

      const [lotsRes, offersRes, requestsRes, deliveriesRes] = await Promise.all([
        // Only real marketplace rows (farmer-published lots), never raw fields.
        // Use `lots` (not the masked view) so processor bids can include farmer_id.
        supabase
          .from("lots")
          .select(
            "id, status, use_type, variety, tons, price_per_kg, negotiable, delivery_mode, town, region, country, lat, lon, harvest_start, harvest_end, quality_score, has_banned_spray, lab_result, lab_acidity, listed_at, field_id, farmer_id, identity_unlocked_for",
          )
          .in("status", ["listed", "reserved", "sold"])
          .not("listed_at", "is", null)
          .order("quality_score", { ascending: false, nullsFirst: false }),
        supabase
          .from("offers")
          .select("id, lot_id, farmer_id, status, tons, price_per_kg, initiated_by, message, buy_request_id")
          .eq("processor_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("buy_requests")
          .select("id, variety, tons, filled_tons, min_score, region, window_label, no_banned, active")
          .eq("processor_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("deliveries")
          .select(
            "id, offer_id, lot_id, farmer_id, status, tons, price_per_kg, scheduled_for, actual_kg, quality_score_snapshot, banned_free",
          )
          .eq("processor_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      const offerLotIds = [...new Set((offersRes.data ?? []).map((o) => o.lot_id))];
      const deliveryLotIds = [...new Set((deliveriesRes.data ?? []).map((d) => d.lot_id))];
      const missingLotIds = [...new Set([...offerLotIds, ...deliveryLotIds])].filter(
        (id) => !(lotsRes.data ?? []).some((l) => l.id === id),
      );
      const extraLotsRes =
        missingLotIds.length > 0
          ? await supabase
              .from("lots")
              .select(
                "id, status, use_type, variety, tons, price_per_kg, negotiable, delivery_mode, town, region, country, lat, lon, harvest_start, harvest_end, quality_score, has_banned_spray, lab_result, lab_acidity, listed_at, field_id, farmer_id, identity_unlocked_for",
              )
              .in("id", missingLotIds)
          : { data: [] as NonNullable<typeof lotsRes.data> };

      const allLotRows = [...(lotsRes.data ?? []), ...(extraLotsRes.data ?? [])];

      const unlockedFarmerIds = new Set<string>();
      for (const row of allLotRows) {
        const unlocked = Array.isArray(row.identity_unlocked_for)
          ? (row.identity_unlocked_for as string[]).includes(user.id)
          : false;
        if (unlocked) unlockedFarmerIds.add(row.farmer_id);
      }
      for (const row of deliveriesRes.data ?? []) {
        unlockedFarmerIds.add(row.farmer_id);
      }

      const nameByFarmer = new Map<string, string>();
      if (unlockedFarmerIds.size) {
        const { data: farmers } = await supabase
          .from("profiles")
          .select("id, display_name, company_name")
          .in("id", [...unlockedFarmerIds]);
        for (const p of farmers ?? []) {
          nameByFarmer.set(p.id, p.company_name || p.display_name || "Farmer");
        }
      }

      const lots = allLotRows.map((row) => {
        const unlocked = Array.isArray(row.identity_unlocked_for)
          ? (row.identity_unlocked_for as string[]).includes(user.id)
          : false;
        return mapLot({
          ...(row as Record<string, unknown>),
          farmer_display_name: unlocked ? nameByFarmer.get(row.farmer_id) ?? null : null,
        });
      });
      const lotById = new Map(lots.map((l) => [l.id, l]));

      const offers: ProcessorOffer[] = (offersRes.data ?? []).map((row) => ({
        id: row.id,
        lotId: row.lot_id,
        farmerId: row.farmer_id,
        status: row.status,
        tons: Number(row.tons),
        pricePerKg: Number(row.price_per_kg),
        initiatedBy: row.initiated_by as "farmer" | "processor",
        message: row.message,
        buyRequestId: row.buy_request_id ?? null,
        lot: lotById.get(row.lot_id) ?? null,
      }));

      const requests: ProcessorRequest[] = (requestsRes.data ?? []).map((row) => ({
        id: row.id,
        variety: row.variety,
        tons: Number(row.tons),
        filledTons: Number(row.filled_tons),
        minScore: row.min_score,
        region: row.region,
        windowLabel: row.window_label,
        noBanned: row.no_banned,
        active: row.active,
      }));

      const deliveries: ProcessorDelivery[] = (deliveriesRes.data ?? []).map((row) => {
        const lot = lotById.get(row.lot_id);
        const snapshot =
          row.quality_score_snapshot == null
            ? null
            : Number(row.quality_score_snapshot);
        return {
          id: row.id,
          offerId: row.offer_id,
          lotId: row.lot_id,
          status: row.status as DeliveryStatus,
          tons: Number(row.tons),
          pricePerKg: Number(row.price_per_kg),
          scheduledFor: row.scheduled_for,
          actualKg: row.actual_kg == null ? null : Number(row.actual_kg),
          // Snapshot is often null on older rows — fall back to the lot score.
          qualityScoreSnapshot: snapshot ?? lot?.qualityScore ?? null,
          bannedFree: row.banned_free,
          farmerName: nameByFarmer.get(row.farmer_id) ?? null,
          lotVariety: lot?.variety ?? null,
          lotRegion: lot?.region ?? null,
        };
      });

      setState({
        lots,
        offers,
        requests,
        deliveries,
        supply: buildSupply(lots),
        loading: false,
        error:
          lotsRes.error?.message ||
          offersRes.error?.message ||
          requestsRes.error?.message ||
          deliveriesRes.error?.message ||
          null,
      });
    } catch (err) {
      setState({
        ...EMPTY,
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

export type BuyRequestInput = {
  variety: string;
  tons: number;
  minScore: number;
  region: string | null;
  windowLabel: string;
  noBanned: boolean;
};

export async function createBuyRequest(input: BuyRequestInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "needLogin" };

  const { error } = await supabase.from("buy_requests").insert({
    processor_id: user.id,
    variety: input.variety,
    tons: input.tons,
    min_score: input.minScore,
    region: input.region,
    window_label: input.windowLabel,
    no_banned: input.noBanned,
    shared_with_farmers: true,
    active: true,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function updateBuyRequest(
  id: string,
  input: BuyRequestInput,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "needLogin" };

  const { error } = await supabase
    .from("buy_requests")
    .update({
      variety: input.variety,
      tons: input.tons,
      min_score: input.minScore,
      region: input.region,
      window_label: input.windowLabel,
      no_banned: input.noBanned,
    })
    .eq("id", id)
    .eq("processor_id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function withdrawOffer(offerId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "needLogin" };

  const { data, error } = await supabase
    .from("offers")
    .update({ status: "withdrawn" })
    .eq("id", offerId)
    .eq("status", "pending")
    .eq("initiated_by", "processor")
    .eq("processor_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "notFound" };
  return { ok: true };
}

export async function placeLotOffer(input: {
  lotId: string;
  farmerId: string;
  tons: number;
  pricePerKg: number;
  /** Preferred arrival delay; defaults to 2 days. */
  deliveryInDays?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "needLogin" };

  const deliveryInDays =
    input.deliveryInDays != null && Number.isFinite(input.deliveryInDays)
      ? Math.max(0, Math.round(input.deliveryInDays))
      : DEFAULT_DELIVERY_IN_DAYS;

  const { error } = await supabase.from("offers").insert({
    lot_id: input.lotId,
    farmer_id: input.farmerId,
    processor_id: user.id,
    initiated_by: "processor",
    status: "pending",
    tons: input.tons,
    price_per_kg: input.pricePerKg,
    delivery_in_days: deliveryInDays,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function acceptIncomingOffer(
  offerId: string,
  opts?: { scheduledFor?: string; deliveryInDays?: number },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };

  const { data: offer, error: loadError } = await supabase
    .from("offers")
    .select("id, lot_id, farmer_id, processor_id, tons, price_per_kg, status, delivery_in_days")
    .eq("id", offerId)
    .maybeSingle();
  if (loadError || !offer) return { ok: false, error: loadError?.message ?? "notFound" };

  const deliveryInDays =
    opts?.scheduledFor != null
      ? deliveryInDaysFromIso(opts.scheduledFor)
      : opts?.deliveryInDays != null && Number.isFinite(opts.deliveryInDays)
        ? Math.max(0, Math.round(opts.deliveryInDays))
        : offer.delivery_in_days ?? DEFAULT_DELIVERY_IN_DAYS;
  const scheduledFor = opts?.scheduledFor ?? addDaysIso(todayIsoDate(), deliveryInDays);

  if (offer.status !== "accepted") {
    const { error } = await supabase
      .from("offers")
      .update({ status: "accepted", delivery_in_days: deliveryInDays })
      .eq("id", offerId);
    if (error) return { ok: false, error: error.message };
  }

  const { data: existing } = await supabase
    .from("deliveries")
    .select("id, scheduled_for")
    .eq("offer_id", offerId)
    .maybeSingle();
  if (!existing) {
    const { error: deliveryError } = await supabase.from("deliveries").insert({
      offer_id: offer.id,
      lot_id: offer.lot_id,
      farmer_id: offer.farmer_id,
      processor_id: offer.processor_id,
      tons: offer.tons,
      price_per_kg: offer.price_per_kg,
      status: "scheduled",
      scheduled_for: scheduledFor,
    });
    if (deliveryError) return { ok: false, error: deliveryError.message };
  } else if (!existing.scheduled_for) {
    await supabase.from("deliveries").update({ scheduled_for: scheduledFor }).eq("id", existing.id);
  }

  return { ok: true };
}

export async function scheduleDelivery(
  deliveryId: string,
  scheduledFor: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const { error } = await supabase.from("deliveries").update({ scheduled_for: scheduledFor }).eq("id", deliveryId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function rejectOffer(offerId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const { error } = await supabase.from("offers").update({ status: "rejected" }).eq("id", offerId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deactivateBuyRequest(requestId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const { error } = await supabase
    .from("buy_requests")
    .update({ active: false })
    .eq("id", requestId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function counterIncomingOffer(
  offer: ProcessorOffer,
  newPrice: number,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "needLogin" };

  const { error: updateError } = await supabase
    .from("offers")
    .update({ status: "countered" })
    .eq("id", offer.id);
  if (updateError) return { ok: false, error: updateError.message };

  const { error: insertError } = await supabase.from("offers").insert({
    lot_id: offer.lotId,
    farmer_id: offer.farmerId,
    processor_id: user.id,
    initiated_by: "processor",
    status: "pending",
    tons: offer.tons,
    price_per_kg: newPrice,
    counter_of: offer.id,
  });
  return insertError ? { ok: false, error: insertError.message } : { ok: true };
}

export async function advanceDelivery(
  deliveryId: string,
  current: DeliveryStatus,
  extras?: { actualKg?: number; labResult?: LabResult },
): Promise<{ ok: boolean; error?: string }> {
  const next = nextDeliveryStatus(current);
  if (!next) return { ok: false, error: "terminal" };

  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };

  const patch: {
    status: DeliveryStatus;
    actual_kg?: number;
    lab_result?: LabResult;
    quality_score_snapshot?: number;
  } = { status: next };
  if (next === "weighed" && extras?.actualKg != null) patch.actual_kg = extras.actualKg;
  if (next === "lab_checked") patch.lab_result = extras?.labResult ?? "passed";

  // Persist lot score onto the delivery when first advancing, if still empty.
  if (next === "weighed" || next === "lab_checked") {
    const { data: delivery } = await supabase
      .from("deliveries")
      .select("quality_score_snapshot, lot_id")
      .eq("id", deliveryId)
      .maybeSingle();
    if (delivery && delivery.quality_score_snapshot == null && delivery.lot_id) {
      const { data: lot } = await supabase
        .from("lots")
        .select("quality_score")
        .eq("id", delivery.lot_id)
        .maybeSingle();
      if (lot?.quality_score != null) patch.quality_score_snapshot = Number(lot.quality_score);
    }
  }

  const { error } = await supabase.from("deliveries").update(patch).eq("id", deliveryId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export function lotPlaceLabel(
  lot: Pick<ProcessorLot, "town" | "region" | "farmerDisplayName">,
  anonymous: string,
  geocoded?: string | null,
  locale = "el",
) {
  if (lot.farmerDisplayName) return lot.farmerDisplayName;
  if (geocoded?.trim()) return geocoded.trim();
  const region = regionLabel(lot.region, locale);
  if (lot.town) return `${lot.town}, ${region}`;
  return region !== "—" ? region : anonymous;
}

export function harvestRangeLabel(start: string | null, end: string | null, locale = "el") {
  if (!start && !end) return "—";
  if (start && end) return formatDateRange(start, end, locale);
  return formatDateShort(start ?? end!, locale);
}
