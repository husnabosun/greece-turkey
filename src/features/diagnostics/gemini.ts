import { GoogleGenAI } from "@google/genai";
import { getServerEnv } from "@/core/config/env";
import type { z } from "zod";

function stripDataUrl(imageBase64: string): { mime: string; data: string } {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(imageBase64);
  if (match) return { mime: match[1], data: match[2] };
  return { mime: "image/jpeg", data: imageBase64 };
}

export function hasGeminiKey(): boolean {
  return Boolean(getServerEnv().GEMINI_API_KEY);
}

export async function geminiJson<T>(args: {
  prompt: string;
  schema: z.ZodType<T>;
  imageBase64?: string;
  timeoutMs?: number;
}): Promise<T | null> {
  const env = getServerEnv();
  if (!env.GEMINI_API_KEY) return null;

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: args.prompt }];

  if (args.imageBase64) {
    const { mime, data } = stripDataUrl(args.imageBase64);
    parts.unshift({ inlineData: { mimeType: mime, data } });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? 20_000);

  try {
    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
        abortSignal: controller.signal,
      },
    });

    const text = response.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as unknown;
    const checked = args.schema.safeParse(parsed);
    return checked.success ? checked.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
