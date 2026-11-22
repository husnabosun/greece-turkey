"use client";

import { useEffect, useState } from "react";
import {
  markAllSeen,
  sameSeen,
  unseenDeliveryCount,
  type SeenDeliveries,
} from "@/features/marketplace/sales-badge";

type DeliveryLike = { id: string; status: string; labResult: string | null; actualKg: number | null };

const keyFor = (userId: string) => `ap.salesSeen.${userId}`;

function read(userId: string): SeenDeliveries {
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as SeenDeliveries) : {};
  } catch {
    return {};
  }
}

function write(userId: string, seen: SeenDeliveries) {
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(seen));
  } catch {
    // Private window or blocked storage: the badge just comes back next visit.
  }
}

/**
 * How many deliveries are new (or changed step) since the farmer last opened Sales.
 * While Sales is open everything counts as seen, including changes that arrive in realtime.
 */
export function useSalesUnseen(
  userId: string | null,
  deliveries: DeliveryLike[],
  ready: boolean,
  salesOpen: boolean,
): number {
  const [seen, setSeen] = useState<{ userId: string; map: SeenDeliveries } | null>(null);

  useEffect(() => {
    if (!userId) return;
    // Load the stored state once the user is known.
    setSeen({ userId, map: read(userId) });
  }, [userId]);

  useEffect(() => {
    if (!userId || !ready || !salesOpen || seen?.userId !== userId) return;
    const next = markAllSeen(deliveries);
    if (sameSeen(next, seen.map)) return;
    write(userId, next);
    setSeen({ userId, map: next });
  }, [userId, ready, salesOpen, deliveries, seen]);

  if (!ready || salesOpen || !userId || seen?.userId !== userId) return 0;
  return unseenDeliveryCount(deliveries, seen.map);
}
