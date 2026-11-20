import { STORAGE_BUCKETS } from "@/core/config/constants";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import { compressImageFile } from "@/shared/lib/compress-image";

export const PHOTO_PROOF_IDS = new Set([
  "field-photo",
  "olives-photo",
  "spray-receipt",
  "quality-cert",
]);

export function isPhotoProof(id: string) {
  return PHOTO_PROOF_IDS.has(id);
}

type UploadResult =
  | { ok: true; path: string; preview: string }
  | { ok: false; error: "needSupabase" | "needLogin" | "uploadFailed"; detail?: string };

/** Compress + upload a proof image to the `proofs` bucket. */
export async function uploadFieldProof(file: File, proofId: string): Promise<UploadResult> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "needLogin" };

  const dataUrl = await compressImageFile(file);
  const blob = dataUrlToBlob(dataUrl);
  const path = `${user.id}/${proofId}-${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage.from(STORAGE_BUCKETS.proofs).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) return { ok: false, error: "uploadFailed", detail: error.message };

  return { ok: true, path, preview: dataUrl };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  const header = comma >= 0 ? dataUrl.slice(0, comma) : "";
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mime = /data:(.*?);/.exec(header)?.[1] ?? "image/jpeg";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
