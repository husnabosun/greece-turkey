"use client";

import { errorCode } from "@/shared/lib/error-message";
import { useCallback, useEffect, useMemo, useState } from "react";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import type { LabResult, OilCategory, ProductKind } from "@/shared/types/database";

export type MarketOffer = {
  id: string;
  lotId: string;
  lotStatus: string | null;
  processorId: string;
  processorName: string;
  /** processor = mill bid on your listing (Flow A). farmer = your offer to a mill request (Flow B). */
  initiatedBy: "farmer" | "processor";
  status: string;
  tons: number;
  pricePerKg: number;
  fieldId: string | null;
  product: ProductKind;
  fieldName: string | null;
  lotVariety: string | null;
  buyRequestId: string | null;
};

export type MarketRequest = {
  id: string;
  processorId: string;
  processorName: string;
  product: ProductKind;
  variety: string;
  tons: number;
  filledTons: number;
  minScore: number;
  region: string | null;
  windowLabel: string | null;
  noBanned: boolean;
  maxAcidity: number | null;
  oilCategory: OilCategory | null;
};

export type MarketDelivery = {
  id: string;
  status: string;
  tons: number;
  pricePerKg: number;
  scheduledFor: string | null;
  actualKg: number | null;
  labResult: LabResult | null;
  qualityScoreSnapshot: number | null;
  fieldName: string | null;
  processorName: string | null;
  lotVariety: string | null;
  product: ProductKind;
};

/** One listing (lot) on a field, with its own status and its own open offers. */
export type FieldLot = {
  id: string;
  status: "listed" | "reserved" | "sold";
  product: ProductKind;
  pricePerKg: number | null;
  tons: number | null;
  /** Open mill bids on this lot (only counted while it is still listed). */
  offerCount: number;
};

export type FieldMarketCard = {
  fieldId: string;
  qualityScore: number | null;
  listedPrice: number | null;
  listedTons: number | null;
  listedLotId: string | null;
  offerCount: number;
  /** Best active lot status for this field: listed | reserved | sold | null */
  lotStatus: "listed" | "reserved" | "sold" | null;
  /** Every open listing on this field (a field can carry more than one lot). */
  listedLots: { id: string; pricePerKg: number | null; tons: number | null }[];
  /** Every open lot of the field (listed, reserved, sold), each with its own offer count. */
  lots: FieldLot[];
  /** Tons still unsold on this field across open listings (null when nothing listed). */
  soldOrReservedTons: number;
};

type State = {
  /** Signed-in farmer, used for the realtime filter and per-user "seen" state. */
  userId: string | null;
  offers: MarketOffer[];
  requests: MarketRequest[];
  deliveries: MarketDelivery[];
  fieldCards: Record<string, FieldMarketCard>;
  /** Oil (or other) lots listed without a field_id — bulk stock. */
  stockLots: FieldLot[];
  /** Farmer's country from profile (GR/TR) — used for region matching. */
  farmerCountry: "GR" | "TR" | null;
  loading: boolean;
  error: string | null;
};

const EMPTY: State = {
  userId: null,
  offers: [],
  requests: [],
  deliveries: [],
  fieldCards: {},
  stockLots: [],
  farmerCountry: null,
  loading: true,
  error: null,
};

function rpcErrorMessage(err: { message?: string; code?: string } | null): string {
  return errorCode(err?.message ?? err?.code ?? "actionFailed");
}

