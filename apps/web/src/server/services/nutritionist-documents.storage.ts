import path from "path";
import { randomUUID } from "crypto";
import { wrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import {
  getObject,
  putObject,
  type StorageNamespace,
} from "@/server/lib/object-storage";

const NAMESPACE: StorageNamespace = "nutritionist-verification";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export type StoredNutritionistDocument = {
  storageKey: string;
  url: string;
  originalName: string;
  mimeType: string;
};

export async function saveNutritionistDocument(
  userId: string,
  file: File,
): Promise<StoredNutritionistDocument> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Only JPG, PNG, WebP, or PDF files are allowed");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("File must be 5 MB or smaller");
  }

  const ext = path.extname(file.name) || mimeToExt(file.type);
  const storageKey = `${userId}/${randomUUID()}${ext}`;
  const buffer = wrapEncryptedFile(Buffer.from(await file.arrayBuffer()));

  await putObject(NAMESPACE, storageKey, buffer, file.type);

  return {
    storageKey,
    url: `/api/v1/nutritionist/verification/documents/${encodeURIComponent(storageKey)}`,
    originalName: file.name,
    mimeType: file.type,
  };
}

export async function readNutritionistDocument(storageKey: string): Promise<Buffer> {
  return getObject(NAMESPACE, storageKey);
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    default:
      return "";
  }
}
