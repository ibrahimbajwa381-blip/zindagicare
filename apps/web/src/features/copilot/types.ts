import type { CopilotMessageMetadata } from "@zindagi/validators";

export type CopilotSessionDto = {
  id: string;
  title?: string;
  locale: "en" | "ur";
  status: string;
  lastMessageAt?: string;
  createdAt: string;
};

export type CopilotMessageDto = {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "tool";
  content: string;
  metadata?: CopilotMessageMetadata;
  createdAt: string;
};

export type CopilotStreamEvent =
  | { type: "token"; text: string }
  | { type: "metadata"; metadata: CopilotMessageMetadata }
  | { type: "status"; stage: "thinking" | "tools"; tools?: string[]; reset?: boolean }
  | { type: "done"; message: CopilotMessageDto }
  | { type: "error"; message: string };