/** Farmer market data: offers, buy requests, deliveries, per-field listing hints. */
export function useFarmerMarket(fieldIds: string[]) {
  const fieldKey = useMemo(() => [...fieldIds].sort().join("|"), [fieldIds]);
  const [state, setState] = useState<State>(EMPTY);

  /** `silent` refreshes the data without flipping `loading` (used by realtime, so the screen does not flash). */
  const reload = useCallback(async (opts?: { silent?: boolean }) => {
    const ids = fieldKey ? fieldKey.split("|").filter(Boolean) : [];
    const supabase = tryCreateBrowserClient();
    if (!supabase) {
      setState({ ...EMPTY, loading: false, error: "needSupabase" });
      return;
    }

    if (!opts?.silent) setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setState({ ...EMPTY, loading: false, error: "needLogin" });
        return;
      }

      const [offersRes, requestsRes, deliveriesRes, lotsRes, qualityRes, meRes] = await Promise.all([
        supabase
          .from("offers")
          .select(
            "id, lot_id, processor_id, initiated_by, status, tons, price_per_kg, buy_request_id, lots(status, product, variety, field_id, fields(name))",
          )
          .eq("farmer_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("buy_requests")
          .select(
            "id, processor_id, product, variety, tons, filled_tons, min_score, region, window_label, no_banned, max_acidity, oil_category",
          )
          .eq("active", true)
          .eq("shared_with_farmers", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("deliveries")
          .select(
            "id, status, tons, price_per_kg, scheduled_for, processor_id, actual_kg, lab_result, quality_score_snapshot, lots(product, variety, fields(name))",
          )
          .eq("farmer_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("lots")
          .select("id, field_id, product, price_per_kg, tons, status")
          .eq("farmer_id", user.id)
          .in("status", ["listed", "reserved", "sold"]),
        ids.length
          ? supabase
              .from("quality_scores")
              .select("field_id, score, computed_at")
              .in("field_id", ids)
              .order("computed_at", { ascending: false })
          : Promise.resolve({ data: [] as { field_id: string; score: number }[] }),
        supabase.from("profiles").select("country").eq("id", user.id).maybeSingle(),
      ]);
      const meCountry = meRes.data?.country;
      const farmerCountry = meCountry === "GR" || meCountry === "TR" ? meCountry : null;

      const processorIds = [
        ...new Set([
          ...(offersRes.data ?? []).map((o) => o.processor_id),
          ...(deliveriesRes.data ?? []).map((d) => d.processor_id),
          ...(requestsRes.data ?? []).map((r) => r.processor_id),
        ]),
      ];
      const nameByProcessor = new Map<string, string>();
      if (processorIds.length) {
        const { data: procs } = await supabase
          .from("profiles")
          .select("id, display_name, company_name")
          .in("id", processorIds);
        for (const p of procs ?? []) {
          nameByProcessor.set(p.id, p.company_name || p.display_name || "Buyer");
        }
      }

      const offers: MarketOffer[] = (offersRes.data ?? []).map((row) => {
        const lot = row.lots as
          | {
              status?: string;
              product?: ProductKind;
              variety?: string;
              field_id?: string;
              fields?: { name?: string } | { name?: string }[];
            }
          | null;
        const fieldsJoin = lot?.fields;
        const fieldName = Array.isArray(fieldsJoin) ? fieldsJoin[0]?.name : fieldsJoin?.name;
        return {
          id: row.id,
          lotId: row.lot_id,
          lotStatus: lot?.status ?? null,
          processorId: row.processor_id,
          processorName: nameByProcessor.get(row.processor_id) ?? "Buyer",
          initiatedBy: row.initiated_by === "farmer" ? "farmer" : "processor",
          status: row.status,
          tons: Number(row.tons),
          pricePerKg: Number(row.price_per_kg),
          fieldId: lot?.field_id ?? null,
          product: lot?.product ?? "olives",
          fieldName: fieldName ?? null,
          lotVariety: lot?.variety ?? null,
          buyRequestId: row.buy_request_id ?? null,
        };
      });

      const requests: MarketRequest[] = (requestsRes.data ?? []).map((row) => ({
        id: row.id,
        processorId: row.processor_id,
        processorName: nameByProcessor.get(row.processor_id) ?? "Buyer",
        product: ((row as { product?: ProductKind }).product as ProductKind) ?? "olives",
        variety: row.variety,
        tons: Number(row.tons),
        filledTons: Number(row.filled_tons),
        minScore: row.min_score,
        region: row.region,
        windowLabel: row.window_label,
        noBanned: row.no_banned,
        maxAcidity:
          (row as { max_acidity?: number | null }).max_acidity == null
            ? null
            : Number((row as { max_acidity?: number | null }).max_acidity),
        oilCategory: ((row as { oil_category?: OilCategory | null }).oil_category as OilCategory | null) ?? null,
      }));

      const deliveries: MarketDelivery[] = (deliveriesRes.data ?? []).map((row) => {
        const lot = row.lots as
          | { product?: ProductKind; variety?: string; fields?: { name?: string } | { name?: string }[] }
          | null;
        const fieldsJoin = lot?.fields;
        const fieldName = Array.isArray(fieldsJoin) ? fieldsJoin[0]?.name : fieldsJoin?.name;
        return {
          id: row.id,
          status: row.status,
          tons: Number(row.tons),
          pricePerKg: Number(row.price_per_kg),
          scheduledFor: row.scheduled_for ?? null,
          actualKg: row.actual_kg == null ? null : Number(row.actual_kg),
          labResult: (row.lab_result as LabResult | null) ?? null,
          qualityScoreSnapshot:
            row.quality_score_snapshot == null ? null : Number(row.quality_score_snapshot),
          fieldName: fieldName ?? null,
          processorName: nameByProcessor.get(row.processor_id) ?? null,
          lotVariety: lot?.variety ?? null,
          product: lot?.product ?? "olives",
        };
      });

      const latestQuality = new Map<string, number>();
      for (const q of qualityRes.data ?? []) {
        if (!latestQuality.has(q.field_id)) latestQuality.set(q.field_id, q.score);
      }

      const offerCountByField = new Map<string, number>();
      const offerCountByLot = new Map<string, number>();
      for (const o of offers) {
        // Only open mill bids on still-listed lots count on field cards.
        if (o.initiatedBy !== "processor") continue;
        if (o.status !== "pending") continue;
        if (o.lotStatus !== "listed") continue;
        offerCountByLot.set(o.lotId, (offerCountByLot.get(o.lotId) ?? 0) + 1);
        if (!o.fieldId) continue;
        offerCountByField.set(o.fieldId, (offerCountByField.get(o.fieldId) ?? 0) + 1);
      }

      const listedPriceByField = new Map<string, number>();
      const listedTonsByField = new Map<string, number>();
      const listedLotIdByField = new Map<string, string>();
      const lotStatusByField = new Map<string, "listed" | "reserved" | "sold">();
      const statusRank = { sold: 3, reserved: 2, listed: 1 } as const;
      const listedLotsByField = new Map<string, FieldMarketCard["listedLots"]>();
      const committedTonsByField = new Map<string, number>();
      const lotsByField = new Map<string, FieldLot[]>();
      const stockLots: FieldLot[] = [];
      for (const lot of lotsRes.data ?? []) {
        const st = lot.status as "listed" | "reserved" | "sold";
        const mapped: FieldLot = {
          id: lot.id,
          status: st,
          product: ((lot as { product?: ProductKind }).product as ProductKind) ?? "olives",
          pricePerKg: lot.price_per_kg == null ? null : Number(lot.price_per_kg),
          tons: lot.tons == null ? null : Number(lot.tons),
          offerCount: offerCountByLot.get(lot.id) ?? 0,
        };
        if (!lot.field_id) {
          stockLots.push(mapped);
          continue;
        }
        const all = lotsByField.get(lot.field_id) ?? [];
        all.push(mapped);
        lotsByField.set(lot.field_id, all);
        const prev = lotStatusByField.get(lot.field_id);
        if (!prev || statusRank[st] > statusRank[prev]) {
          lotStatusByField.set(lot.field_id, st);
        }
        if (lot.status === "listed") {
          const arr = listedLotsByField.get(lot.field_id) ?? [];
          arr.push({
            id: lot.id,
            pricePerKg: lot.price_per_kg == null ? null : Number(lot.price_per_kg),
            tons: lot.tons == null ? null : Number(lot.tons),
          });
          listedLotsByField.set(lot.field_id, arr);
        } else if (lot.tons != null) {
          committedTonsByField.set(
            lot.field_id,
            (committedTonsByField.get(lot.field_id) ?? 0) + Number(lot.tons),
          );
        }
        if (lot.status === "listed" && !listedLotIdByField.has(lot.field_id)) {
          listedLotIdByField.set(lot.field_id, lot.id);
          if (lot.price_per_kg != null) listedPriceByField.set(lot.field_id, Number(lot.price_per_kg));
          if (lot.tons != null) listedTonsByField.set(lot.field_id, Number(lot.tons));
        }
      }

      const fieldCards: Record<string, FieldMarketCard> = {};
      for (const id of ids) {
        fieldCards[id] = {
          fieldId: id,
          qualityScore: latestQuality.get(id) ?? null,
          listedPrice: listedPriceByField.get(id) ?? null,
          listedTons: listedTonsByField.get(id) ?? null,
          listedLotId: listedLotIdByField.get(id) ?? null,
          offerCount: offerCountByField.get(id) ?? 0,
          lotStatus: lotStatusByField.get(id) ?? null,
          listedLots: listedLotsByField.get(id) ?? [],
          lots: lotsByField.get(id) ?? [],
          soldOrReservedTons: committedTonsByField.get(id) ?? 0,
        };
      }

      setState({
        userId: user.id,
        offers,
        requests,
        deliveries,
        fieldCards,
        stockLots,
        farmerCountry,
        loading: false,
        error: offersRes.error?.message || requestsRes.error?.message || null,
      });
    } catch (err) {
      setState({
        ...EMPTY,
        loading: false,
        error: err instanceof Error ? err.message : "loadFailed",
      });
    }
  }, [fieldKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Realtime: a mill bid, an accepted offer or a delivery step changes the numbers without a refresh.
  const { userId } = state;
  useEffect(() => {
    if (!userId) return;
    const supabase = tryCreateBrowserClient();
    if (!supabase) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Several rows often change together (accept = offer + lot + delivery): reload once.
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void reload({ silent: true }), 400);
    };
    const channel = supabase.channel(`farmer-market-${userId}`);
    for (const table of ["offers", "deliveries", "lots"]) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `farmer_id=eq.${userId}` },
        refresh,
      );
    }
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  return { ...state, reload };
}

