import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, handle_file } from "@gradio/client";
import { getServerEnv } from "@/core/config/env";
import { leafResult, type LeafResult } from "@/features/diagnostics/schemas";

/** Hugging Face Space that runs `leaf_disease.tflite` (legacy research/03_hf_space). */
export const DEFAULT_LEAF_SPACE = "hupus/agropulse-leaf";
export const LEAF_MODEL_VERSION = "v2";
/** Cold ZeroGPU wake can take ~60s; authenticated runs are usually faster. */
export const LEAF_TIMEOUT_MS = 120_000;

export type LeafModelResult =
  | { ok: true; data: LeafResult; modelVersion: string }
  | {
      ok: false;
      reason: "timeout" | "space" | "schema" | "empty" | "quota" | "no_token";
      detail?: string;
    };

let connection: Promise<Client> | null = null;

function spaceId(): string {
  return getServerEnv().LEAF_HF_SPACE || DEFAULT_LEAF_SPACE;
}

function hfToken(): string | undefined {
  const env = getServerEnv();
  const token = (env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN || "").trim();
  return token || undefined;
}

function mimeOf(base64: string): string {
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg";
}

function stripDataUrl(imageBase64: string): { mime: string; data: string; dataUrl: string } {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(imageBase64);
  if (match) {
    return { mime: match[1], data: match[2], dataUrl: imageBase64 };
  }
  const mime = mimeOf(imageBase64);
  return { mime, data: imageBase64, dataUrl: `data:${mime};base64,${imageBase64}` };
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function classifyError(message: string): LeafModelResult["ok"] extends false
  ? Extract<LeafModelResult, { ok: false }>["reason"]
  : never {
  if (/timeout/i.test(message)) return "timeout";
  if (/ZeroGPU|runs limit|quota|Authenticate with a Hugging Face token/i.test(message)) {
    return "quota";
  }
  return "space";
}

async function getClient(token: string | undefined): Promise<Client> {
  connection ??= Client.connect(spaceId(), token ? { token: token as `hf_${string}` } : {});
  return connection;
}

async function predictOnce(
  client: Client,
  dataUrl: string,
  mime: string,
  ext: string,
): Promise<unknown> {
  // Preferred for Gradio 5: FileData with data URL.
  try {
    const result = await client.predict("/predict", {
      image: {
        url: dataUrl,
        path: null,
        orig_name: `leaf.${ext}`,
        mime_type: mime,
        size: Math.floor((dataUrl.length * 3) / 4),
        is_stream: false,
        meta: { _type: "gradio.FileData" },
      },
    });
    return Array.isArray(result.data) ? result.data[0] : result.data;
  } catch (first) {
    // Fallback: temp file + handle_file (some Space builds reject large data URLs).
    const path = join(tmpdir(), `agropulse-leaf-${Date.now()}.${ext}`);
    const raw = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    await writeFile(path, Buffer.from(raw, "base64"));
    try {
      const result = await client.predict("/predict", {
        image: handle_file(path),
      });
      return Array.isArray(result.data) ? result.data[0] : result.data;
    } catch {
      throw first;
    } finally {
      await unlink(path).catch(() => undefined);
    }
  }
}

/**
 * Classify one olive leaf photo via the HF Gradio Space.
 * ZeroGPU anonymous quota is tiny — set HF_TOKEN in `.env.local` for reliable runs.
 */
export async function predictLeafModel(imageBase64: string): Promise<LeafModelResult> {
  const token = hfToken();
  const { mime, dataUrl } = stripDataUrl(imageBase64);
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";

  const attempt = async (): Promise<LeafModelResult> => {
    const client = await withTimeout(getClient(token), LEAF_TIMEOUT_MS);
    const payload = await withTimeout(predictOnce(client, dataUrl, mime, ext), LEAF_TIMEOUT_MS);
    if (payload == null) return { ok: false, reason: "empty" };
    const parsed = leafResult.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        reason: "schema",
        detail: parsed.error.issues.slice(0, 3).map((i) => i.message).join("; "),
      };
    }
    return { ok: true, data: parsed.data, modelVersion: LEAF_MODEL_VERSION };
  };

  try {
    return await attempt();
  } catch (err) {
    connection = null;
    const message = err instanceof Error ? err.message : String(err);
    const reason = classifyError(message);

    // One retry after reconnect (covers a sleeping Space / stale client).
    if (reason === "space" || reason === "timeout") {
      try {
        return await attempt();
      } catch (retryErr) {
        connection = null;
        const retryMessage = retryErr instanceof Error ? retryErr.message : String(retryErr);
        const retryReason = classifyError(retryMessage);
        if (process.env.NODE_ENV === "development") {
          console.warn("[leaf-space]", retryReason, retryMessage);
        }
        if (retryReason === "quota" && !token) {
          return { ok: false, reason: "no_token", detail: retryMessage.slice(0, 240) };
        }
        return { ok: false, reason: retryReason, detail: retryMessage.slice(0, 240) };
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.warn("[leaf-space]", reason, message);
    }
    if (reason === "quota" && !token) {
      return { ok: false, reason: "no_token", detail: message.slice(0, 240) };
    }
    return { ok: false, reason, detail: message.slice(0, 240) };
  }
}
