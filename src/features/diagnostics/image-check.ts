/**
 * Server-side sanity check of a base64 image without native deps: reads the JPEG / PNG / WebP header
 * to get the size. Corrupt bytes, 1×1 pixels and 9000×300 panoramas are rejected before any AI call.
 */
export type ImageCheck =
  | { ok: true; width: number; height: number; format: "jpeg" | "png" | "webp" }
  | { ok: false; code: "not_image" | "too_small" | "bad_aspect" };

export const MIN_IMAGE_SIDE = 200;
export const MAX_IMAGE_ASPECT = 4;

function jpegSize(b: Buffer): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = b.readUInt16BE(i + 2);
    if (len < 2) return null;
    // SOF0..SOF15 except DHT(C4), JPG(C8), DAC(CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

export function checkImageBase64(base64: string): ImageCheck {
  let b: Buffer;
  try {
    b = Buffer.from(base64, "base64");
  } catch {
    return { ok: false, code: "not_image" };
  }
  if (b.length < 100) return { ok: false, code: "not_image" };
  let size: { width: number; height: number } | null = null;
  let format: "jpeg" | "png" | "webp" | null = null;
  if (b[0] === 0xff && b[1] === 0xd8) {
    size = jpegSize(b);
    format = "jpeg";
  } else if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    size = { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    format = "png";
  } else if (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") {
    const chunk = b.subarray(12, 16).toString("ascii");
    if (chunk === "VP8X") size = { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    else if (chunk === "VP8 ") size = { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    else if (chunk === "VP8L") {
      const bits = b.readUInt32LE(21);
      size = { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    format = "webp";
  }
  if (!size || !format || !size.width || !size.height) return { ok: false, code: "not_image" };
  if (Math.min(size.width, size.height) < MIN_IMAGE_SIDE) return { ok: false, code: "too_small" };
  if (Math.max(size.width, size.height) / Math.min(size.width, size.height) > MAX_IMAGE_ASPECT) {
    return { ok: false, code: "bad_aspect" };
  }
  return { ok: true, ...size, format };
}
