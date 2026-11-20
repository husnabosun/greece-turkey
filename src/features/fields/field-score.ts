/** Crop status / trust-score form shared by field certification flow. */

export type CropStage = "growing" | "almost" | "harvested";
export type SpraysLastSeason = "0" | "1-2" | "3+";
export type RecordType = "none" | "paper" | "brecete";

export type ProofLabelKey =
  | "proofField"
  | "proofOlives"
  | "proofQty"
  | "proofExpected"
  | "proofSpray"
  | "proofQuality";

export type ProofItem = {
  id: string;
  labelKey: ProofLabelKey;
  note: "REQUIRED" | "OPTIONAL";
};

/** Quantity required only for almost-ready / harvested — never while still growing. */
export const PROOFS_BY_STAGE: Record<CropStage, ProofItem[]> = {
  growing: [
    { id: "field-photo", labelKey: "proofField", note: "REQUIRED" },
    { id: "spray-receipt", labelKey: "proofSpray", note: "OPTIONAL" },
  ],
  almost: [
    { id: "olives-photo", labelKey: "proofOlives", note: "REQUIRED" },
    { id: "quantity", labelKey: "proofExpected", note: "REQUIRED" },
    { id: "spray-receipt", labelKey: "proofSpray", note: "OPTIONAL" },
    { id: "quality-cert", labelKey: "proofQuality", note: "OPTIONAL" },
  ],
  harvested: [
    { id: "olives-photo", labelKey: "proofOlives", note: "REQUIRED" },
    { id: "quantity", labelKey: "proofQty", note: "REQUIRED" },
    { id: "spray-receipt", labelKey: "proofSpray", note: "OPTIONAL" },
    { id: "quality-cert", labelKey: "proofQuality", note: "OPTIONAL" },
  ],
};

export const STAGE_TITLE_KEY: Record<CropStage, "stageGrowing" | "stageAlmost" | "stageHarvested"> = {
  growing: "stageGrowing",
  almost: "stageAlmost",
  harvested: "stageHarvested",
};

const SPRAY_POINTS: Record<SpraysLastSeason, number> = { "0": 8, "1-2": 4, "3+": 0 };
const RECORD_POINTS: Record<RecordType, number> = { none: 0, paper: 4, brecete: 8 };

export function estimateTrustScore(
  stage: CropStage,
  sprays: SpraysLastSeason,
  records: RecordType,
  proofs: string[],
) {
  const valid = proofs.filter((id) => PROOFS_BY_STAGE[stage].some((p) => p.id === id)).length;
  return Math.min(95, 54 + SPRAY_POINTS[sprays] + RECORD_POINTS[records] + valid * 3);
}

export function isPublishStage(stage: CropStage) {
  return stage === "almost" || stage === "harvested";
}
