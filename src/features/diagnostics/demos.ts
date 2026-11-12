import type { AdviceResult, FruitResult, LabelResult, LeafResult, TrapResult } from "./schemas";

export const DEMO_LABEL: LabelResult = {
  productName: "Copper oxychloride 50 WP",
  activeSubstances: ["copper oxychloride"],
  licenceNumber: "DEMO-EL-001",
  maxDosePerHa: "3 kg/ha",
  preHarvestDays: 14,
  cropsListed: ["olive"],
  confidence: 0.72,
};

export const DEMO_LEAF: LeafResult = {
  label: "Olive Peacock Spot",
  confidence: 0.78,
  top3: [
    { label: "Olive Peacock Spot", confidence: 0.78 },
    { label: "Healthy", confidence: 0.15 },
    { label: "Aculus Olearius", confidence: 0.07 },
  ],
  symptoms: ["Round dark spots on the upper leaf surface"],
};

export const DEMO_FRUIT: FruitResult = {
  diagnosis: "olive fly sting",
  confidence: 0.7,
  symptoms: ["Small dark puncture on the fruit skin"],
};

export const DEMO_TRAP: TrapResult = {
  flyCount: 8,
  confidence: 0.65,
  notes: "Demo count — connect GEMINI_API_KEY for a live read.",
};

export function demoAdvice(fieldName: string): AdviceResult {
  return {
    summary: `${fieldName}: medium olive fly pressure this week. Check traps and fallen fruit.`,
    actions: ["Check yellow sticky traps", "Pick up fallen olives under the trees", "Ask a licensed agronomist if pressure rises"],
    whyNow: "Warm nights and recent trap activity raise the short-term risk.",
  };
}
