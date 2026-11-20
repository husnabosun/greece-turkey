/**
 * Builds professional brand assets from the source JPEG:
 * - square transparent PNG master
 * - favicon.ico (16/32/48)
 * - PWA + Apple touch icons
 * - Next.js app/icon.png + apple-icon.png
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

const SRC = existsSync("public/brand/source-original.jpg")
  ? "public/brand/source-original.jpg"
  : "public/agropulse-logo.jpg";
const OUT_DIR = "public/brand";
mkdirSync(OUT_DIR, { recursive: true });

const APP_BG = { r: 250, g: 250, b: 248, alpha: 1 }; // #FAFAF8

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const WHITE = 245;
let minX = width;
let minY = height;
let maxX = 0;
let maxY = 0;
const out = Buffer.from(data);

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= WHITE && g >= WHITE && b >= WHITE) {
      out[i + 3] = 0;
      continue;
    }
    const darkness = Math.min(r, g, b);
    if (darkness > 220) {
      out[i + 3] = Math.max(0, Math.min(255, Math.round((255 - darkness) * 7)));
    }
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
}

const contentW = maxX - minX + 1;
const contentH = maxY - minY + 1;
const pad = Math.round(Math.max(contentW, contentH) * 0.06);
const side = Math.max(contentW, contentH) + pad * 2;
const offsetX = Math.floor((side - contentW) / 2);
const offsetY = Math.floor((side - contentH) / 2);

const cropped = Buffer.alloc(contentW * contentH * 4);
for (let y = 0; y < contentH; y++) {
  for (let x = 0; x < contentW; x++) {
    const si = ((minY + y) * width + (minX + x)) * 4;
    const di = (y * contentW + x) * 4;
    cropped[di] = out[si];
    cropped[di + 1] = out[si + 1];
    cropped[di + 2] = out[si + 2];
    cropped[di + 3] = out[si + 3];
  }
}

const croppedPng = await sharp(cropped, {
  raw: { width: contentW, height: contentH, channels: 4 },
})
  .png()
  .toBuffer();

const nativeMaster = await sharp({
  create: {
    width: side,
    height: side,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: croppedPng, left: offsetX, top: offsetY }])
  .png({ compressionLevel: 9 })
  .toBuffer();

/** Prefer a crisp 512 master (mild upscale from ~370px). */
const master = await sharp(nativeMaster)
  .resize(512, 512, {
    kernel: sharp.kernel.lanczos3,
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9 })
  .toBuffer();

console.log("native", side, "master 512");

async function pngAt(size, { opaqueBg = null } = {}) {
  let pipeline = sharp(master).resize(size, size, {
    fit: "contain",
    background: opaqueBg ?? { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (opaqueBg) {
    pipeline = sharp({
      create: { width: size, height: size, channels: 4, background: opaqueBg },
    }).composite([
      {
        input: await sharp(master)
          .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer(),
        gravity: "centre",
      },
    ]);
  }
  return pipeline.png({ compressionLevel: 9 }).toBuffer();
}

function buildIco(pngBuffers, icoSizes) {
  const count = pngBuffers.length;
  let offset = 6 + count * 16;
  const entries = [];
  for (let i = 0; i < count; i++) {
    entries.push({ s: icoSizes[i], png: pngBuffers[i], offset });
    offset += pngBuffers[i].length;
  }
  const buf = Buffer.alloc(offset);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(count, 4);
  for (let i = 0; i < count; i++) {
    const e = entries[i];
    const o = 6 + i * 16;
    buf.writeUInt8(e.s >= 256 ? 0 : e.s, o);
    buf.writeUInt8(e.s >= 256 ? 0 : e.s, o + 1);
    buf.writeUInt8(0, o + 2);
    buf.writeUInt8(0, o + 3);
    buf.writeUInt16LE(1, o + 4);
    buf.writeUInt16LE(32, o + 6);
    buf.writeUInt32LE(e.png.length, o + 8);
    buf.writeUInt32LE(e.offset, o + 12);
    e.png.copy(buf, e.offset);
  }
  return buf;
}

const writes = [
  ["public/agropulse-logo.png", await pngAt(512)],
  [join(OUT_DIR, "agropulse-logo.png"), await pngAt(512)],
  [join(OUT_DIR, "icon-512.png"), await pngAt(512)],
  [join(OUT_DIR, "icon-192.png"), await pngAt(192)],
  [join(OUT_DIR, "apple-touch-icon.png"), await pngAt(180, { opaqueBg: APP_BG })],
  [join(OUT_DIR, "favicon-32.png"), await pngAt(32)],
  [join(OUT_DIR, "favicon-16.png"), await pngAt(16)],
  ["src/app/icon.png", await pngAt(512)],
  ["src/app/apple-icon.png", await pngAt(180, { opaqueBg: APP_BG })],
];

for (const [path, buf] of writes) {
  writeFileSync(path, buf);
  console.log("wrote", path, `${Math.round(buf.length / 1024)}KB`);
}

const icoSizes = [16, 32, 48];
const icoPngs = [];
for (const s of icoSizes) icoPngs.push(await pngAt(s));
const ico = buildIco(icoPngs, icoSizes);
writeFileSync("public/favicon.ico", ico);
writeFileSync("src/app/favicon.ico", ico);
console.log("wrote favicon.ico", `${Math.round(ico.length / 1024)}KB`);

if (!existsSync(join(OUT_DIR, "source-original.jpg"))) {
  writeFileSync(join(OUT_DIR, "source-original.jpg"), await sharp(SRC).jpeg({ quality: 95 }).toBuffer());
}

// Drop the old public JPEG so the app never serves the unprocessed asset.
if (existsSync("public/agropulse-logo.jpg")) {
  unlinkSync("public/agropulse-logo.jpg");
  console.log("removed public/agropulse-logo.jpg");
}

console.log("done");
