import { DELIVERY_PIPELINE } from "@/core/config/constants";
import type { DeliveryStatus, LabResult } from "@/shared/types/database";

export type PipelineStatus = (typeof DELIVERY_PIPELINE)[number];

const PIPELINE_SET = new Set<string>(DELIVERY_PIPELINE);

export function isPipelineStatus(status: DeliveryStatus): status is PipelineStatus {
  return PIPELINE_SET.has(status);
}

/** Next status in weighbridge → lab → paid, or null if terminal / cancelled. */
export function nextDeliveryStatus(status: DeliveryStatus): PipelineStatus | null {
  if (!isPipelineStatus(status)) return null;
  const i = DELIVERY_PIPELINE.indexOf(status);
  if (i < 0 || i >= DELIVERY_PIPELINE.length - 1) return null;
  return DELIVERY_PIPELINE[i + 1];
}

/**
 * Index for StatusSteps `current`: completed statuses are ticks,
 * the next action is the active circle. E.g. status `weighed` → lab is active.
 */
export function deliveryStepIndex(status: DeliveryStatus): number {
  if (!isPipelineStatus(status)) return -1;
  return DELIVERY_PIPELINE.indexOf(status) + 1;
}

/**
 * True when the processor may record weighbridge / lab / payment.
 * Lab failure blocks payment — renegotiation required.
 */
export function canAdvanceDelivery(
  status: DeliveryStatus,
  labResult?: LabResult | null,
): boolean {
  if (labResult === "failed") return false;
  return nextDeliveryStatus(status) !== null;
}

/** Payable kg: weighbridge when present, else contracted tons. */
export function deliveryPayableKg(tons: number, actualKg?: number | null): number {
  if (actualKg != null && Number.isFinite(actualKg) && actualKg > 0) return actualKg;
  return tons * 1000;
}

export function deliveryPayableAmount(
  tons: number,
  pricePerKg: number,
  actualKg?: number | null,
): number {
  return deliveryPayableKg(tons, actualKg) * pricePerKg;
}
