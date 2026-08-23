import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type StorageNamespace =
  | "doctor-avatars"
  | "doctor-verification"
  | "nurse-verification"
  | "physiotherapist-verification"
  | "home-visit-reports"
  | "payment-receipts"
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

export async function getObject(
  namespace: StorageNamespace,
  storageKey: string,
): Promise<Buffer> {
  const { bucket } = getConfig();
  const path = objectKey(namespace, storageKey);

  const { data, error } = await getClient().storage.from(bucket).download(path);

  if (error || !data) {
    throw mapStorageError(error);
  }

  return Buffer.from(await data.arrayBuffer());
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
    return new Error("File not found");
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
