import type { Lot } from "@/shared/types/database";

/** Farmer display name is visible to a processor only after accept (or if viewer is the farmer). */
export function isLotIdentityUnlocked(
  lot: Pick<Lot, "farmer_id" | "identity_unlocked_for">,
  viewerId: string,
): boolean {
  if (viewerId === lot.farmer_id) return true;
  return lot.identity_unlocked_for.includes(viewerId);
}
