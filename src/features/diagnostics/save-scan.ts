import { STORAGE_BUCKETS } from "@/core/config/constants";
import { tryCreateBrowserClient } from "@/core/supabase/safe-client";
import type { CaptureMode, Presented, SavedScan, ScanDiagnosisJson } from "@/features/diagnostics/scan-types";

type SaveInput = {
  fieldId: string;
  fieldName: string;
  mode: CaptureMode;
  dataUrl: string;
  rawResult: unknown;
  source: "gemini" | "model" | "demo";
  presented: Presented;
};

type SaveResult =
  | { ok: true; scan: SavedScan }
  | { ok: false; error: "needSupabase" | "needLogin" | "uploadFailed" | "insertFailed"; detail?: string };

/** Upload image to `scan-images` and insert a `scans` row. */
export async function saveFarmerScan(input: SaveInput): Promise<SaveResult> {
  const supabase = tryCreateBrowserClient();
  if (!supabase) return { ok: false, error: "needSupabase" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "needLogin" };

  const blob = dataUrlToBlob(input.dataUrl);
  const ext = extFromMime(blob.type);
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKETS.scans).upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });
  if (uploadError) {
    return { ok: false, error: "uploadFailed", detail: uploadError.message };
  }

  const flyCount =
    input.mode === "trap" && isRecord(input.rawResult) && typeof input.rawResult.flyCount === "number"
      ? input.rawResult.flyCount
      : null;

  const diagnosis: ScanDiagnosisJson = {
    mode: input.mode,
    result: input.rawResult,
    source: input.source,
    presented: input.presented,
  };

  const { data: row, error: insertError } = await supabase
    .from("scans")
    .insert({
      field_id: input.fieldId,
      farmer_id: user.id,
      mode: input.mode,
      storage_path: path,
      title: input.presented.title,
      latin_name: input.presented.latin ?? null,
      diagnosis,
      confidence: input.presented.confidence ?? null,
      fly_count: flyCount,
      spot_count: null,
      source: input.source,
      captured_at: new Date().toISOString(),
    })
    .select("id, captured_at, storage_path")
    .single();

  if (insertError || !row) {
    await supabase.storage.from(STORAGE_BUCKETS.scans).remove([path]);
    return { ok: false, error: "insertFailed", detail: insertError?.message };
  }

  return {
    ok: true,
    scan: {
      id: row.id,
      fieldId: input.fieldId,
      fieldName: input.fieldName,
      at: row.captured_at,
      preview: input.dataUrl,
      storagePath: row.storage_path,
      presented: input.presented,
    },
  };
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

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("heic")) return "heic";
  return "jpg";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
