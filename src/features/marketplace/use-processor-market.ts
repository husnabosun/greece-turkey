"use client";

import { errorCode } from "@/shared/lib/error-message";
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
import type {
  DeliveryStatus,
  LabResult,
  LotUse,
  OilCategory,
  OilStorage,
  ProductKind,
} from "@/shared/types/database";

const LOT_SELECT =
  "id, status, product, use_type, variety, tons, price_per_kg, negotiable, delivery_mode, town, region, country, lat, lon, harvest_start, harvest_end, quality_score, has_banned_spray, lab_result, lab_acidity, oil_category, acidity, harvest_season, storage, peroxide, polyphenols, pdo_pgi, organic, listed_at, field_id, farmer_id, identity_unlocked_for";

export type ProcessorLot = {
  id: string;
  status: string;
  product: ProductKind;
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
  oilCategory: OilCategory | null;
  acidity: number | null;
  harvestSeason: string | null;
  storage: OilStorage | null;
  peroxide: number | null;
  polyphenols: number | null;
  pdoPgi: string | null;
  organic: boolean;
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
  product: ProductKind;
  variety: string;
  tons: number;
  filledTons: number;
  minScore: number;
  region: string | null;
  windowLabel: string | null;
  noBanned: boolean;
  active: boolean;
  maxAcidity: number | null;
  oilCategory: OilCategory | null;
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
  labResult: LabResult | null;
  qualityScoreSnapshot: number | null;
  bannedFree: boolean | null;
  farmerName: string | null;
  lotVariety: string | null;
  lotRegion: string | null;
  product: ProductKind;
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
    product: (row.product as ProductKind) ?? "olives",
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
    oilCategory: (row.oil_category as OilCategory | null) ?? null,
    acidity: row.acidity == null ? null : Number(row.acidity),
    harvestSeason: (row.harvest_season as string | null) ?? null,
    storage: (row.storage as OilStorage | null) ?? null,
    peroxide: row.peroxide == null ? null : Number(row.peroxide),
    polyphenols: row.polyphenols == null ? null : Number(row.polyphenols),
    pdoPgi: (row.pdo_pgi as string | null) ?? null,
    organic: Boolean(row.organic),
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
          .select(LOT_SELECT)
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
          .select(
            "id, product, variety, tons, filled_tons, min_score, region, window_label, no_banned, active, max_acidity, oil_category",
          )
          .eq("processor_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("deliveries")
          .select(
            "id, offer_id, lot_id, farmer_id, status, tons, price_per_kg, scheduled_for, actual_kg, lab_result, quality_score_snapshot, banned_free",
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
          ? await supabase.from("lots").select(LOT_SELECT).in("id", missingLotIds)
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
        product: ((row as { product?: ProductKind }).product as ProductKind) ?? "olives",
        variety: row.variety,
        tons: Number(row.tons),
        filledTons: Number(row.filled_tons),
        minScore: row.min_score,
        region: row.region,
        windowLabel: row.window_label,
        noBanned: row.no_banned,
        active: row.active,
        maxAcidity:
          (row as { max_acidity?: number | null }).max_acidity == null
            ? null
            : Number((row as { max_acidity?: number | null }).max_acidity),
        oilCategory: ((row as { oil_category?: OilCategory | null }).oil_category as OilCategory | null) ?? null,
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
          labResult: (row.lab_result as LabResult | null) ?? null,
          // Snapshot is often null on older rows — fall back to the lot score.
          qualityScoreSnapshot: snapshot ?? lot?.qualityScore ?? null,
          bannedFree: row.banned_free,
          farmerName: nameByFarmer.get(row.farmer_id) ?? null,
          lotVariety: lot?.variety ?? null,
          lotRegion: lot?.region ?? null,
          product: lot?.product ?? "olives",
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
  product?: ProductKind;
  variety: string;
  tons: number;
  minScore: number;
  region: string | null;
  windowLabel: string;
  noBanned: boolean;
  maxAcidity?: number | null;
  oilCategory?: OilCategory | null;
};

export async function createBuyRequest(input: BuyRequestInput): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "needLogin" };

  const product = input.product ?? "olives";
  const { error } = await supabase.from("buy_requests").insert({
    processor_id: user.id,
    product,
    variety: input.variety,
    tons: input.tons,
    min_score: input.minScore,
    region: input.region,
    window_label: input.windowLabel,
    no_banned: input.noBanned,
    max_acidity: product === "oil" ? (input.maxAcidity ?? null) : null,
    oil_category: product === "oil" ? (input.oilCategory ?? null) : null,
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

  const product = input.product ?? "olives";
  const { error } = await supabase
    .from("buy_requests")
    .update({
      product,
      variety: input.variety,
      tons: input.tons,
      min_score: input.minScore,
      region: input.region,
      window_label: input.windowLabel,
      no_banned: input.noBanned,
      max_acidity: product === "oil" ? (input.maxAcidity ?? null) : null,
      oil_category: product === "oil" ? (input.oilCategory ?? null) : null,
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

function acceptRpcError(err: { message?: string; code?: string } | null): string {
  return errorCode(err?.message ?? err?.code ?? "saveFailed");
}

export async function acceptIncomingOffer(
  offerId: string,
  opts?: { scheduledFor?: string; deliveryInDays?: number },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };

  const deliveryInDays =
    opts?.scheduledFor != null
      ? deliveryInDaysFromIso(opts.scheduledFor)
      : opts?.deliveryInDays != null && Number.isFinite(opts.deliveryInDays)
        ? Math.max(0, Math.round(opts.deliveryInDays))
        : undefined;
  const scheduledFor =
    opts?.scheduledFor ??
    (deliveryInDays != null ? addDaysIso(todayIsoDate(), deliveryInDays) : undefined);

  const { error } = await supabase.rpc("accept_offer", {
    p_offer_id: offerId,
    p_scheduled_for: scheduledFor ?? null,
    p_delivery_in_days: deliveryInDays ?? null,
  });

  if (error) return { ok: false, error: acceptRpcError(error) };
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
  if (!Number.isFinite(newPrice) || newPrice < 0.05 || newPrice > 20) {
    return { ok: false, error: "invalidPrice" };
  }
  // Atomic on the server: one counter per offer, only the receiving side may counter.
  const { error } = await supabase.rpc("counter_offer", {
    p_offer_id: offer.id,
    p_price_per_kg: newPrice,
  });
  return error ? { ok: false, error: acceptRpcError(error) } : { ok: true };
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

  // Server validates the acting processor, the step order, the weight range and the lab result.
  const { error } = await supabase.rpc("advance_delivery", {
    p_delivery_id: deliveryId,
    p_next: next,
    p_actual_kg: next === "weighed" ? (extras?.actualKg ?? null) : null,
    p_lab_result: next === "lab_checked" ? (extras?.labResult ?? "passed") : null,
  });
  return error ? { ok: false, error: acceptRpcError(error) } : { ok: true };
}

/** Close a delivery: before weighing (lot goes back to market) or after a failed lab check (olives returned). */
export async function cancelDelivery(
  deliveryId: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const { error } = await supabase.rpc("cancel_delivery", {
    p_delivery_id: deliveryId,
    p_reason: reason ?? null,
  });
  return error ? { ok: false, error: acceptRpcError(error) } : { ok: true };
}

export function lotPlaceLabel(
  lot: Pick<ProcessorLot, "town" | "region" | "farmerDisplayName">,
  anonymous: string,
  geocoded: string | null | undefined,
  locale: string,
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
