import { apiFetch, ApiRequestError } from "./client";
import { API_URL } from "@/lib/config";
import { getStoredTokens } from "@/lib/token-storage";
import { uploadFileMultipart } from "@/lib/file-upload";

export type ChatParticipant = {
  id: string;
  name: string;
  avatarUrl?: string;
  role: "doctor" | "patient";
  subtitle?: string;
};

export type ChatThread = {
  id: string;
  type: string;
  appointmentId?: string;
  appointmentType?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount: number;
  isClosed: boolean;
  otherParticipant: ChatParticipant;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  senderId?: string;
  kind?: "user" | "system";
  body: string;
  attachmentUrl?: string;
  attachmentMime?: string;
  createdAt: string;
  isMine: boolean;
  readBy: string[];
};

export function listChatThreads() {
  return apiFetch<ChatThread[]>("/api/v1/chat/threads");
}

export function listChatMessages(threadId: string, before?: string) {
  const qs = before ? `?before=${encodeURIComponent(before)}` : "";
  return apiFetch<{ messages: ChatMessage[]; hasMore: boolean }>(
    `/api/v1/chat/threads/${threadId}/messages${qs}`,
  );
}

export function sendChatMessage(
  threadId: string,
  body: string,
  attachment?: { url: string; mime: string },
) {
  return apiFetch<ChatMessage>(`/api/v1/chat/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body, attachmentUrl: attachment?.url, attachmentMime: attachment?.mime }),
  });
}

export type VoiceNoteUpload = {
  storageKey: string;
  url: string;
  mimeType: string;
};

export type ChatFileUpload = VoiceNoteUpload;

/** Shared implementation behind {@link uploadChatVoiceNote} and {@link uploadChatFile} — both
 * hit the same attachment-upload endpoint and only differ in the caller-facing type name. */
async function uploadChatAttachment(
  threadId: string,
  fileUri: string,
  mimeType: string,
): Promise<VoiceNoteUpload> {
  const { accessToken } = await getStoredTokens();

  const { status, json } = await uploadFileMultipart<
    | { success: true; data: VoiceNoteUpload; error: null }
    | { success: false; data: null; error: { code: string; message: string } }
  >(`${API_URL}/api/v1/chat/attachments/upload`, fileUri, {
    mimeType,
    parameters: { threadId },
    accessToken,
  });

  if (!json.success) {
    throw new ApiRequestError(json.error.message, json.error.code, status);
  }
  return json.data;
}

/** Voice notes only — the backend only accepts audio/webm, audio/ogg, audio/mp4, audio/mpeg. */
export async function uploadChatVoiceNote(
  threadId: string,
  fileUri: string,
  mimeType: string,
): Promise<VoiceNoteUpload> {
  return uploadChatAttachment(threadId, fileUri, mimeType);
}

export async function uploadChatFile(
  threadId: string,
  fileUri: string,
  mimeType: string,
  fileName: string,
): Promise<ChatFileUpload> {
  return uploadChatAttachment(threadId, fileUri, mimeType);
}

/** Chat attachments require the bearer token — build authenticated fetch headers for audio/image/file sources. */
export async function chatAttachmentSource(url: string) {
  const { accessToken } = await getStoredTokens();
  return {
    uri: url.startsWith("http") ? url : `${API_URL}${url}`,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  };
}

export function markChatThreadRead(threadId: string) {
  return apiFetch<{ ok: true }>(`/api/v1/chat/threads/${threadId}/read`, {
    method: "PATCH",
  });
}

/** Mirrors apps/web/src/lib/realtime/chat-emitter.ts's ChatRealtimeEvent, pushed over SSE. */
export type ChatRealtimeEvent = {
  type: "message" | "thread_updated" | "read";
  threadId: string;
  messageId?: string;
  senderId?: string;
  kind?: "user" | "system";
  body?: string;
  attachmentUrl?: string;
  attachmentMime?: string;
  createdAt?: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  readByUserId?: string;
};
