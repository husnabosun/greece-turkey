/** Browser-side resize + JPEG compress before API upload (avoids Vercel 413 on base64). */

const DEFAULT_MAX_SIDE = 1600;
const DEFAULT_QUALITY = 0.85;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("imageLoadFailed"));
    img.src = src;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("readFailed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Returns a JPEG data URL (max side 1600 by default). Falls back to the original
 * data URL when canvas is unavailable.
 */
export async function compressImageFile(
  file: File,
  opts?: { maxSide?: number; quality?: number },
): Promise<string> {
  const maxSide = opts?.maxSide ?? DEFAULT_MAX_SIDE;
  const quality = opts?.quality ?? DEFAULT_QUALITY;
  const original = await readFileAsDataUrl(file);

  if (typeof document === "undefined") return original;

  try {
    const img = await loadImage(original);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return original;

    const scale = Math.min(1, maxSide / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, tw, th);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return original;
  }
}

/** Strip `data:image/...;base64,` prefix for API payloads. */
export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl;
}
