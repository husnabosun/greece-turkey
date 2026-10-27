import { haFromTrees, proofLevel, startingScore, validProofs } from './onboarding';

describe('onboarding score', () => {
  it('gives 72 for harvested, 1–2 sprays, B-Reçete and two proofs', () => {
    expect(startingScore('harvested', '1-2', 'brecete', ['olives-photo', 'spray-receipt'])).toBe(72);
  });

  it('moves the level up as proof is added', () => {
    expect(proofLevel('harvested', [])).toBe('Self-reported');
    expect(proofLevel('harvested', ['olives-photo', 'quantity'])).toBe('Evidence-based');
    expect(proofLevel('harvested', ['olives-photo', 'quantity', 'spray-receipt', 'sales-receipt'])).toBe('Lab verified');
  });

  it('ignores proof that does not belong to the crop stage', () => {
    expect(validProofs('growing', ['field-photo', 'sales-receipt'])).toEqual(['field-photo']);
  });

  it('adds 3 points per proof', () => {
    expect(startingScore('harvested', '0', 'brecete', ['olives-photo', 'quantity', 'spray-receipt', 'sales-receipt'])).toBe(82);
  });

  it('estimates the field size from the tree count', () => {
    expect(haFromTrees(80)).toBe(0.6);
  });
});
