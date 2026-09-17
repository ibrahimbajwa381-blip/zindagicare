/**
 * Compresses oversized raster images under apps/web/public before every build.
 * We serve marketing/avatar images with `unoptimized` on next/image (Vercel's Image
 * Optimization API has a request quota we've hit before — see git history, and Hostinger
 * hosting has no image optimizer at all), so nothing shrinks these automatically at
 * request time. This script is the replacement: it runs on every `npm run build` so a
 * heavy source upload (e.g. an AI-generated PNG saved with a .jpg extension) never ships
 * uncompressed to production.
 *
 * Target: 50KB-150KB per image. Below 50KB is left alone (never enlarged). Above 150KB
 * is pushed down via resize + compression, but 150KB is a soft ceiling — we stop pushing
 * once further reduction would need a quality floor or width floor that visibly hurts the
 * image, and ship the best size we found instead of trashing quality to hit a number.
 * Fixed-dimension assets (app icons, maskable icons) are never resized, since they're
 * consumed at an exact pixel size (manifest.json, apple touch icon, etc.).
 */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const publicDir = path.join(__dirname, "..", "public");

const MIN_KEEP_BYTES = 50 * 1024;
const TARGET_MAX_BYTES = 150 * 1024;
const MEANINGFUL_SAVINGS_RATIO = 0.15; // for images already inside 50-150KB
const MIN_WIDTH_PX = 480; // never resize a photo smaller than this
const MIN_WIDTH_RATIO = 0.4; // ...or below 40% of its original width, whichever is larger
const QUALITY_STEPS = [82, 72, 62, 52, 42]; // floor of 42 keeps images from turning to mush
const WIDTH_SHRINK_STEPS = [1, 0.85, 0.7, 0.55, 0.4]; // multiplied against original width

const FIXED_DIMENSION_RE = /icon-\d+|maskable|favicon|apple-icon/i;
const PALETTE_SAFE_COLOR_LIMIT = 256; // above this, treat as photographic — quantizing banding-prone gradients/skin tones

// PNG palette quantization (256-color indexed mode) is what gets small logos/icons down to
// a few KB, but it visibly bands photographic content (gradients, skin tones, blurred
// backgrounds). Sample a downscaled version cheaply and count roughly-distinct colors to
// decide which encoding path a given PNG gets.
async function isPhotographicPng(image) {
  const { data, info } = await image
    .clone()
    .resize(64, 64, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colors = new Set();
  for (let i = 0; i + info.channels <= data.length; i += info.channels) {
    // Bucket into ~32 levels per channel so anti-aliased near-duplicates collapse together.
    const key = (data[i] >> 3) << 10 | (data[i + 1] >> 3) << 5 | (data[i + 2] >> 3);
    colors.add(key);
    if (colors.size > PALETTE_SAFE_COLOR_LIMIT) return true;
  }
  return false;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function encodeAt(image, ext, width, quality, pngUsePalette) {
  const pipeline = width ? image.clone().resize({ width, withoutEnlargement: true }) : image.clone();
  if (ext === ".png") {
    return pngUsePalette
      ? pipeline.png({ quality, palette: true, effort: 8 }).toBuffer()
      : pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer();
  }
  if (ext === ".webp") {
    return pipeline.webp({ quality }).toBuffer();
  }
  return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
}

function buildWidthSteps(originalWidth, isFixedDimension) {
  if (isFixedDimension || !originalWidth) return [null]; // null = keep original dimensions
  const minWidth = Math.max(MIN_WIDTH_PX, Math.round(originalWidth * MIN_WIDTH_RATIO));
  const widths = WIDTH_SHRINK_STEPS.map((ratio) => Math.round(originalWidth * ratio)).filter(
    (w) => w >= minWidth,
  );
  // First entry is "no resize"; represent that as null so encodeAt skips .resize().
  widths[0] = null;
  return widths.length ? widths : [null];
}

const FORMAT_TO_EXT = { jpeg: ".jpg", png: ".png", webp: ".webp" };

async function optimize(file) {
  const before = fs.statSync(file).size;
  if (before <= MIN_KEEP_BYTES) return; // already small enough — never touch, never enlarge

  const isFixedDimension = FIXED_DIMENSION_RE.test(path.basename(file));

  let image;
  let meta;
  try {
    image = sharp(file);
    meta = await image.metadata();
  } catch (err) {
    console.warn(`[optimize-images] Skipping ${path.relative(publicDir, file)}: ${err.message}`);
    return;
  }

  // Compress by the file's real decoded format, not its extension — some assets in this repo
  // are e.g. JPEG bytes saved with a .png extension, and encoding those as lossless PNG only
  // ever inflates them. The output keeps its original filename either way.
  const ext = FORMAT_TO_EXT[meta.format];
  if (!ext) {
    console.warn(
      `[optimize-images] Skipping ${path.relative(publicDir, file)}: unsupported real format "${meta.format}"`,
    );
    return;
  }

  const widthSteps = buildWidthSteps(meta.width, isFixedDimension);

  // Photographic PNGs (headshots, screenshots) get badly banded by palette quantization —
  // fall back to lossless recompression for those and let resizing do the size work instead.
  const pngUsePalette = ext === ".png" ? !(await isPhotographicPng(image)) : false;
  const qualitySteps = ext === ".png" && !pngUsePalette ? [null] : QUALITY_STEPS;

  let best = null; // smallest buffer found so far, regardless of whether it hit the target

  outer: for (const width of widthSteps) {
    for (const quality of qualitySteps) {
      let buffer;
      try {
        buffer = await encodeAt(image, ext, width, quality, pngUsePalette);
      } catch (err) {
        console.warn(`[optimize-images] ${path.relative(publicDir, file)}: encode failed (${err.message})`);
        continue;
      }
      if (buffer.length >= before) continue; // never produce something bigger than the source
      if (!best || buffer.length < best.length) best = buffer;
      if (buffer.length <= TARGET_MAX_BYTES) break outer; // good enough — stop degrading further
    }
  }

  if (!best) return; // nothing beat the original without exceeding it

  if (before <= TARGET_MAX_BYTES) {
    // Already in (or under) the target range: only replace for a clear, safe win.
    if (best.length <= before * (1 - MEANINGFUL_SAVINGS_RATIO)) {
      fs.writeFileSync(file, best);
      log(file, before, best.length);
    }
    return;
  }

  // Original exceeded the target: take the best we found even if it's still above 150KB —
  // that beats visibly degrading the image just to cross a size line.
  fs.writeFileSync(file, best);
  log(file, before, best.length);
}

function log(file, before, after) {
  const suffix = after > TARGET_MAX_BYTES ? " (above 150KB target, kept for quality)" : "";
  console.log(
    `[optimize-images] ${path.relative(publicDir, file)}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB${suffix}`,
  );
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
