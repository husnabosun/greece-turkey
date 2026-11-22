import { z } from "zod";

export const LANGUAGES = ["en", "tr", "el"] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_NAME: Record<Language, string> = {
  en: "English",
  tr: "Turkish",
  el: "Greek",
};

export const MAX_IMAGE_BYTES = 4_000_000;
export const MAX_IMAGE_BASE64 = Math.ceil((MAX_IMAGE_BYTES * 4) / 3);

const image = z.string().min(100).max(MAX_IMAGE_BASE64);
const confidence = z.number().min(0).max(1);
const short = (n: number) => z.string().max(n);

export const readLabelRequest = z.object({ imageBase64: image });

export const diagnoseRequest = z.object({
  /** Primary image (kept for older clients). */
  imageBase64: image,
  /** Extra photos from the same capture session (max 3 more). */
  imageBase64List: z.array(image).max(4).optional(),
  mode: z.enum(["leaf", "fruit", "trap"]),
  /** UI language — free-text parts of the answer (symptoms, notes) come back in it. */
  language: z.enum(LANGUAGES).optional(),
  /** Optional field/weather context for better diagnosis. */
  context: z
    .object({
      fieldName: short(60).optional(),
      variety: short(40).optional(),
      varietySlug: short(40).optional(),
      primaryUse: z.enum(["OIL", "TABLE", "DUAL"]).optional(),
      droughtTolerance: z.number().int().min(1).max(5).optional(),
      diseaseSusceptibility: z
        .object({
          bactrocera_oleae: z.number().min(1).max(5).optional(),
          spilocaea_oleagina: z.number().min(1).max(5).optional(),
          colletotrichum: z.number().min(1).max(5).optional(),
          pseudomonas_savastanoi: z.number().min(1).max(5).optional(),
        })
        .optional(),
      temperatureC: z.number().optional(),
      recentRisk: short(80).optional(),
    })
    .optional(),
});

export const adviseRequest = z.object({
  language: z.enum(LANGUAGES),
  field: z.object({
    name: short(60),
    variety: short(40).optional(),
    varietySlug: short(40).optional(),
    primaryUse: z.enum(["OIL", "TABLE", "DUAL"]).optional(),
    avgOilYieldPct: z.tuple([z.number(), z.number()]).optional(),
    droughtTolerance: z.number().int().min(1).max(5).optional(),
    diseaseSusceptibility: z.record(z.string(), z.number()).optional(),
    trees: z.number().optional(),
    ha: z.number().optional(),
  }),
  risks: z
    .array(
      z.object({
        threat: short(40),
        level: z.enum(["Low", "Medium", "High"]),
        score: z.number().min(0).max(100),
        day: short(20),
        drivers: z.array(short(200)).max(4),
      }),
    )
    .max(10),
  weather: z.object({
    temperatureC: z.number().optional(),
    summary: short(200),
    rainTomorrowMm: z.number().optional(),
  }),
  recentScans: z
    .array(z.object({ daysAgo: z.number(), mode: short(10), result: short(80), flies: z.number().optional() }))
    .max(5),
  recentSprays: z.array(z.object({ daysAgo: z.number(), product: short(80) })).max(5),
});

export const weatherRequest = z.object({
  fieldId: z.string().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  force: z.boolean().optional(),
});

export const ndviRequest = z.object({
  name: z.string().min(1).max(80).default("field"),
  /** GeoJSON Polygon coordinates: number[][][] (rings of [lon, lat]). */
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
  start: z.number().int().positive().optional(),
  end: z.number().int().positive().optional(),
});

/** What is wrong with the photo itself. Anything but "ok" means: ask for a new photo, give no diagnosis. */
export const PHOTO_ISSUES = ["ok", "not_olive", "wrong_scan_type", "blurry", "too_dark"] as const;
export const LABEL_PHOTO_ISSUES = ["ok", "not_a_label", "cut_off", "blurry", "too_dark"] as const;

