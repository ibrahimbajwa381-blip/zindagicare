import { AppError } from "@zindagi/shared";
import { randomUUID } from "crypto";
import {
  deleteObject,
  getObject,
  putObject,
  type StorageNamespace,
} from "@/server/lib/object-storage";
import { compressAvatarImage } from "@/server/lib/image-compression";

const NAMESPACE: StorageNamespace = "nutritionist-avatars";
const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type StoredNutritionistAvatar = {
  storageKey: string;
  url: string;
  originalName: string;
  mimeType: string;
};

export function nutritionistAvatarPublicUrl(storageKey: string): string {
  const segments = storageKey
    .split("/")
    .map((segment) => encodeURIComponent(segment));
  return `/api/v1/public/nutritionist-avatars/${segments.join("/")}`;
}

export function isNutritionistAvatarUrlForUser(userId: string, url: string): boolean {
  try {
    const pathname = new URL(url, "http://local").pathname;
    const prefix = `/api/v1/public/nutritionist-avatars/${encodeURIComponent(userId)}/`;
    return pathname.startsWith(prefix);
  } catch {
    return url.startsWith(`/api/v1/public/nutritionist-avatars/${userId}/`);
  }
}

export async function saveNutritionistAvatar(
  userId: string,
  file: File,
): Promise<StoredNutritionistAvatar> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new AppError("Only JPG, PNG, or WebP photos are allowed", "VALIDATION_ERROR", 400);
  }
  if (file.size > MAX_BYTES) {
    throw new AppError("Photo must be 3 MB or smaller", "VALIDATION_ERROR", 400);
  }

  const original = Buffer.from(await file.arrayBuffer());
  const { buffer, contentType, ext } = await compressAvatarImage(original);
  const storageKey = `${userId}/${randomUUID()}${ext}`;

  await putObject(NAMESPACE, storageKey, buffer, contentType);

  return {
    storageKey,
    url: nutritionistAvatarPublicUrl(storageKey),
    originalName: file.name,
    mimeType: contentType,
  };
}

export async function readNutritionistAvatar(storageKey: string): Promise<Buffer> {
  return getObject(NAMESPACE, storageKey);
}

export function nutritionistAvatarStorageKeyFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url, "http://local").pathname;
    const prefix = "/api/v1/public/nutritionist-avatars/";
    if (!pathname.startsWith(prefix)) return null;
    return decodeURIComponent(pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

export async function deleteNutritionistAvatar(storageKey: string): Promise<void> {
  await deleteObject(NAMESPACE, storageKey);
}
