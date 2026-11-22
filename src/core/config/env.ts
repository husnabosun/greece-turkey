import { z } from "zod";

/**
 * Public env vars are validated loosely so `next build` works without secrets.
 * Server secrets are read only where needed (API routes / server actions).
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional().or(z.literal("")),
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),
  /** @deprecated Prefer Vertex AI via GOOGLE_CLOUD_* + service account. Kept for local fallback. */
  GEMINI_API_KEY: z.string().optional().or(z.literal("")),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash"),
  GOOGLE_CLOUD_PROJECT: z.string().optional().or(z.literal("")),
  GOOGLE_CLOUD_LOCATION: z.string().default("global"),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional().or(z.literal("")),
  /** The service-account key JSON itself (for hosts without files, e.g. Vercel). Wins over the file. */
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional().or(z.literal("")),
  AGROMONITORING_API_KEY: z.string().optional().or(z.literal("")),
  /** Optional Hugging Face token (needed if the leaf Space is private). */
  HF_TOKEN: z.string().optional().or(z.literal("")),
  /** Gradio Space id that serves leaf_disease.tflite. Default: hupus/agropulse-leaf */
  LEAF_HF_SPACE: z.string().default("hupus/agropulse-leaf"),
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    AGROMONITORING_API_KEY: process.env.AGROMONITORING_API_KEY,
    HF_TOKEN: process.env.HF_TOKEN,
    LEAF_HF_SPACE: process.env.LEAF_HF_SPACE,
  });
}

export function hasSupabaseConfig() {
  return Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
