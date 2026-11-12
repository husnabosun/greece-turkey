import { z } from "zod";

export const LANGUAGES = ["en", "tr", "el"] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_NAME: Record<Language, string> = {
  en: "English",
  tr: "Turkish",
  el: "Greek",
};

export const MAX_IMAGE_BYTES = 1_000_000;
export const MAX_IMAGE_BASE64 = Math.ceil((MAX_IMAGE_BYTES * 4) / 3);

const image = z.string().min(100).max(MAX_IMAGE_BASE64);
const confidence = z.number().min(0).max(1);
const short = (n: number) => z.string().max(n);

export const readLabelRequest = z.object({ imageBase64: image });

export const diagnoseRequest = z.object({
  imageBase64: image,
  mode: z.enum(["leaf", "fruit", "trap"]),
  /** Optional field/weather context for better diagnosis. */
  context: z
    .object({
      fieldName: short(60).optional(),
      variety: short(40).optional(),
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

export const labelResult = z.object({
  productName: z.string().max(120),
  activeSubstances: z.array(z.string().max(80)).max(8),
  licenceNumber: z.string().max(60).nullable(),
  maxDosePerHa: z.string().max(60).nullable(),
  preHarvestDays: z.number().int().min(0).max(365).nullable(),
  cropsListed: z.array(z.string().max(60)).max(20),
  confidence,
});

export const FRUIT_DIAGNOSES = ["olive fly sting", "other damage", "healthy", "unclear"] as const;
export const LEAF_LABELS = ["Healthy", "Olive Peacock Spot", "Aculus Olearius"] as const;

export const fruitResult = z.object({
  diagnosis: z.enum(FRUIT_DIAGNOSES),
  confidence,
  symptoms: z.array(z.string().max(120)).max(5),
});

export const trapResult = z.object({
  flyCount: z.number().int().min(0).max(500),
  confidence,
  notes: z.string().max(200),
});

export const leafResult = z.object({
  label: z.enum(LEAF_LABELS),
  confidence,
  top3: z
    .array(z.object({ label: z.enum(LEAF_LABELS), confidence }))
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
