import { AppError } from "@zindagi/shared";
import { randomUUID } from "crypto";
import {
  deleteObject,
  getObject,
  putObject,
  type StorageNamespace,
} from "@/server/lib/object-storage";
import { compressAvatarImage } from "@/server/lib/image-compression";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type StoredRoleAvatar = {
  storageKey: string;
  url: string;
  originalName: string;
  mimeType: string;
};

/**
 * Shared implementation behind each role's `*-avatar.storage.ts` — identical logic across
 * roles, differing only in the object-storage namespace and its matching public URL segment.
 */
export function createRoleAvatarStorage(namespace: StorageNamespace) {
  const urlPrefix = `/api/v1/public/${namespace}/`;

  function publicUrl(storageKey: string): string {
    const segments = storageKey.split("/").map((segment) => encodeURIComponent(segment));
    return `${urlPrefix}${segments.join("/")}`;
  }

  function isUrlForUser(userId: string, url: string): boolean {
    try {
      const pathname = new URL(url, "http://local").pathname;
      const prefix = `${urlPrefix}${encodeURIComponent(userId)}/`;
      return pathname.startsWith(prefix);
    } catch {
      return url.startsWith(`${urlPrefix}${userId}/`);
    }
  }

  async function save(userId: string, file: File): Promise<StoredRoleAvatar> {
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new AppError("Only JPG, PNG, or WebP photos are allowed", "VALIDATION_ERROR", 400);
    }
    if (file.size > MAX_BYTES) {
      throw new AppError("Photo must be 3 MB or smaller", "VALIDATION_ERROR", 400);
    }

    const original = Buffer.from(await file.arrayBuffer());
    const { buffer, contentType, ext } = await compressAvatarImage(original);
    const storageKey = `${userId}/${randomUUID()}${ext}`;

    await putObject(namespace, storageKey, buffer, contentType);

    return {
      storageKey,
      url: publicUrl(storageKey),
      originalName: file.name,
      mimeType: contentType,
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

  return { publicUrl, isUrlForUser, save, read, storageKeyFromUrl, remove };
}
