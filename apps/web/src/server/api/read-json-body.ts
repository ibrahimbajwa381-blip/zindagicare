import { AppError } from "@zindagi/shared";
import type { ZodType } from "zod";

const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const tooLarge =(message: string) => new AppError(message, "PAYLOAD_TOO_LARGE", 413);

/**
 * Buffers a request body with a hard byte ceiling enforced while streaming
 * (Content-Length can be absent or wrong), so an oversized payload is
 * rejected as soon as it crosses the limit instead of being read in full.
 */
export async function readBodyBytes(req: Request, maxBytes: number, message = "Request body is too large"): Promise<Buffer> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge(message);

  const chunks: Uint8Array[] = [];
  let total = 0;
  if (req.body) {
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw tooLarge(message);
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks);
}

/**
 * Reads and validates a JSON body with a size cap. withApiHandler's
 * `bodySchema` has no size limit; routes that accept user-written text use
 * this instead.
 */
export async function readJsonBody<T>(req: Request, schema: ZodType<T>, maxBytes: number): Promise<T> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(contentType)) {
    throw new AppError("Content-Type must be application/json", "UNSUPPORTED_MEDIA_TYPE", 415);
  }

  const bytes = await readBodyBytes(req, maxBytes);
  let json: unknown;
  let pollutionKey = false;
  try {
    json = JSON.parse(bytes.toString("utf8"), (key, value) => {
      if (PROTOTYPE_KEYS.has(key)) pollutionKey = true;
      return value;
    });
  } catch {
    throw new AppError("Malformed JSON body", "VALIDATION_ERROR", 400);
  }
  // Zod silently drops `__proto__` instead of flagging it as unknown; refuse
  // prototype-pollution shaped payloads outright.
  if (pollutionKey) {
    throw new AppError("Invalid request body", "VALIDATION_ERROR", 400);
  }
  return schema.parse(json);
}
