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

/** Adding proof moves the level up: 2 proofs make it evidence-based, all of them lab verified. */
export function proofLevel(stage: CropStage, added: string[]): ProofLevel {
  const n = validProofs(stage, added).length;
  if (n >= PROOFS[stage].length) return 'Lab verified';
  return n >= 2 ? 'Evidence-based' : 'Self-reported';
}

export const haFromTrees = (trees: number) => Math.round(trees * 0.0075 * 10) / 10;
