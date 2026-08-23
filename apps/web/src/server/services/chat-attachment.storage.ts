import { randomUUID } from "crypto";
import { wrapEncryptedFile } from "@zindagi/shared/crypto/field-encryption";
import {
  getObject,
  putObject,
  type StorageNamespace,
} from "@/server/lib/object-storage";

const NAMESPACE: StorageNamespace = "chat-attachments";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
};

export type StoredVoiceNote = {
  storageKey: string;
  url: string;
  mimeType: string;
};

export async function saveChatVoiceNote(
  threadId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<StoredVoiceNote> {
  if (buffer.length === 0) {
    throw new Error("Voice note is empty");
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error("Voice note must be 10 MB or smaller");
  }

  const ext = ALLOWED_MIME_EXT[mimeType];
  if (!ext) {
    throw new Error("Unsupported voice note format");
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

export async function readChatVoiceNote(storageKey: string): Promise<Buffer> {
  return getObject(NAMESPACE, storageKey);
}
