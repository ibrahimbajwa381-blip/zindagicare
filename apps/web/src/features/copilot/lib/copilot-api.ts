import type { CopilotMessageDto, CopilotSessionDto } from "@/features/copilot/types";

type ApiResponse<T> = { success: boolean; data?: T; error?: { message?: string } };

async function parseJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success || json.data === undefined) {
    throw new Error(json.error?.message ?? "Request failed");
  }
  return json.data;
}

export async function fetchCopilotSessions(): Promise<CopilotSessionDto[]> {
  const res = await fetch("/api/v1/copilot/sessions");
  return parseJson<CopilotSessionDto[]>(res);
}

export async function createCopilotSession(locale?: "en" | "ur"): Promise<CopilotSessionDto> {
  const res = await fetch("/api/v1/copilot/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  return parseJson<CopilotSessionDto>(res);
}

export async function fetchCopilotMessages(sessionId: string): Promise<CopilotMessageDto[]> {
  const res = await fetch(`/api/v1/copilot/sessions/${sessionId}/messages`);
  return parseJson<CopilotMessageDto[]>(res);
}

export async function archiveCopilotSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/v1/copilot/sessions/${sessionId}`, { method: "DELETE" });
  if (!res.ok) {
    const json = (await res.json()) as ApiResponse<unknown>;
    throw new Error(json.error?.message ?? "Failed to archive session");
  }
}
