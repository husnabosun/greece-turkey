"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";

export type MarketOffer = {
  id: string;
  lotId: string;
  processorId: string;
  processorName: string;
  status: string;
  tons: number;
  pricePerKg: number;
  fieldId: string | null;
  fieldName: string | null;
  lotVariety: string | null;
};

export type MarketRequest = {
  id: string;
  variety: string;
  tons: number;
  filledTons: number;
  minScore: number;
  region: string | null;
  windowLabel: string | null;
  noBanned: boolean;
};

export type MarketDelivery = {
  id: string;
  status: string;
  tons: number;
  pricePerKg: number;
  fieldName: string | null;
  processorName: string | null;
};

export type FieldMarketCard = {
  fieldId: string;
  qualityScore: number | null;
  listedPrice: number | null;
  offerCount: number;
};

type State = {
  offers: MarketOffer[];
  requests: MarketRequest[];
  deliveries: MarketDelivery[];
  fieldCards: Record<string, FieldMarketCard>;
  loading: boolean;
  error: string | null;
};

const EMPTY: State = {
  offers: [],
  requests: [],
  deliveries: [],
  fieldCards: {},
  loading: true,
  error: null,
};

/** Farmer market data: offers, buy requests, deliveries, per-field listing hints. */
export function useFarmerMarket(fieldIds: string[]) {
  const fieldKey = useMemo(() => [...fieldIds].sort().join("|"), [fieldIds]);
  const [state, setState] = useState<State>(EMPTY);

  const reload = useCallback(async () => {
    const ids = fieldKey ? fieldKey.split("|").filter(Boolean) : [];
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

      const [offersRes, requestsRes, deliveriesRes, lotsRes, qualityRes] = await Promise.all([
        supabase
          .from("offers")
          .select("id, lot_id, processor_id, status, tons, price_per_kg, lots(variety, field_id, fields(name))")
          .eq("farmer_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("buy_requests")
          .select("id, variety, tons, filled_tons, min_score, region, window_label, no_banned")
          .eq("active", true)
          .eq("shared_with_farmers", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("deliveries")
          .select("id, status, tons, price_per_kg, processor_id, lots(fields(name))")
          .eq("farmer_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("lots")
          .select("id, field_id, price_per_kg, status")
          .eq("farmer_id", user.id)
          .in("status", ["listed", "reserved"]),
        ids.length
          ? supabase
              .from("quality_scores")
              .select("field_id, score, computed_at")
              .in("field_id", ids)
              .order("computed_at", { ascending: false })
          : Promise.resolve({ data: [] as { field_id: string; score: number }[] }),
      ]);

      const processorIds = [
        ...new Set([
          ...(offersRes.data ?? []).map((o) => o.processor_id),
          ...(deliveriesRes.data ?? []).map((d) => d.processor_id),
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
          | { variety?: string; field_id?: string; fields?: { name?: string } | { name?: string }[] }
          | null;
        const fieldsJoin = lot?.fields;
        const fieldName = Array.isArray(fieldsJoin) ? fieldsJoin[0]?.name : fieldsJoin?.name;
        return {
          id: row.id,
          lotId: row.lot_id,
          processorId: row.processor_id,
          processorName: nameByProcessor.get(row.processor_id) ?? "Buyer",
          status: row.status,
          tons: Number(row.tons),
          pricePerKg: Number(row.price_per_kg),
          fieldId: lot?.field_id ?? null,
          fieldName: fieldName ?? null,
          lotVariety: lot?.variety ?? null,
        };
      });

      const requests: MarketRequest[] = (requestsRes.data ?? []).map((row) => ({
        id: row.id,
        variety: row.variety,
        tons: Number(row.tons),
        filledTons: Number(row.filled_tons),
        minScore: row.min_score,
        region: row.region,
        windowLabel: row.window_label,
        noBanned: row.no_banned,
      }));

      const deliveries: MarketDelivery[] = (deliveriesRes.data ?? []).map((row) => {
        const lot = row.lots as { fields?: { name?: string } | { name?: string }[] } | null;
        const fieldsJoin = lot?.fields;
        const fieldName = Array.isArray(fieldsJoin) ? fieldsJoin[0]?.name : fieldsJoin?.name;
        return {
          id: row.id,
          status: row.status,
          tons: Number(row.tons),
          pricePerKg: Number(row.price_per_kg),
          fieldName: fieldName ?? null,
          processorName: nameByProcessor.get(row.processor_id) ?? null,
        };
      });

      const latestQuality = new Map<string, number>();
      for (const q of qualityRes.data ?? []) {
        if (!latestQuality.has(q.field_id)) latestQuality.set(q.field_id, q.score);
      }

      const offerCountByField = new Map<string, number>();
      for (const o of offers) {
        if (o.status !== "pending" && o.status !== "countered") continue;
        if (!o.fieldId) continue;
        offerCountByField.set(o.fieldId, (offerCountByField.get(o.fieldId) ?? 0) + 1);
      }

      const listedPriceByField = new Map<string, number>();
      for (const lot of lotsRes.data ?? []) {
        if (!lot.field_id || lot.price_per_kg == null) continue;
        if (!listedPriceByField.has(lot.field_id)) {
          listedPriceByField.set(lot.field_id, Number(lot.price_per_kg));
        }
      }

      const fieldCards: Record<string, FieldMarketCard> = {};
      for (const id of ids) {
        fieldCards[id] = {
          fieldId: id,
          qualityScore: latestQuality.get(id) ?? null,
          listedPrice: listedPriceByField.get(id) ?? null,
          offerCount: offerCountByField.get(id) ?? 0,
        };
      }

      setState({
        offers,
        requests,
        deliveries,
        fieldCards,
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

  return { ...state, reload };
}

export async function acceptOffer(offerId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };

  const { data: offer, error: loadError } = await supabase
    .from("offers")
    .select("id, lot_id, farmer_id, processor_id, tons, price_per_kg, status, delivery_in_days")
    .eq("id", offerId)
    .maybeSingle();
  if (loadError || !offer) return { ok: false, error: loadError?.message ?? "notFound" };

  const deliveryInDays = offer.delivery_in_days ?? 2;
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const base = new Date(`${y}-${m}-${d}T12:00:00`);
  base.setDate(base.getDate() + deliveryInDays);
  const scheduledFor = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;

  if (offer.status !== "accepted") {
    const { error } = await supabase
      .from("offers")
      .update({ status: "accepted", delivery_in_days: deliveryInDays })
      .eq("id", offerId);
    if (error) return { ok: false, error: error.message };
  }

  // Safety net: trigger should insert delivery; if RLS blocked it, create here.
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

export async function counterOffer(
  offer: MarketOffer,
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
    farmer_id: user.id,
    processor_id: offer.processorId,
    initiated_by: "farmer",
    status: "pending",
    tons: offer.tons,
    price_per_kg: newPrice,
    counter_of: offer.id,
  });

  return insertError ? { ok: false, error: insertError.message } : { ok: true };
}
