import path from "path";
import { randomUUID } from "crypto";
import {
  getObject,
  putObject,
  type StorageNamespace,
} from "@/server/lib/object-storage";

const NAMESPACE: StorageNamespace = "doctor-avatars";
const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type StoredDoctorAvatar = {
  storageKey: string;
  url: string;
  originalName: string;
  mimeType: string;
};

export function doctorAvatarPublicUrl(storageKey: string): string {
  const segments = storageKey.split("/").map((segment) => encodeURIComponent(segment));
  return `/api/v1/public/doctor-avatars/${segments.join("/")}`;
}

export function isDoctorAvatarUrlForUser(userId: string, url: string): boolean {
  try {
    const pathname = new URL(url, "http://local").pathname;
    const prefix = `/api/v1/public/doctor-avatars/${encodeURIComponent(userId)}/`;
    return pathname.startsWith(prefix);
  } catch {
    return url.startsWith(`/api/v1/public/doctor-avatars/${userId}/`);
  }
}

export async function saveDoctorAvatar(
  userId: string,
  file: File,
): Promise<StoredDoctorAvatar> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Only JPG, PNG, or WebP photos are allowed");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Photo must be 3 MB or smaller");
  }

  const ext = path.extname(file.name) || mimeToExt(file.type);
  const storageKey = `${userId}/${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await putObject(NAMESPACE, storageKey, buffer, file.type);

  return {
    storageKey,
    url: doctorAvatarPublicUrl(storageKey),
    originalName: file.name,
    mimeType: file.type,
  };
}

export async function readDoctorAvatar(storageKey: string): Promise<Buffer> {
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
    default:
      return ".jpg";
  }
}
