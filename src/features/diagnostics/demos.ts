import type { AdviceResult, FruitResult, LabelResult, LeafResult, TrapResult } from "./schemas";
import type { LANGUAGES } from "./schemas";

type Language = (typeof LANGUAGES)[number];

export const DEMO_LABEL: LabelResult = {
  photo: "ok",
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
  photo: "ok",
  diagnosis: "olive fly",
  confidence: 0.7,
  summary: "Small dark puncture marks on the skin look like olive fly stings.",
};

export const DEMO_TRAP: TrapResult = {
  photo: "ok",
  flyCount: 8,
  mothCount: 0,
  otherInsects: false,
  confidence: 0.65,
  summary: "About 8 olive flies are stuck on the trap.",
};

const DEMO_ADVICE: Record<Language, (fieldName: string) => AdviceResult> = {
  en: (fieldName) => ({
    summary: `${fieldName}: medium olive fly pressure this week. Check traps and fallen fruit.`,
    actions: ["Check yellow sticky traps", "Pick up fallen olives under the trees", "Ask a licensed agronomist if pressure rises"],
    whyNow: "Warm nights and recent trap activity raise the short-term risk.",
  }),
  el: (fieldName) => ({
    summary: `${fieldName}: μέτρια πίεση δάκου αυτή την εβδομάδα. Έλεγξε τις παγίδες και τους πεσμένους καρπούς.`,
    actions: ["Έλεγξε τις κίτρινες κολλητικές παγίδες", "Μάζεψε τις ελιές που έπεσαν κάτω από τα δέντρα", "Ρώτησε αδειοδοτημένο γεωπόνο αν αυξηθεί η πίεση"],
    whyNow: "Οι ζεστές νύχτες και η πρόσφατη δραστηριότητα στις παγίδες αυξάνουν τον βραχυπρόθεσμο κίνδυνο.",
  }),
  tr: (fieldName) => ({
    summary: `${fieldName}: bu hafta zeytin sineği baskısı orta düzeyde. Tuzakları ve yere düşen meyveleri kontrol et.`,
    actions: ["Sarı yapışkan tuzakları kontrol et", "Ağaçların altındaki düşmüş zeytinleri topla", "Baskı artarsa lisanslı bir ziraat mühendisine danış"],
    whyNow: "Sıcak geceler ve son tuzak hareketliliği kısa vadeli riski artırıyor.",
  }),
};

/** Safe fallback when the AI is unavailable, in the user's language. */
export function demoAdvice(fieldName: string, language: Language = "en"): AdviceResult {
  return DEMO_ADVICE[language](fieldName);
}
