import { AppError } from "@zindagi/shared";
import { randomUUID } from "crypto";
import { wrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import {
  deleteObject,
  getObject,
  putObject,
  type StorageNamespace,
} from "@/server/lib/object-storage";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export type StoredRoleDocument = {
  storageKey: string;
  url: string;
  originalName: string;
  mimeType: string;
};

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

/**
 * Shared implementation behind each role's `*-documents.storage.ts` — identical logic across
 * roles, differing only in the object-storage namespace and its verification-documents URL segment.
 */
export function createRoleDocumentStorage(namespace: StorageNamespace, urlSegment: string) {
  const urlPrefix = `/api/v1/${urlSegment}/verification/documents/`;

  async function save(userId: string, file: File): Promise<StoredRoleDocument> {
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

    await putObject(namespace, storageKey, buffer, file.type);

    return {
      storageKey,
      url: `${urlPrefix}${encodeURIComponent(storageKey)}`,
      originalName: file.name,
      mimeType: file.type,
    };
  }

  async function read(storageKey: string): Promise<Buffer> {
    return getObject(namespace, storageKey);
  }

  function storageKeyFromUrl(url: string): string | null {
    try {
      const pathname = new URL(url, "http://local").pathname;
      if (!pathname.startsWith(urlPrefix)) return null;
      return decodeURIComponent(pathname.slice(urlPrefix.length));
    } catch {
      return null;
    }
  }

  async function remove(storageKey: string): Promise<void> {
    await deleteObject(namespace, storageKey);
  }

  /** Owner or admin may view a stored verification document. */
  function canAccess(userId: string, roles: string[], storageKey: string): boolean {
    if (roles.includes("admin") || roles.includes("super_admin")) return true;
    return storageKey.startsWith(`${userId}/`);
  }

  return { save, read, storageKeyFromUrl, remove, canAccess };
}