export async function acceptOffer(
  offerId: string,
  opts?: { scheduledFor?: string },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };

  const { error } = await supabase.rpc("accept_offer", {
    p_offer_id: offerId,
    p_scheduled_for: opts?.scheduledFor ?? null,
    p_delivery_in_days: null,
  });

  if (error) return { ok: false, error: rpcErrorMessage(error) };
  return { ok: true };
}

export async function withdrawOffer(offerId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };

  const { data: offer } = await supabase
    .from("offers")
    .select("id, lot_id, initiated_by")
    .eq("id", offerId)
    .maybeSingle();

  const { error } = await supabase.from("offers").update({ status: "withdrawn" }).eq("id", offerId);
  if (error) return { ok: false, error: error.message };

  // Flow B draft lots left behind when withdrawing an offer to a mill request.
  if (offer?.initiated_by === "farmer" && offer.lot_id) {
    await supabase
      .from("lots")
      .update({ status: "withdrawn" })
      .eq("id", offer.lot_id)
      .eq("status", "draft");
  }

  return { ok: true };
}

export async function rejectIncomingBid(offerId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  const { error } = await supabase.from("offers").update({ status: "rejected" }).eq("id", offerId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Withdraw a still-listed public lot (Flow A). */
export async function withdrawListedLot(lotId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };

  const { error } = await supabase
    .from("lots")
    .update({ status: "withdrawn" })
    .eq("id", lotId)
    .eq("status", "listed");
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("offers")
    .update({ status: "withdrawn" })
    .eq("lot_id", lotId)
    .eq("status", "pending");

  return { ok: true };
}

/** Update price/tons on a still-listed public lot. */
export async function updateListedLot(
  lotId: string,
  opts: { pricePerKg: number; tons: number },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  if (!(opts.pricePerKg > 0) || !(opts.tons > 0)) return { ok: false, error: "invalidTons" };

  const { error } = await supabase
    .from("lots")
    .update({ price_per_kg: opts.pricePerKg, tons: opts.tons })
    .eq("id", lotId)
    .eq("status", "listed");
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function counterOffer(
  offer: MarketOffer,
  newPrice: number,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };
  if (offer.status !== "pending" || offer.lotStatus !== "listed") {
    return { ok: false, error: "offerNotPending" };
  }
  if (!Number.isFinite(newPrice) || newPrice < 0.05 || newPrice > 30) {
    return { ok: false, error: "invalidPrice" };
  }
  // Atomic on the server: marks the bid countered and creates exactly one counter offer.
  const { error } = await supabase.rpc("counter_offer", {
    p_offer_id: offer.id,
    p_price_per_kg: newPrice,
  });
  return error ? { ok: false, error: rpcErrorMessage(error) } : { ok: true };
}
