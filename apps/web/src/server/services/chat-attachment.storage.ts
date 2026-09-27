import { AppError } from "@zindagi/shared";
import { randomUUID } from "crypto";
import { wrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
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

  const ext = ALLOWED_MIME_EXT[mimeType];
  if (!ext) {
    throw new AppError("Unsupported attachment format", "VALIDATION_ERROR", 400);
  }

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
