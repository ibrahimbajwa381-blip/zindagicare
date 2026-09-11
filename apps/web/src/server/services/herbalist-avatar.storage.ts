import { randomUUID } from "crypto";
import {
  deleteObject,
  getObject,
  putObject,
  type StorageNamespace,
} from "@/server/lib/object-storage";
import { compressAvatarImage } from "@/server/lib/image-compression";

const NAMESPACE: StorageNamespace = "herbalist-avatars";
const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type StoredHerbalistAvatar = {
  storageKey: string;
  url: string;
  originalName: string;
  mimeType: string;
};

export function herbalistAvatarPublicUrl(storageKey: string): string {
  const segments = storageKey
    .split("/")
    .map((segment) => encodeURIComponent(segment));
  return `/api/v1/public/herbalist-avatars/${segments.join("/")}`;
}

export function isHerbalistAvatarUrlForUser(userId: string, url: string): boolean {
  try {
    const pathname = new URL(url, "http://local").pathname;
    const prefix = `/api/v1/public/herbalist-avatars/${encodeURIComponent(userId)}/`;
    return pathname.startsWith(prefix);
  } catch {
    return url.startsWith(`/api/v1/public/herbalist-avatars/${userId}/`);
  }
}

export async function saveHerbalistAvatar(
  userId: string,
  file: File,
): Promise<StoredHerbalistAvatar> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Only JPG, PNG, or WebP photos are allowed");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Photo must be 3 MB or smaller");
  }

  const original = Buffer.from(await file.arrayBuffer());
  const { buffer, contentType, ext } = await compressAvatarImage(original);
  const storageKey = `${userId}/${randomUUID()}${ext}`;

  await putObject(NAMESPACE, storageKey, buffer, contentType);

  return {
    storageKey,
    url: herbalistAvatarPublicUrl(storageKey),
    originalName: file.name,
    mimeType: contentType,
  };
}

export async function readHerbalistAvatar(storageKey: string): Promise<Buffer> {
  return getObject(NAMESPACE, storageKey);
}

export function herbalistAvatarStorageKeyFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url, "http://local").pathname;
    const prefix = "/api/v1/public/herbalist-avatars/";
    if (!pathname.startsWith(prefix)) return null;
    return decodeURIComponent(pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

export async function deleteHerbalistAvatar(storageKey: string): Promise<void> {
  await deleteObject(NAMESPACE, storageKey);
}
