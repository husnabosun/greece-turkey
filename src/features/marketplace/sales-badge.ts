/**
 * "New" badge on the farmer's Sales tab.
 * A delivery is new until the farmer opens Sales; it shows up again when its step changes
 * (scheduled → weighed → lab checked → paid, or a failed lab check / cancel).
 */

export type SeenDeliveries = Record<string, string>;

type DeliveryLike = {
  id: string;
  status: string;
  labResult: string | null;
  actualKg: number | null;
};

/** What the farmer would see change: the step, the lab result and the weighed amount. */
export function deliverySignature(d: Omit<DeliveryLike, "id">): string {
  return `${d.status}|${d.labResult ?? ""}|${d.actualKg ?? ""}`;
}

/** Deliveries that are new, or whose step changed since the farmer last opened Sales. */
export function unseenDeliveryCount(deliveries: DeliveryLike[], seen: SeenDeliveries): number {
  return deliveries.filter((d) => seen[d.id] !== deliverySignature(d)).length;
}

/** The state to store when the farmer opens Sales: everything on screen counts as seen. */
export function markAllSeen(deliveries: DeliveryLike[]): SeenDeliveries {
  return Object.fromEntries(deliveries.map((d) => [d.id, deliverySignature(d)]));
}

export function sameSeen(a: SeenDeliveries, b: SeenDeliveries): boolean {
  const ak = Object.keys(a);
  return ak.length === Object.keys(b).length && ak.every((k) => a[k] === b[k]);
}
