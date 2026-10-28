import type {
  ChatContactDto,
  ChatMessageDto,
  ChatThreadDto,
} from "@/features/chat/types";
import { voiceNoteFileName } from "@/features/chat/lib/voice-note-format";

type ApiResult<T> = { success: boolean; data: T | null; error?: { message: string } };

/** Client-side wait limits. Upload covers the server's 30s storage timeout plus transfer. */
export const UPLOAD_TIMEOUT_MS = 60_000;
export const SEND_TIMEOUT_MS = 20_000;

export class ChatRequestError extends Error {
  constructor(
    message: string,
    /** HTTP status; undefined when no response arrived (network error or timeout). */
    readonly status?: number,
  ) {
    super(message);
    this.name = "ChatRequestError";
  }

  /** Bad input, wrong type/size or auth won't succeed on retry; timeouts, network and 5xx might. */
  get retryable() {
    return this.status === undefined || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

async function parse<T>(res: Response): Promise<T> {
  let json: ApiResult<T>;
  try {
    json = (await res.json()) as ApiResult<T>;
  } catch {
    // e.g. an HTML 413/502/504 page from the host or proxy.
    throw new ChatRequestError(`Server error (HTTP ${res.status})`, res.status);
  }
  if (!json.success || json.data === null) {
    throw new ChatRequestError(json.error?.message ?? "Request failed", res.status);
  }
  return json.data;
}

/** fetch with a time limit; a timeout stops waiting but the server may still finish the request. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ChatRequestError("The server took too long to respond. Please try again.");
    }
    throw new ChatRequestError("Network error. Check your connection and try again.");
  }
}

export async function fetchThreads(): Promise<ChatThreadDto[]> {
  const res = await fetch("/api/v1/chat/threads");
  return parse<ChatThreadDto[]>(res);
}

export async function fetchContacts(q?: string): Promise<ChatContactDto[]> {
  const params = q ? `?q=${encodeURIComponent(q)}` : "";
  const res = await fetch(`/api/v1/chat/contacts${params}`);
  return parse<ChatContactDto[]>(res);
}

export async function createDirectThread(participantId: string): Promise<ChatThreadDto> {
  const res = await fetch("/api/v1/chat/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participantId }),
  });
  return parse<ChatThreadDto>(res);
}

export async function fetchMessages(
  threadId: string,
  before?: string,
): Promise<{ messages: ChatMessageDto[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (before) params.set("before", before);
  const res = await fetch(
    `/api/v1/chat/threads/${threadId}/messages?${params.toString()}`,
  );
  return parse<{ messages: ChatMessageDto[]; hasMore: boolean }>(res);
}

export async function sendMessage(
  threadId: string,
  body: string,
  locale?: "en" | "ur",
  attachment?: { url: string; mime: string },
): Promise<ChatMessageDto> {
  const res = await fetchWithTimeout(
    `/api/v1/chat/threads/${threadId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        locale,
        attachmentUrl: attachment?.url,
        attachmentMime: attachment?.mime,
      }),
    },
    SEND_TIMEOUT_MS,
  );
  return parse<ChatMessageDto>(res);
}

export async function uploadVoiceNote(
  threadId: string,
  blob: Blob,
): Promise<{ storageKey: string; url: string; mimeType: string }> {
  const formData = new FormData();
  formData.set("threadId", threadId);
  formData.set("file", blob, voiceNoteFileName(blob.type));
  const res = await fetchWithTimeout(
    "/api/v1/chat/attachments/upload",
    { method: "POST", body: formData },
    UPLOAD_TIMEOUT_MS,
  );
  return parse<{ storageKey: string; url: string; mimeType: string }>(res);
}

export async function uploadChatFile(
  threadId: string,
  file: File,
): Promise<{ storageKey: string; url: string; mimeType: string }> {
  const formData = new FormData();
  formData.set("threadId", threadId);
  formData.set("file", file, file.name);
  const res = await fetchWithTimeout(
    "/api/v1/chat/attachments/upload",
    { method: "POST", body: formData },
    UPLOAD_TIMEOUT_MS,
  );
  return parse<{ storageKey: string; url: string; mimeType: string }>(res);
}

export async function markThreadRead(threadId: string) {
  await fetch(`/api/v1/chat/threads/${threadId}/read`, { method: "PATCH" });
}
