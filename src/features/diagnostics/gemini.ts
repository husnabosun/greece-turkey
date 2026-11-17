import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GoogleAuth, JWT } from "google-auth-library";
import { getServerEnv } from "@/core/config/env";
import type { z } from "zod";

const DEFAULT_MODEL = "gemini-3.5-flash";
const FALLBACK_MODEL = "gemini-3.8-flash";
/** Gemini 3.x on agropulse-vertex is served on the global Vertex host (regional us-central1 returns 404). */
const DEFAULT_LOCATION = "global";

function stripDataUrl(imageBase64: string): { mime: string; data: string } {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(imageBase64);
  if (match) return { mime: match[1], data: match[2] };
  return { mime: "image/jpeg", data: imageBase64 };
}

/**
 * Always resolve the service-account JSON from the project root so Next.js
 * working-directory differences cannot break ADC.
 */
export function resolveServiceAccountPath(): string | null {
  const candidates = [
    resolve(process.cwd(), "gcp-service-account.json"),
    resolve(process.cwd(), getServerEnv().GOOGLE_APPLICATION_CREDENTIALS || ""),
  ].filter(Boolean);
  for (const path of candidates) {
    if (path && existsSync(path)) return path;
  }
  return null;
}

/** True when Vertex AI project + service-account file are configured. */
export function hasGeminiKey(): boolean {
  const env = getServerEnv();
  return Boolean(env.GOOGLE_CLOUD_PROJECT && resolveServiceAccountPath());
}

type VertexPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type VertexGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { code?: number; message?: string; status?: string };
};

function normalizeModelId(model: string): string {
  return model.replace(/^models\//, "");
}

function resolveModelCandidates(primary: string): string[] {
  const first = normalizeModelId(primary || DEFAULT_MODEL);
  const second = FALLBACK_MODEL;
  return first === second ? [first] : [first, second];
}

/**
 * Vertex generateContent URL.
 * For location=global use aiplatform.googleapis.com (required for gemini-3.5/3.8-flash).
 * Regional locations use `{location}-aiplatform.googleapis.com`.
 */
function vertexGenerateContentUrl(project: string, location: string, model: string): string {
  const loc = location || DEFAULT_LOCATION;
  if (loc === "global") {
    return `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${model}:generateContent`;
  }
  return `https://${loc}-aiplatform.googleapis.com/v1/projects/${project}/locations/${loc}/publishers/google/models/${model}:generateContent`;
}

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
};

async function getVertexAccessToken(keyFilename: string): Promise<string> {
  const credentials = JSON.parse(readFileSync(keyFilename, "utf8")) as ServiceAccountJson;
  // GoogleAuth keyFilename/credentials are deprecated in google-auth-library v11;
  // pass an explicit JWT authClient built from the SA JSON at the project root.
  const auth = new GoogleAuth({
    authClient: new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    }),
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const accessToken = typeof token === "string" ? token : token?.token;
  if (!accessToken) {
    throw new Error("Failed to obtain Vertex access token from service account");
  }
  return accessToken;
}

export type GeminiJsonResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason: "no_key" | "empty" | "parse" | "schema" | "timeout" | "billing" | "api";
      detail?: string;
    };

export async function geminiJson<T>(args: {
  prompt: string;
  schema: z.ZodType<T>;
  imageBase64?: string;
  imageBase64List?: string[];
  timeoutMs?: number;
}): Promise<T | null> {
  const result = await geminiJsonDetailed(args);
  return result.ok ? result.data : null;
}

/** Vertex AI Gemini JSON call via regional REST (fruit / trap / label / advise). */
export async function geminiJsonDetailed<T>(args: {
  prompt: string;
  schema: z.ZodType<T>;
  imageBase64?: string;
  imageBase64List?: string[];
  timeoutMs?: number;
}): Promise<GeminiJsonResult<T>> {
  const env = getServerEnv();
  const project = env.GOOGLE_CLOUD_PROJECT;
  const location = env.GOOGLE_CLOUD_LOCATION || DEFAULT_LOCATION;
  const keyFilename = resolveServiceAccountPath();
  if (!project || !keyFilename) return { ok: false, reason: "no_key" };

  const parts: VertexPart[] = [{ text: args.prompt }];
  const images = [...(args.imageBase64List ?? []), ...(args.imageBase64 ? [args.imageBase64] : [])];
  for (const img of images.slice(0, 4)) {
    const { mime, data } = stripDataUrl(img);
    parts.unshift({ inlineData: { mimeType: mime, data } });
  }

  const models = resolveModelCandidates(env.GEMINI_MODEL || DEFAULT_MODEL);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 45_000);
  const payload = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  try {
    const accessToken = await getVertexAccessToken(keyFilename);
    let lastFail: GeminiJsonResult<T> | null = null;

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      const url = vertexGenerateContentUrl(project, location, model);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: payload,
        signal: controller.signal,
      });

      const rawText = await res.text();
      let body: VertexGenerateContentResponse | null = null;
      try {
        body = rawText ? (JSON.parse(rawText) as VertexGenerateContentResponse) : null;
      } catch {
        body = null;
      }

      if (!res.ok) {
        const message =
          body?.error?.message ||
          rawText.slice(0, 500) ||
          `Vertex HTTP ${res.status}`;
        const notFound = res.status === 404 || /NOT_FOUND|was not found/i.test(message);
        const reason =
          res.status === 402 ||
          /prepayment|billing|credits? (are )?depleted|quota|RESOURCE_EXHAUSTED/i.test(message)
            ? "billing"
            : "api";
        if (process.env.NODE_ENV === "development") {
          console.warn("[vertex-ai]", reason, res.status, model, message);
        }
        lastFail = { ok: false, reason, detail: message.slice(0, 240) };
        // Fall back to gemini-3.8-flash when primary model is missing/unavailable.
        if (notFound && i < models.length - 1) continue;
        return lastFail;
      }

      const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return { ok: false, reason: "empty" };

      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch (err) {
        return {
          ok: false,
          reason: "parse",
          detail: err instanceof Error ? err.message : "invalid json",
        };
      }
      const checked = args.schema.safeParse(parsed);
      if (!checked.success) {
        return {
          ok: false,
          reason: "schema",
          detail: checked.error.issues.slice(0, 3).map((issue) => issue.message).join("; "),
        };
      }
      return { ok: true, data: checked.data };
    }

    return lastFail ?? { ok: false, reason: "api", detail: "no model candidates" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const reason = /abort|timeout/i.test(message)
      ? "timeout"
      : /402|prepayment|billing|credits? (are )?depleted|quota|RESOURCE_EXHAUSTED/i.test(message)
        ? "billing"
        : "api";
    if (process.env.NODE_ENV === "development") {
      console.warn("[vertex-ai]", reason, message);
    }
    return { ok: false, reason, detail: message.slice(0, 240) };
  } finally {
    clearTimeout(timer);
  }
}
