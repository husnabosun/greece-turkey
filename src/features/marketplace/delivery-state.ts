import { DELIVERY_PIPELINE } from "@/core/config/constants";
import type { DeliveryStatus } from "@/shared/types/database";

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

export function deliveryStepIndex(status: DeliveryStatus): number {
  if (!isPipelineStatus(status)) return -1;
  return DELIVERY_PIPELINE.indexOf(status);
}

/** True when the processor may record weighbridge / lab / payment. */
export function canAdvanceDelivery(status: DeliveryStatus): boolean {
  return nextDeliveryStatus(status) !== null;
}
