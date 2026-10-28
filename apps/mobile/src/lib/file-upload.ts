import { File, UploadType } from "expo-file-system";
import { ApiRequestError } from "@/api/client";

/**
 * Uploads a local file (from image-picker, document-picker, or a recorded voice note) as
 * multipart/form-data using expo-file-system's native uploader.
 *
 * We can't build this with fetch()/FormData() in JS: Expo SDK 57's FormData no longer accepts
 * the old React Native `{ uri, name, type }` shape ("Unsupported FormDataPart implementation"),
 * and React Native's own `Blob` constructor explicitly refuses ArrayBuffer/ArrayBufferView parts
 * ("Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported"). Native multipart
 * upload sidesteps both by encoding the body outside the JS FormData/Blob machinery entirely.
 */
/** Covers the server's 30s storage timeout plus transfer time on a slow mobile link. */
export const UPLOAD_TIMEOUT_MS = 60_000;

export class UploadTimeoutError extends Error {
  constructor() {
    super("Upload took too long. Check your connection and try again.");
    this.name = "UploadTimeoutError";
  }
}

export async function uploadFileMultipart<T>(
  url: string,
  fileUri: string,
  options: {
    mimeType: string;
    fieldName?: string;
    parameters?: Record<string, string>;
    accessToken?: string | null;
    timeoutMs?: number;
  },
): Promise<{ status: number; json: T }> {
  const file = new File(fileUri);
  // Aborting cancels the transfer on the device; the server may already have the file.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? UPLOAD_TIMEOUT_MS);
  let result: Awaited<ReturnType<File["upload"]>>;
  try {
    result = await file.upload(url, {
      httpMethod: "POST",
      uploadType: UploadType.MULTIPART,
      fieldName: options.fieldName ?? "file",
      mimeType: options.mimeType,
      parameters: options.parameters,
      headers: options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new UploadTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
  }
  try {
    return { status: result.status, json: JSON.parse(result.body) as T };
  } catch {
    // Proxies/hosts can answer with HTML (e.g. 413 body too large, 502); don't surface a JSON SyntaxError.
    // Carry the status so callers can tell a non-retryable 413 from a retryable 502.
    throw new ApiRequestError(`Upload failed (HTTP ${result.status})`, "HTTP_ERROR", result.status);
  }
}
