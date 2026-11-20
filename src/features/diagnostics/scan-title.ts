import type { Presented } from "@/features/diagnostics/scan-types";

/** Stable i18n keys under `farmerScan` for diagnosis titles (C9). */
export type ScanTitleKey =
  | "healthyLeaf"
  | "peacock"
  | "budMite"
  | "uncertain"
  | "healthyFruit"
  | "oliveFly"
  | "otherDamage"
  | "notClear"
  | "trapTitle";

const LEGACY_TO_KEY: Record<string, ScanTitleKey> = {
  // English model / stored labels
  healthy: "healthyLeaf",
  "healthy leaf": "healthyLeaf",
  "olive peacock spot": "peacock",
  peacock: "peacock",
  "aculus olearius": "budMite",
  "bud mite": "budMite",
  uncertain: "uncertain",
  "healthy fruit": "healthyFruit",
  "olive fly sting": "oliveFly",
  "olive fly": "oliveFly",
  "other damage": "otherDamage",
  unclear: "notClear",
  // Greek titles already saved in DB
  "υγιές φύλλο": "healthyLeaf",
  κυκλοκόνιο: "peacock",
  "άκαρι οφθαλμών": "budMite",
  αβέβαιο: "uncertain",
  "υγιής καρπός": "healthyFruit",
  δάκος: "oliveFly",
  "άλλη ζημιά": "otherDamage",
  "δεν είναι ξεκάθαρο": "notClear",
};

export function inferScanTitleKey(presented: Pick<Presented, "title" | "titleKey" | "mode">): ScanTitleKey | null {
  if (presented.titleKey) return presented.titleKey;
  const raw = presented.title?.trim() ?? "";
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (LEGACY_TO_KEY[lower]) return LEGACY_TO_KEY[lower];

  // Trap titles: "Παγίδα · 8 μύγες" / "Trap · 8 flies"
  if (presented.mode === "trap" || /παγίδ|trap|μύγ|fly/i.test(raw)) {
    return "trapTitle";
  }
  return null;
}

export function scanTitleFlyCount(title: string): number | null {
  const m = /(\d+)/.exec(title);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

type TFn = (key: string, values?: Record<string, string | number>) => string;

/** Resolve a scan title in the active locale. */
export function localizedScanTitle(presented: Presented, t: TFn): string {
  const key = inferScanTitleKey(presented);
  if (!key) return presented.title;

  if (key === "trapTitle") {
    const n = scanTitleFlyCount(presented.title) ?? 0;
    return t("trapTitle", { n });
  }
  return t(key);
}
