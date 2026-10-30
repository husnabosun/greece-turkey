/** Request and response shapes of the AI server (/api). Used by the server to validate and by the app to read the answers. */
import { z } from 'zod';

export const LANGUAGES = ['en', 'tr', 'el'] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_NAME: Record<Language, string> = { en: 'English', tr: 'Turkish', el: 'Greek' };

/** 1 MB of image = about 1.4 million base64 characters. */
export const MAX_IMAGE_BYTES = 1_000_000;
export const MAX_IMAGE_BASE64 = Math.ceil((MAX_IMAGE_BYTES * 4) / 3);

const image = z.string().min(100).max(MAX_IMAGE_BASE64);
const confidence = z.number().min(0).max(1);

// ---- Requests ----

export const readLabelRequest = z.object({ imageBase64: image });

export const diagnoseRequest = z.object({ imageBase64: image, mode: z.enum(['fruit', 'trap']) });

const short = (n: number) => z.string().max(n);

export const adviseRequest = z.object({
  language: z.enum(LANGUAGES),
  field: z.object({ name: short(60), variety: short(40).optional(), trees: z.number().optional(), ha: z.number().optional() }),
  /** Assessments of our risk engine. The model may only explain these. */
  risks: z
    .array(
      z.object({
        threat: short(40),
        level: z.enum(['Low', 'Medium', 'High']),
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
  recentScans: z.array(z.object({ daysAgo: z.number(), mode: short(10), result: short(80), flies: z.number().optional() })).max(5),
  recentSprays: z.array(z.object({ daysAgo: z.number(), product: short(80) })).max(5),
});

// ---- Responses (what Gemini must return; the server checks it again) ----

export const labelResult = z.object({
  productName: z.string().max(120),
  activeSubstances: z.array(z.string().max(80)).max(8),
  licenceNumber: z.string().max(60).nullable(),
  maxDosePerHa: z.string().max(60).nullable(),
  preHarvestDays: z.number().int().min(0).max(365).nullable(),
  cropsListed: z.array(z.string().max(60)).max(20),
  confidence,
});

export const FRUIT_DIAGNOSES = ['olive fly sting', 'other damage', 'healthy', 'unclear'] as const;

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
export type AdviceResult = z.infer<typeof adviceResult>;

/** Where a result came from. Shown next to the ✦ AI mark. */
export type AiSource = 'gemini' | 'model' | 'demo';
export const SOURCE_LABEL: Record<AiSource, string> = { gemini: 'Gemini', model: 'Our model', demo: 'Demo' };
