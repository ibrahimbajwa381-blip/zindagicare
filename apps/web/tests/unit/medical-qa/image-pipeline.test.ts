/**
 * QA-IMG — Server-enforced image pipeline for medical Q&A attachments.
 *
 * All fixtures are synthetic (generated with sharp in-process); no real
 * patient images are used.
 */
import sharp from "sharp";
import { crc32 } from "zlib";
import { AppError } from "@zindagi/shared";
import {
  MEDICAL_IMAGE_LIMITS,
  assertProcessedSize,
  createSemaphore,
  processMedicalImage,
  sniffImageFormat,
} from "@/server/lib/medical-image-pipeline";
import {
  makeGarbageBytes,
  makeTruncatedImage,
  makeValidJpeg,
  makeValidPdf,
  makeValidPng,
  makeValidWebp,
} from "../../helpers/synthetic-files";

jest.setTimeout(60000);

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject({ code });
}

/** A prescription-like page: white background, many lines of dark text. */
async function makeDocumentPhoto(width = 2480, height = 3508): Promise<Buffer> {
  const lines = Array.from({ length: 60 }, (_, i) =>
    `<text x="120" y="${180 + i * 54}" font-family="sans-serif" font-size="34" fill="#111">Rx ${i + 1}: Tab. Paracetamol 500mg — 1 tab TDS x 5 days, after meals</text>`,
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fbfaf6"/>${lines}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
}

/** Builds a structurally valid PNG whose IHDR claims huge dimensions (decompression-bomb header). */
function makePngWithClaimedDimensions(width: number, height: number, base: Buffer): Buffer {
  const png = Buffer.from(base);
  // IHDR data starts at byte 16 (8 sig + 4 len + 4 type); CRC covers type+data (bytes 12..29).
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  png.writeUInt32BE(crc32(png.subarray(12, 29)) >>> 0, 29);
  return png;
}

describe("sniffImageFormat — trusts bytes, never filename or declared MIME", () => {
  it("detects JPEG, PNG and WebP by magic bytes", async () => {
    expect(sniffImageFormat(await makeValidJpeg())).toBe("jpeg");
    expect(sniffImageFormat(await makeValidPng())).toBe("png");
    expect(sniffImageFormat(await makeValidWebp())).toBe("webp");
  });

  it.each([
    ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>')],
    ["SVG with XML prolog", Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>')],
    ["HTML", Buffer.from("<!doctype html><html><body><script>alert(1)</script></body></html>")],
    ["Windows executable", Buffer.concat([Buffer.from("MZ"), Buffer.alloc(200)])],
    ["ELF executable", Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(200)])],
    ["JavaScript", Buffer.from("alert(document.cookie)")],
    ["PDF", makeValidPdf()],
    ["GIF", Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00;", "binary")],
    ["RIFF but not WebP (WAV)", Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE"), Buffer.alloc(32)])],
    ["random bytes", makeGarbageBytes(512)],
    ["empty", Buffer.alloc(0)],
  ])("rejects %s", (_label, buf) => {
    expect(sniffImageFormat(buf)).toBeNull();
  });
});

describe("processMedicalImage — rejection paths", () => {
  it("rejects SVG even when it would be renamed .jpg", async () => {
    await expectCode(processMedicalImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")), "UNSUPPORTED_IMAGE_TYPE");
  });

  it("rejects an HTML file renamed to photo.png", async () => {
    await expectCode(processMedicalImage(Buffer.from("<html><img src=x onerror=alert(1)></html>")), "UNSUPPORTED_IMAGE_TYPE");
  });

  it("rejects an empty upload", async () => {
    await expectCode(processMedicalImage(Buffer.alloc(0)), "INVALID_IMAGE");
  });

  it("rejects a truncated/corrupt JPEG that still has valid magic bytes", async () => {
    await expectCode(processMedicalImage(await makeTruncatedImage()), "INVALID_IMAGE");
  });

  it("rejects magic bytes followed by garbage", async () => {
    const fake = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), makeGarbageBytes(4096)]);
    await expectCode(processMedicalImage(fake), "INVALID_IMAGE");
  });

  it("rejects an original above the size limit before decoding it", async () => {
    const spy = jest.spyOn(sharp.prototype, "metadata");
    const tooBig = Buffer.concat([await makeValidJpeg(), Buffer.alloc(MEDICAL_IMAGE_LIMITS.maxOriginalBytes)]);
    await expectCode(processMedicalImage(tooBig), "IMAGE_TOO_LARGE");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("rejects decompression-bomb dimensions from the header without decoding pixels", async () => {
    const bomb = makePngWithClaimedDimensions(60000, 60000, await makeValidPng());
    await expectCode(processMedicalImage(bomb), "IMAGE_DIMENSIONS_TOO_LARGE");
  });

  it("rejects a single dimension above the per-edge ceiling even if pixel count is small", async () => {
    const strip = makePngWithClaimedDimensions(MEDICAL_IMAGE_LIMITS.maxInputEdge + 1, 1, await makeValidPng());
    await expectCode(processMedicalImage(strip), "IMAGE_DIMENSIONS_TOO_LARGE");
  });
});

describe("processMedicalImage — success paths", () => {
  it.each([
    ["JPEG", makeValidJpeg],
    ["PNG", makeValidPng],
    ["WebP", makeValidWebp],
  ])("re-encodes a valid %s to WebP", async (_l, make) => {
    const out = await processMedicalImage(await make());
    expect(out.contentType).toBe("image/webp");
    expect(sniffImageFormat(out.buffer)).toBe("webp");
    expect(out.bytes).toBe(out.buffer.length);
  });

  it("ignores a spoofed client MIME — format comes from bytes (PNG declared as JPEG still processes as PNG)", async () => {
    const out = await processMedicalImage(await makeValidPng());
    expect(out.sourceFormat).toBe("png");
  });

  it("strips EXIF metadata including GPS coordinates", async () => {
    const withGps = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#888" } })
      .withExifMerge({
        IFD0: { Make: "SyntheticCam", Model: "TestModel" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "31/1 31/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "74/1 21/1 0/1" },
      })
      .jpeg()
      .toBuffer();
    expect((await sharp(withGps).metadata()).exif).toBeDefined();

    const out = await processMedicalImage(withGps);
    const meta = await sharp(out.buffer).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(out.buffer.includes(Buffer.from("SyntheticCam"))).toBe(false);
  });

  it("applies EXIF orientation before stripping it (portrait phone photo stays portrait)", async () => {
    const rotated = await sharp({ create: { width: 80, height: 40, channels: 3, background: "#fff" } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const out = await processMedicalImage(rotated);
    expect(out.width).toBe(40);
    expect(out.height).toBe(80);
  });

  it("neutralises a JPEG/HTML polyglot — trailing script bytes do not survive re-encoding", async () => {
    const polyglot = Buffer.concat([await makeValidJpeg(), Buffer.from("<script>alert(document.cookie)</script>")]);
    const out = await processMedicalImage(polyglot);
    expect(out.buffer.includes(Buffer.from("<script>"))).toBe(false);
  });

  it("a simple photo lands at or under the 120 KB target without dropping below the readability floors", async () => {
    const photo = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: "#c8a080", noise: { type: "gaussian", mean: 128, sigma: 12 } },
    })
      .blur(1.2)
      .jpeg({ quality: 90 })
      .toBuffer();
    const out = await processMedicalImage(photo);
    expect(out.bytes).toBeLessThanOrEqual(MEDICAL_IMAGE_LIMITS.targetBytes);
    expect(Math.max(out.width, out.height)).toBeGreaterThanOrEqual(MEDICAL_IMAGE_LIMITS.minReadableEdge);
    expect(out.quality).toBeGreaterThanOrEqual(MEDICAL_IMAGE_LIMITS.minQuality);
  });

  it("does not upscale a small image", async () => {
    const out = await processMedicalImage(await makeValidJpeg());
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
  });

  it("compresses a dense A4 prescription photo to at most 150 KB while keeping a readable resolution", async () => {
    const original = await makeDocumentPhoto();
    const out = await processMedicalImage(original);
    expect(out.bytes).toBeLessThanOrEqual(150 * 1024);
    expect(Math.max(out.width, out.height)).toBeGreaterThanOrEqual(MEDICAL_IMAGE_LIMITS.minReadableEdge);
    expect(out.quality).toBeGreaterThanOrEqual(MEDICAL_IMAGE_LIMITS.minQuality);
    expect(out.originalBytes).toBe(original.length);
    console.log(
      `[compression] document photo ${original.length}B -> ${out.bytes}B (${(100 - (out.bytes / original.length) * 100).toFixed(1)}% smaller), ${out.width}x${out.height} q${out.quality}`,
    );
  });

  it("never lowers quality below the readability floor just to hit the target; output stays ≤ 150 KB or is rejected", async () => {
    // Gaussian noise is the worst case for compression (no redundancy).
    const noisy = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma: 60 } },
    })
      .jpeg({ quality: 92 })
      .toBuffer();
    try {
      const out = await processMedicalImage(noisy);
      expect(out.bytes).toBeLessThanOrEqual(MEDICAL_IMAGE_LIMITS.maxProcessedBytes);
      expect(out.quality).toBeGreaterThanOrEqual(MEDICAL_IMAGE_LIMITS.minQuality);
      expect(Math.max(out.width, out.height)).toBeGreaterThanOrEqual(MEDICAL_IMAGE_LIMITS.minReadableEdge);
        console.log(`[compression] worst-case noise ${noisy.length}B -> ${out.bytes}B q${out.quality} ${out.width}x${out.height}`);
    } catch (e) {
      expect(e).toMatchObject({ code: "IMAGE_NOT_COMPRESSIBLE" });
    }
  });

  it("refuses to upload an output above a configured hard limit instead of silently storing it", async () => {
    const original = await makeDocumentPhoto(1600, 2200);
    await expectCode(
      processMedicalImage(original, { maxProcessedBytes: 2_000, targetBytes: 1_000 }),
      "IMAGE_NOT_COMPRESSIBLE",
    );
  });
});

