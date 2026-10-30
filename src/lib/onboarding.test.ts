import { haFromTrees, proofLevel, startingScore, validProofs, verifiedLevel } from './onboarding';

describe('onboarding score', () => {
  it('gives 72 for harvested, 1–2 sprays, B-Reçete and two proofs', () => {
    expect(startingScore('harvested', '1-2', 'brecete', ['olives-photo', 'spray-receipt'])).toBe(72);
  });

  it('moves the level up as proof is added, but never to Lab verified', () => {
    expect(proofLevel('harvested', [])).toBe('Self-reported');
    expect(proofLevel('harvested', ['olives-photo'])).toBe('Self-reported');
    expect(proofLevel('harvested', ['olives-photo', 'quantity'])).toBe('Evidence-based');
    expect(proofLevel('harvested', ['olives-photo', 'quantity', 'spray-receipt', 'sales-receipt'])).toBe('Evidence-based');
  });

  it('is Lab verified only with a completed sale that has a lab result', () => {
    const field = { id: 'hill', proofLevel: 'Evidence-based' as const };
    expect(verifiedLevel(field, [])).toBe('Evidence-based');
    expect(verifiedLevel(field, [{ fieldId: 'hill', status: 'paid' }])).toBe('Evidence-based');
    expect(verifiedLevel(field, [{ fieldId: 'hill', status: 'inProgress', labResult: 'passed' }])).toBe('Evidence-based');
    expect(verifiedLevel(field, [{ fieldId: 'north', status: 'paid', labResult: 'passed' }])).toBe('Evidence-based');
    expect(verifiedLevel(field, [{ fieldId: 'hill', status: 'paid', labResult: 'passed' }])).toBe('Lab verified');
    expect(verifiedLevel({ id: 'x', proofLevel: 'Self-reported' }, [])).toBe('Self-reported');
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
