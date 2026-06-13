import type {
  ChatContactDto,
  ChatMessageDto,
  ChatThreadDto,
} from "@/features/chat/types";

type ApiResult<T> = { success: boolean; data: T | null; error?: { message: string } };

async function parse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResult<T>;
  if (!json.success || json.data === null) {
    throw new Error(json.error?.message ?? "Request failed");
  }
  return json.data;
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
): Promise<ChatMessageDto> {
  const res = await fetch(`/api/v1/chat/threads/${threadId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, locale }),
  });
  return parse<ChatMessageDto>(res);
}

export async function markThreadRead(threadId: string) {
  await fetch(`/api/v1/chat/threads/${threadId}/read`, { method: "PATCH" });
}
