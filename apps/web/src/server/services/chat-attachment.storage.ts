import { AppError } from "@zindagi/shared";
import { randomUUID } from "crypto";
import { wrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import { processMedicalImage } from "@/server/lib/medical-image-pipeline";
import {
  getObject,
  putObject,
  type StorageNamespace,
} from "@/server/lib/object-storage";

const NAMESPACE: StorageNamespace = "chat-attachments";
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

// Chat photos are often dense reports; allow more than the Q&A 150 KB ceiling rather than refuse them.
const IMAGE_LIMITS = { targetBytes: 200 * 1024, maxProcessedBytes: 1024 * 1024 };
// HEIC can't be decoded by the bundled sharp build, so it is stored as uploaded.
const RECOMPRESSED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type StoredChatAttachment = {
  storageKey: string;
  url: string;
  mimeType: string;
};

export async function saveChatAttachment(
  threadId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<StoredChatAttachment> {
  if (buffer.length === 0) {
    throw new AppError("Attachment is empty", "VALIDATION_ERROR", 400);
  }
  if (buffer.length > MAX_BYTES) {
    throw new AppError("Attachment must be 20 MB or smaller", "VALIDATION_ERROR", 400);
  }

  if (!ALLOWED_MIME_EXT[mimeType]) {
    throw new AppError("Unsupported attachment format", "VALIDATION_ERROR", 400);
  }

  // Photos are re-encoded to metadata-free WebP; documents and audio can't be, so they pass through.
  if (RECOMPRESSED_IMAGE_TYPES.has(mimeType)) {
    buffer = (await processMedicalImage(buffer, IMAGE_LIMITS)).buffer;
    mimeType = "image/webp";
  }
  const ext = ALLOWED_MIME_EXT[mimeType];

  const storageKey = `${threadId}/${randomUUID()}.${ext}`;
  const encrypted = wrapEncryptedFile(buffer);
  await putObject(NAMESPACE, storageKey, encrypted, mimeType);

  return {
    storageKey,
    url: `/api/v1/chat/attachments/${encodeURIComponent(storageKey)}`,
    mimeType,
  };
}

export async function readChatAttachment(storageKey: string): Promise<Buffer> {
  return getObject(NAMESPACE, storageKey);
}
