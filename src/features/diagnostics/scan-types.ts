import type { PillTone } from "@/shared/components/brand";

export type CaptureMode = "leaf" | "fruit" | "trap";
export type PillKey = "healthy" | "watch" | "highRisk";
export type ActionKind = "care" | "healthy" | "trap";

export type Presented = {
  mode: CaptureMode;
  title: string;
  /** Stable `farmerScan` key so history renders in el/en/tr (C9). */
  titleKey?:
    | "healthyLeaf"
    | "peacock"
    | "budMite"
    | "uncertain"
    | "healthyFruit"
    | "oliveFly"
    | "otherDamage"
    | "notClear"
    | "trapTitle";
  latin?: string;
  summary: string;
  tone: PillTone;
  pillKey: PillKey;
  confidence?: number;
  source?: "gemini" | "model" | "demo";
  modelVersion?: string;
  /** Why the server fell back to demo (when source === "demo"). */
  demoReason?: string;
  actionKind: ActionKind;
  showNoChemicals: boolean;
};

export type SavedScan = {
  id: string;
  fieldId: string | null;
  fieldName: string | null;
  at: string;
  preview: string;
  storagePath: string | null;
  presented: Presented;
};

export type ScanDiagnosisJson = {
  mode: CaptureMode;
  result: unknown;
  source?: "gemini" | "demo" | "model";
  presented: Presented;
};
