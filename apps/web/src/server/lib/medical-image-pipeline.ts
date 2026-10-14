import sharp from "sharp";
import { AppError } from "@zindagi/shared";

/**
 * Image pipeline for medical Q&A attachments (prescriptions, reports,
 * medicine labels, symptom photos).
 *
 * Every upload is identified by its bytes (never filename / declared MIME),
 * bounded by size and decoded dimensions, decoded by sharp, orientation-
 * corrected, stripped of all metadata (EXIF/GPS/ICC/XMP) and re-encoded to
 * WebP. Re-encoding also discards anything appended to or embedded in the
 * original file (polyglots). It is a defence layer, not a malware scanner.
 *
 * Compression walks a fixed ladder of (long-edge, quality) pairs that never
 * goes below `minReadableEdge` or `minQuality`, so dosage lines and report
 * values stay legible. It stops at the first result within `targetBytes`;
 * if none reaches it, the smallest still-readable result is kept as long as
 * it is within the hard `maxProcessedBytes` limit — otherwise the upload is
 * refused rather than degraded further or stored oversized.
 */
export const MEDICAL_IMAGE_LIMITS = {
  /** Original upload ceiling (bytes). The hosting platform may impose a lower request limit. */
  maxOriginalBytes: 10 * 1024 * 1024,
  /** Hard ceiling for what is stored: nothing above 150 KB is ever kept. */
  maxProcessedBytes: 150 * 1024,
  /** Normal output target; a dense document may land between this and the hard ceiling. */
  targetBytes: 120 * 1024,
  /** ~40 MP: above any phone camera; larger is treated as a decompression bomb. */
  maxInputPixels: 40_000_000,
  maxInputEdge: 12_000,
  /** Longest edge of the stored image. */
  maxOutputEdge: 2000,
  /** Never shrink the longest edge below this for compression's sake (text legibility). */
  minReadableEdge: 1600,
  /** Quality ladder, best first; never below `minQuality`. */
  qualities: [82, 74, 66, 60],
  minQuality: 60,
  maxConcurrentJobs: 2,
} as const;

export type ImageFormat = "jpeg" | "png" | "webp";

export type ProcessedMedicalImage = {
  buffer: Buffer;
  contentType: "image/webp";
  bytes: number;
  width: number;
  height: number;
  quality: number;
  originalBytes: number;
  sourceFormat: ImageFormat;
};

type PipelineOptions = Partial<Pick<typeof MEDICAL_IMAGE_LIMITS, "maxProcessedBytes" | "targetBytes">>;

/** Identifies an allowed raster format from its magic bytes; null for anything else. */
export function sniffImageFormat(buf: Buffer): ImageFormat | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return "png";
  }
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    return "webp";
  }
  return null;
}

export function assertProcessedSize(bytes: number, max: number = MEDICAL_IMAGE_LIMITS.maxProcessedBytes): void {
  if (bytes > max) {
    throw new AppError(
      "This photo is too detailed to store at a readable quality. Please crop it to the important part and try again.",
      "IMAGE_NOT_COMPRESSIBLE",
      400,
    );
  }
}

/** Minimal FIFO semaphore bounding concurrent CPU/memory-heavy work in this process. */
export function createSemaphore(max: number) {
  let active = 0;
  const waiting: Array<() => void> = [];

  async function acquire() {
    if (active < max) {
      active += 1;
      return;
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
  }

  function release() {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  }

  return {
    async run<T>(job: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await job();
      } finally {
        release();
      }
    },
  };
}

const jobs = createSemaphore(MEDICAL_IMAGE_LIMITS.maxConcurrentJobs);

const invalidImage = () =>
  new AppError("This file is not a readable image. Please upload a clear JPG, PNG or WebP photo.", "INVALID_IMAGE", 400);

export async function processMedicalImage(
  input: Buffer,
  options: PipelineOptions = {},
): Promise<ProcessedMedicalImage> {
  const limits = { ...MEDICAL_IMAGE_LIMITS, ...options };

  if (input.length === 0) throw invalidImage();
  if (input.length > limits.maxOriginalBytes) {
    throw new AppError("Photo must be 10 MB or smaller", "IMAGE_TOO_LARGE", 413);
  }

  const sourceFormat = sniffImageFormat(input);
  if (!sourceFormat) {
    throw new AppError("Only JPG, PNG or WebP photos are allowed", "UNSUPPORTED_IMAGE_TYPE", 400);
  }

  return jobs.run(async () => {
    // Header-only read: dimensions are checked before any pixel is decoded.
    let meta: sharp.Metadata;
    try {
      meta = await sharp(input, { limitInputPixels: false }).metadata();
    } catch {
      throw invalidImage();
    }
    if (meta.format !== sourceFormat || !meta.width || !meta.height) throw invalidImage();
    if (
      meta.width > limits.maxInputEdge ||
      meta.height > limits.maxInputEdge ||
      meta.width * meta.height > limits.maxInputPixels
    ) {
      throw new AppError("Photo dimensions are too large", "IMAGE_DIMENSIONS_TOO_LARGE", 400);
    }

    let decoded: { data: Buffer; info: sharp.OutputInfo };
    try {
      // Decode once (orientation applied, first frame only) to raw pixels; each
      // ladder step re-encodes from this instead of re-decoding the original.
      decoded = await sharp(input, { limitInputPixels: limits.maxInputPixels, failOn: "warning" })
        .rotate()
        .resize({
          width: limits.maxOutputEdge,
          height: limits.maxOutputEdge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw invalidImage();
    }

    const { width, height, channels } = decoded.info;
    const longEdge = Math.max(width, height);
    const edges = longEdge > limits.minReadableEdge ? [longEdge, limits.minReadableEdge] : [longEdge];

    let smallest: ProcessedMedicalImage | null = null;
    for (const edge of edges) {
      for (const quality of limits.qualities) {
        const pipeline = sharp(decoded.data, { raw: { width, height, channels } });
        if (edge < longEdge) pipeline.resize({ width: edge, height: edge, fit: "inside" });
        const { data, info } = await pipeline
          .webp({ quality, effort: 4 })
          .toBuffer({ resolveWithObject: true });

        const candidate: ProcessedMedicalImage = {
          buffer: data,
          contentType: "image/webp",
          bytes: data.length,
          width: info.width,
          height: info.height,
          quality,
          originalBytes: input.length,
          sourceFormat,
        };
        if (candidate.bytes <= limits.targetBytes) return candidate;
        if (!smallest || candidate.bytes < smallest.bytes) smallest = candidate;
      }
    }

    assertProcessedSize(smallest!.bytes, limits.maxProcessedBytes);
    return smallest!;
  });
}
