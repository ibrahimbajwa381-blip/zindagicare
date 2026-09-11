import sharp from "sharp";

const MAX_AVATAR_DIMENSION = 800;
const AVATAR_WEBP_QUALITY = 85;

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
 */
export async function compressAvatarImage(buffer: Buffer): Promise<CompressedImage> {
  const compressed = await sharp(buffer)
    .rotate()
    .resize({
      width: MAX_AVATAR_DIMENSION,
      height: MAX_AVATAR_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: AVATAR_WEBP_QUALITY })
    .toBuffer();

  return { buffer: compressed, contentType: "image/webp", ext: ".webp" };
}
