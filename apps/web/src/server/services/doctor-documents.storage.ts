import { AppError } from "@zindagi/shared";
import { randomUUID } from "crypto";
import { wrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import {
  deleteObject,
  getObject,
  putObject,
  type StorageNamespace,
} from "@/server/lib/object-storage";

const NAMESPACE: StorageNamespace = "doctor-verification";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export type StoredDocument = {
  storageKey: string;
  url: string;
  originalName: string;
  mimeType: string;
};

export async function saveDoctorDocument(
  userId: string,
  file: File,
): Promise<StoredDocument> {
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
    url: `/api/v1/doctor/verification/documents/${encodeURIComponent(storageKey)}`,
    originalName: file.name,
    mimeType: file.type,
  };
}

export async function readDoctorDocument(storageKey: string): Promise<Buffer> {
  return getObject(NAMESPACE, storageKey);
}

const DOCUMENT_URL_PREFIX = "/api/v1/doctor/verification/documents/";

export function doctorDocumentStorageKeyFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url, "http://local").pathname;
    if (!pathname.startsWith(DOCUMENT_URL_PREFIX)) return null;
    return decodeURIComponent(pathname.slice(DOCUMENT_URL_PREFIX.length));
  } catch {
    return null;
  }
}

export async function deleteDoctorDocument(storageKey: string): Promise<void> {
  await deleteObject(NAMESPACE, storageKey);
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