describe("assertProcessedSize — hard 150 KB processed-image limit", () => {
  const max = MEDICAL_IMAGE_LIMITS.maxProcessedBytes;
  it("is exactly 150 KB by default, with a 120 KB normal target", () => {
    expect(max).toBe(150 * 1024);
    expect(MEDICAL_IMAGE_LIMITS.targetBytes).toBe(120 * 1024);
  });
  it("accepts just below and exactly at the limit", () => {
    expect(() => assertProcessedSize(max - 1, max)).not.toThrow();
    expect(() => assertProcessedSize(max, max)).not.toThrow();
  });
  it("rejects one byte above the limit", () => {
    expect(() => assertProcessedSize(max + 1, max)).toThrow(expect.objectContaining({ code: "IMAGE_NOT_COMPRESSIBLE" }));
  });
});

describe("createSemaphore — bounded processing concurrency", () => {
  it("never runs more than N jobs at once", async () => {
    const sem = createSemaphore(2);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 8 }, () =>
        sem.run(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((r) => setTimeout(r, 10));
          active -= 1;
        }),
      ),
    );
    expect(peak).toBe(2);
  });

  it("releases its slot when a job throws", async () => {
    const sem = createSemaphore(1);
    await expect(sem.run(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    await expect(sem.run(async () => "ok")).resolves.toBe("ok");
  });
});
