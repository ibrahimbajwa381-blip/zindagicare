import { EventEmitter } from "events";

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

declare global {
  // eslint-disable-next-line no-var
  var chatRealtimeEmitter: EventEmitter | undefined;
}

/** In-process pub/sub; SSE route subscribes. Production: Redis adapter + Socket.io server. */
export const chatEmitter = global.chatRealtimeEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  global.chatRealtimeEmitter = chatEmitter;
}

export function userRoomKey(userId: string) {
  return `chat:user:${userId}`;
}

export function threadRoomKey(threadId: string) {
  return `chat:thread:${threadId}`;
}

export function publishChatEvent(userIds: string[], event: ChatRealtimeEvent) {
  const threadRoom = threadRoomKey(event.threadId);
  chatEmitter.emit(threadRoom, event);

  for (const userId of userIds) {
    chatEmitter.emit(userRoomKey(userId), event);
  }
}
