/**
 * Compresses oversized raster images under apps/web/public before every build.
 * We serve marketing/avatar images with `unoptimized` on next/image (Vercel's Image
 * Optimization API has a request quota we've hit before — see git history), so nothing
 * shrinks these automatically at request time. This script is the replacement: it runs
 * on every `npm run build` so a heavy source upload (e.g. an AI-generated PNG saved with
 * a .jpg extension) never ships uncompressed to production again.
 */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const publicDir = path.join(__dirname, "..", "public");
const SIZE_THRESHOLD_BYTES = 200 * 1024;
const MIN_SAVINGS_RATIO = 0.15;
const JPEG_QUALITY = 100;
const PNG_QUALITY = 100;

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (/\.(jpe?g|png)$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

async function optimize(file) {
  const before = fs.statSync(file).size;
  if (before < SIZE_THRESHOLD_BYTES) return;

  const ext = path.extname(file).toLowerCase();
  let buffer;
  try {
    buffer =
      ext === ".png"
        ? await sharp(file).png({ quality: PNG_QUALITY, palette: true, effort: 8 }).toBuffer()
        : await sharp(file).jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  } catch (err) {
    console.warn(`[optimize-images] Skipping ${path.relative(publicDir, file)}: ${err.message}`);
    return;
  }

  if (buffer.length < before * (1 - MIN_SAVINGS_RATIO)) {
    fs.writeFileSync(file, buffer);
    console.log(
      `[optimize-images] ${path.relative(publicDir, file)}: ${(before / 1024).toFixed(0)}KB -> ${(buffer.length / 1024).toFixed(0)}KB`,
    );
  }
}

async function main() {
  if (!fs.existsSync(publicDir)) return;
  const files = walk(publicDir);
  for (const file of files) {
    await optimize(file);
  }
}

main().catch((err) => {
  console.error("[optimize-images] Failed:", err);
  process.exit(1);
});