export const labelResult = z.object({
  photo: z.enum(LABEL_PHOTO_ISSUES),
  productName: z.string().max(120),
  activeSubstances: z.array(z.string().max(80)).max(8),
  licenceNumber: z.string().max(60).nullable(),
  maxDosePerHa: z.string().max(60).nullable(),
  preHarvestDays: z.number().int().min(0).max(365).nullable(),
  cropsListed: z.array(z.string().max(60)).max(20),
  confidence,
});

/** Quick gate: is this an olive leaf photo? */
export const leafGateResult = z.object({
  isOliveLeaf: z.boolean(),
  confidence,
  reason: z.string().max(160).optional(),
});
export type LeafGateResult = z.infer<typeof leafGateResult>;

/** Fruit problems. Names follow the risk engine threats: olive-fly, anthracnose, olive-moth, drought. */
export const FRUIT_DIAGNOSES = [
  "olive fly",
  "anthracnose",
  "olive moth",
  "hail or mechanical damage",
  "sunscald",
  "drought shrivel",
  "sooty mould or scale",
  "healthy",
  "unclear",
] as const;
export const LEAF_LABELS = ["Healthy", "Olive Peacock Spot", "Aculus Olearius"] as const;

function coerceLeafLabel(raw: unknown): (typeof LEAF_LABELS)[number] | unknown {
  if (typeof raw !== "string") return raw;
  const n = raw.trim().toLowerCase();
  if (n === "healthy" || n.includes("υγι")) return "Healthy";
  if (n.includes("peacock") || n.includes("spilocaea") || n.includes("cyclocon") || n.includes("κυκλοκ")) {
    return "Olive Peacock Spot";
  }
  if (n.includes("aculus") || n.includes("mite") || n.includes("ακάρε")) return "Aculus Olearius";
  return raw;
}

const leafLabel = z.preprocess(coerceLeafLabel, z.enum(LEAF_LABELS));

/** The model may still say "olive fly sting" or "exit hole": that is the olive fly. */
function coerceFruitDiagnosis(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const n = raw.trim().toLowerCase();
  if (n.startsWith("olive fly")) return "olive fly";
  return n;
}

export const fruitResult = z.object({
  photo: z.enum(PHOTO_ISSUES),
  diagnosis: z.preprocess(coerceFruitDiagnosis, z.enum(FRUIT_DIAGNOSES)),
  confidence,
  /** One short sentence for the farmer, in the language of the request. */
  summary: z.string().min(1).max(220),
});

export const trapResult = z.object({
  photo: z.enum(PHOTO_ISSUES),
  /** Olive flies (Bactrocera oleae) only. */
  flyCount: z.number().int().min(0).max(500),
  /** Olive moths (Prays oleae) only. */
  mothCount: z.number().int().min(0).max(500),
  /** Other insects (bycatch) are on the trap. */
  otherInsects: z.boolean(),
  confidence,
  /** One short sentence for the farmer, in the language of the request. */
  summary: z.string().min(1).max(220),
});

export const leafResult = z.object({
  label: leafLabel,
  confidence,
  top3: z
    .array(z.object({ label: leafLabel, confidence }))
    .min(1)
    .max(3),
  symptoms: z.array(z.string().max(120)).max(5).optional(),
});

export const adviceResult = z.object({
  summary: z.string().min(1).max(320),
  actions: z.array(z.string().min(1).max(140)).min(1).max(3),
  whyNow: z.string().min(1).max(220),
});

export type ReadLabelRequest = z.infer<typeof readLabelRequest>;
export type DiagnoseRequest = z.infer<typeof diagnoseRequest>;
export type AdviseRequest = z.infer<typeof adviseRequest>;
export type LabelResult = z.infer<typeof labelResult>;
export type FruitResult = z.infer<typeof fruitResult>;
export type TrapResult = z.infer<typeof trapResult>;
export type LeafResult = z.infer<typeof leafResult>;
export type AdviceResult = z.infer<typeof adviceResult>;

export type AiSource = "gemini" | "demo";
