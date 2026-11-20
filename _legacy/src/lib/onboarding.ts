/** Starting score for a new field. Pure TS, no UI imports. */

export type CropStage = 'growing' | 'almost' | 'harvested';
export type SprayCount = '0' | '1-2' | '3+';
export type RecordsKind = 'none' | 'paper' | 'brecete';
export type ProofLevel = 'Self-reported' | 'Evidence-based' | 'Lab verified';

export interface ProofItem {
  id: string;
  label: string;
  note: 'REQUIRED' | 'OPTIONAL' | '';
}

/** The proof list changes with the crop stage. */
export const PROOFS: Record<CropStage, ProofItem[]> = {
  growing: [
    { id: 'field-photo', label: 'Field photo', note: 'REQUIRED' },
    { id: 'spray-receipt', label: 'Spray receipt', note: 'OPTIONAL' },
  ],
  almost: [
    { id: 'olives-photo', label: 'Olives photo', note: 'REQUIRED' },
    { id: 'quantity', label: 'Expected quantity', note: 'REQUIRED' },
    { id: 'spray-receipt', label: 'Spray receipt', note: 'OPTIONAL' },
  ],
  harvested: [
    { id: 'olives-photo', label: 'Olives photo', note: 'REQUIRED' },
    { id: 'quantity', label: 'Quantity', note: 'REQUIRED' },
    { id: 'spray-receipt', label: 'Spray receipt', note: 'OPTIONAL' },
    { id: 'sales-receipt', label: 'Sales receipt', note: 'OPTIONAL' },
  ],
};

const BASE = 54;
const SPRAY_POINTS: Record<SprayCount, number> = { '0': 8, '1-2': 4, '3+': 0 };
const RECORD_POINTS: Record<RecordsKind, number> = { none: 0, paper: 4, brecete: 8 };
const POINTS_PER_PROOF = 3;

/** Only proofs that belong to the current stage count. */
export function validProofs(stage: CropStage, added: string[]): string[] {
  const ids = PROOFS[stage].map((p) => p.id);
  return added.filter((id) => ids.includes(id));
}

export function startingScore(stage: CropStage, sprays: SprayCount, records: RecordsKind, added: string[]): number {
  const proofs = validProofs(stage, added).length;
  return Math.min(95, BASE + SPRAY_POINTS[sprays] + RECORD_POINTS[records] + proofs * POINTS_PER_PROOF);
}

/** Minimum number of valid proofs for "Evidence-based". */
export const EVIDENCE_PROOFS = 2;

/** Level from the proof the farmer added. "Lab verified" never comes from proof, only from a lab result. */
export function proofLevel(stage: CropStage, added: string[]): ProofLevel {
  return validProofs(stage, added).length >= EVIDENCE_PROOFS ? 'Evidence-based' : 'Self-reported';
}

export interface SaleLike {
  fieldId: string;
  status: 'inProgress' | 'paid';
  /** Result of the lab check of this sale, once there is one. */
  labResult?: 'passed' | 'failed';
}

/**
 * "Lab verified" only when the field has at least one completed sale with a lab result.
 * Otherwise the level from the proof the farmer added.
 */
export function verifiedLevel(field: { id: string; proofLevel: ProofLevel }, sales: SaleLike[]): ProofLevel {
  const labVerified = sales.some((s) => s.fieldId === field.id && s.status === 'paid' && s.labResult !== undefined);
  return labVerified ? 'Lab verified' : field.proofLevel;
}

export const haFromTrees = (trees: number) => Math.round(trees * 0.0075 * 10) / 10;
