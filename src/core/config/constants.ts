export const APP_NAME = "Agro Pulse AI";

export const LOCALES = ["el", "tr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "el";

export const USER_ROLES = ["farmer", "processor"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LOT_STATUSES = ["draft", "listed", "reserved", "sold", "withdrawn"] as const;
export const OFFER_STATUSES = ["pending", "accepted", "rejected", "countered", "withdrawn"] as const;
export const DELIVERY_STATUSES = ["scheduled", "weighed", "lab_checked", "paid", "cancelled"] as const;

/** Delivery pipeline order (weighbridge → lab → settlement). */
export const DELIVERY_PIPELINE = ["scheduled", "weighed", "lab_checked", "paid"] as const;

export const STORAGE_BUCKETS = {
  scans: "scan-images",
  labels: "label-images",
  proofs: "proofs",
} as const;
