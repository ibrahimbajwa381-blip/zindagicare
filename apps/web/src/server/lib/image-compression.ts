import sharp from "sharp";
import { AppError } from "@zindagi/shared";

const MAX_AVATAR_DIMENSION = 800;
const AVATAR_WEBP_QUALITY = 80;
/** ~50 MP covers any phone camera; anything larger is treated as a decompression bomb. */
const MAX_INPUT_PIXELS = 50_000_000;

export type CompressedImage = {
  buffer: Buffer;
  contentType: string;
  ext: string;
};

/**
 * Re-encodes an uploaded profile photo to WebP, capped at MAX_AVATAR_DIMENSION
 * on the longest edge. Mirrors the compression already applied to apps/web/public
 * marketing images (scripts/optimize-images.cjs) so avatars don't ship as raw
 * multi-MB camera photos to the app.
 *
 * - `rotate()` bakes in the EXIF orientation so phone portraits aren't sideways.
 * - Output is sRGB with all metadata (EXIF GPS, camera serials) stripped — sharp's
 *   default when `withMetadata()` is not called — so no location leaks from selfies.
 * - `effort: 6` + `smartSubsample` trade a little CPU for noticeably smaller files
 *   on a one-off upload; animated inputs are flattened to their first frame.
 */
export async function compressAvatarImage(buffer: Buffer): Promise<CompressedImage> {
  if (buffer.length === 0) {
    throw new AppError("Photo file is empty", "VALIDATION_ERROR", 400);
  }

  let compressed: Buffer;
  try {
    compressed = await sharp(buffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
      // Phone JPEGs are occasionally slightly truncated; only reject truly broken files.
      failOn: "error",
    })
      .rotate()
      .resize({
        width: MAX_AVATAR_DIMENSION,
        height: MAX_AVATAR_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: AVATAR_WEBP_QUALITY, effort: 6, smartSubsample: true })
      .toBuffer();
  } catch {
    // sharp throws a plain Error on empty/corrupt/non-image bytes even when the
    // declared MIME type passed the ALLOWED_TYPES check — surface that as a
    // controlled validation failure instead of an unhandled 500.
    throw new AppError("Photo file is not a valid image", "VALIDATION_ERROR", 400);
  }

  return { buffer: compressed, contentType: "image/webp", ext: ".webp" };
}
