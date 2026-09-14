import { AppError } from "@zindagi/shared";
import { randomUUID } from "crypto";
import { wrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import {
  deleteObject,
  getObject,
  putObject,
  type StorageNamespace,
} from "@/server/lib/object-storage";

const NAMESPACE: StorageNamespace = "nurse-verification";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export type StoredNurseDocument = {
  storageKey: string;
  url: string;
  originalName: string;
  mimeType: string;
};

export async function saveNurseDocument(
  userId: string,
  file: File,
): Promise<StoredNurseDocument> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new AppError("Only JPG, PNG, WebP, or PDF files are allowed", "VALIDATION_ERROR", 400);
  }
  if (file.size > MAX_BYTES) {
    throw new AppError("File must be 5 MB or smaller", "VALIDATION_ERROR", 400);
  }
  if (file.size === 0) {
    throw new AppError("File is empty", "VALIDATION_ERROR", 400);
  }

  const ext = mimeToExt(file.type);
  const storageKey = `${userId}/${randomUUID()}${ext}`;
  const buffer = wrapEncryptedFile(Buffer.from(await file.arrayBuffer()));

  await putObject(NAMESPACE, storageKey, buffer, file.type);

  return {
    storageKey,
    url: `/api/v1/nurse/verification/documents/${encodeURIComponent(storageKey)}`,
    originalName: file.name,
    mimeType: file.type,
  };
}

export async function readNurseDocument(storageKey: string): Promise<Buffer> {
  return getObject(NAMESPACE, storageKey);
}

const DOCUMENT_URL_PREFIX = "/api/v1/nurse/verification/documents/";

export function nurseDocumentStorageKeyFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url, "http://local").pathname;
    if (!pathname.startsWith(DOCUMENT_URL_PREFIX)) return null;
    return decodeURIComponent(pathname.slice(DOCUMENT_URL_PREFIX.length));
  } catch {
    return null;
  }
}

export async function deleteNurseDocument(storageKey: string): Promise<void> {
  await deleteObject(NAMESPACE, storageKey);
}

/** Owner nurse or admin may view a stored verification document. */
export function canAccessNurseDocument(
  userId: string,
  roles: string[],
  storageKey: string,
): boolean {
  if (roles.includes("admin") || roles.includes("super_admin")) return true;
  return storageKey.startsWith(`${userId}/`);
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
