import sharp from "sharp";
import { randomBytes } from "crypto";

/** Tiny (2x2) but genuinely valid, decodable images — real magic bytes, real encoded pixels. */
export async function makeValidJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 200, g: 50, b: 50 } } })
    .jpeg()
    .toBuffer();
}

export async function makeValidPng(): Promise<Buffer> {
  return sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 50, g: 200, b: 50 } } })
    .png()
    .toBuffer();
}

export async function makeValidWebp(): Promise<Buffer> {
  return sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 50, g: 50, b: 200 } } })
    .webp()
    .toBuffer();
}

/** A minimal but structurally valid single-page PDF (correct header/xref/trailer). */
export function makeValidPdf(): Buffer {
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
190
%%EOF`;
  return Buffer.from(pdf, "utf-8");
}

export function makeGarbageBytes(size = 2048): Buffer {
  return randomBytes(size);
}

export function makeTruncatedPdf(): Buffer {
  return makeValidPdf().subarray(0, 20); // header only, no body/xref/trailer
}

export async function makeTruncatedImage(): Promise<Buffer> {
  const full = await makeValidJpeg();
  return full.subarray(0, Math.floor(full.length / 3)); // real magic bytes, corrupt body
}

export function makeOversizedBuffer(bytes: number): Buffer {
  return Buffer.alloc(bytes, 0x41);
}

/** Wraps a Buffer as a web File (available globally in the Node test runtime here). */
export function toFile(buffer: Buffer, name: string, type: string): File {
  return new File([new Uint8Array(buffer)], name, { type });
}
