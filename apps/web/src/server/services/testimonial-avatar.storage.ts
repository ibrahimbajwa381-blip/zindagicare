import { AppError } from "@zindagi/shared";
import { randomUUID } from "crypto";
import {
  deleteObject,
  getObject,
  putObject,
  type StorageNamespace,
} from "@/server/lib/object-storage";

const NAMESPACE: StorageNamespace = "testimonial-avatars";
const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type StoredTestimonialAvatar = {
  storageKey: string;
  url: string;
};

export function testimonialAvatarPublicUrl(storageKey: string): string {
  const segments = storageKey.split("/").map((segment) => encodeURIComponent(segment));
  return `/api/v1/public/testimonial-avatars/${segments.join("/")}`;
}

export async function saveTestimonialAvatar(file: File): Promise<StoredTestimonialAvatar> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new AppError("Only JPG, PNG, or WebP photos are allowed", "VALIDATION_ERROR", 400);
  }
  if (file.size > MAX_BYTES) {
    throw new AppError("Photo must be 3 MB or smaller", "VALIDATION_ERROR", 400);
  }
  if (file.size === 0) {
    throw new AppError("Photo file is empty", "VALIDATION_ERROR", 400);
  }

  const ext = mimeToExt(file.type);
  const storageKey = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await putObject(NAMESPACE, storageKey, buffer, file.type);

  return {
    storageKey,
    url: testimonialAvatarPublicUrl(storageKey),
  };
}

export async function readTestimonialAvatar(storageKey: string): Promise<Buffer> {
  return getObject(NAMESPACE, storageKey);
}

export function testimonialAvatarStorageKeyFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url, "http://local").pathname;
    const prefix = "/api/v1/public/testimonial-avatars/";
    if (!pathname.startsWith(prefix)) return null;
    return decodeURIComponent(pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

export async function deleteTestimonialAvatar(storageKey: string): Promise<void> {
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
    default:
      return ".jpg";
  }
}
