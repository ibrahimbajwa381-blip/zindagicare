import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@zindagi/shared";

export type StorageNamespace =
  | "doctor-avatars"
  | "testimonial-avatars"
  | "doctor-verification"
  | "nurse-verification"
  | "physiotherapist-verification"
  | "physiotherapist-avatars"
  | "herbalist-avatars"
  | "herbalist-verification"
  | "nutritionist-avatars"
  | "nutritionist-verification"
  | "home-visit-reports"
  | "payment-receipts"
  | "payout-receipts"
  | "prescriptions"
  | "chat-attachments";

type StorageConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

let client: SupabaseClient | null = null;

function getConfig(): StorageConfig {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;

  if (!url || !serviceRoleKey || !bucket) {
    throw new Error(
      "Supabase storage is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET.",
    );
  }

  return { url, serviceRoleKey, bucket };
}

export function isObjectStorageConfigured(): boolean {
  return !!(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_STORAGE_BUCKET
  );
}

function getClient(): SupabaseClient {
  if (!client) {
    const { url, serviceRoleKey } = getConfig();
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function validateStorageKey(storageKey: string): void {
  const normalized = storageKey.replace(/\\/g, "/");
  if (!normalized || normalized.includes("..") || normalized.startsWith("/")) {
    throw new Error("Invalid storage key");
  }
}

export function objectKey(
  namespace: StorageNamespace,
  storageKey: string,
): string {
  validateStorageKey(storageKey);
  return `${namespace}/${storageKey}`;
}

export function contentTypeFromKey(storageKey: string): string {
  const ext = storageKey.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webm":
      return "audio/webm";
    case "m4a":
      return "audio/mp4";
    case "ogg":
      return "audio/ogg";
    case "heic":
      return "image/heic";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

export async function putObject(
  namespace: StorageNamespace,
  storageKey: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { bucket } = getConfig();
  const path = objectKey(namespace, storageKey);

  const { error } = await getClient().storage.from(bucket).upload(path, body, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }
}

const DOWNLOAD_RETRY_ATTEMPTS = 3;
const DOWNLOAD_RETRY_BASE_DELAY_MS = 200;

export async function getObject(
  namespace: StorageNamespace,
  storageKey: string,
): Promise<Buffer> {
  const { bucket } = getConfig();
  const path = objectKey(namespace, storageKey);

  let lastError: unknown;
  for (let attempt = 1; attempt <= DOWNLOAD_RETRY_ATTEMPTS; attempt++) {
    const { data, error } = await getClient().storage.from(bucket).download(path);

    if (data && !error) {
      return Buffer.from(await data.arrayBuffer());
    }

    lastError = error;
    // A missing object won't appear on retry — fail fast instead of stalling the request.
    if (isNotFoundError(error) || attempt === DOWNLOAD_RETRY_ATTEMPTS) {
      break;
    }
    await sleep(DOWNLOAD_RETRY_BASE_DELAY_MS * attempt);
  }

  throw mapStorageError(lastError);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function deleteObject(
  namespace: StorageNamespace,
  storageKey: string,
): Promise<void> {
  const { bucket } = getConfig();
  const path = objectKey(namespace, storageKey);

  const { error } = await getClient().storage.from(bucket).remove([path]);
  if (error) {
    throw new Error(error.message);
  }
}

function mapStorageError(error: unknown): Error {
  if (isNotFoundError(error)) {
    // Every GET route that serves a file (public avatars, private documents,
    // receipts, attachments, ...) funnels a missing-object read through here.
    // A plain Error was previously indistinguishable from an unexpected infra
    // failure by apiError() (which only special-cases AppError/ZodError), so
    // requesting a nonexistent/deleted key returned a raw 500 instead of 404.
    return new AppError("File not found", "NOT_FOUND", 404);
  }
  if (error && typeof error === "object" && "message" in error) {
    return new Error(String((error as { message: string }).message));
  }
  return new Error("Storage request failed");
}

export function isNotFoundError(error: unknown): boolean {
  const err = error as { statusCode?: number | string; message?: string };
  return (
    err?.statusCode === 404 ||
    err?.statusCode === "404" ||
    err?.message === "Object not found" ||
    err?.message === "The resource was not found"
  );
}
