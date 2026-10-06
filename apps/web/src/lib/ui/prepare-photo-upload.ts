/**
 * Shrinks a camera photo in the browser before upload so multi-MB phone shots fit
 * under the avatar upload limit (3 MB) and Vercel's 4.5 MB request cap. This is
 * only a transport step — the server still re-encodes to optimized WebP with sharp.
 * Any browser failure falls back to the original file and lets the server decide.
 */
const PASSTHROUGH_MAX_BYTES = 1.5 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.9;

export async function preparePhotoUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= PASSTHROUGH_MAX_BYTES) {
    return file;
  }
  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap | undefined;
  try {
    // "from-image" applies EXIF orientation so portraits stay upright once EXIF is dropped.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
