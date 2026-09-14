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
  var chatRealtimeEmitter: EventEmitter | undefined;
}

/** In-process pub/sub; SSE route subscribes. Production: Redis adapter + Socket.io server. */
export const chatEmitter = global.chatRealtimeEmitter ?? new EventEmitter();

// Allow unlimited concurrent SSE listeners without MaxListenersExceededWarning
chatEmitter.setMaxListeners(0);

// Always store on global to preserve single emitter across chunks and reload cycles
global.chatRealtimeEmitter = chatEmitter;

export function userRoomKey(userId: string) {
  return `chat:user:${userId}`;
}

export function threadRoomKey(threadId: string) {
  return `chat:thread:${threadId}`;
}

export function publishChatEvent(userIds: string[], event: ChatRealtimeEvent) {
  const threadRoom = threadRoomKey(event.threadId);
  try {
    chatEmitter.emit(threadRoom, event);
  } catch {
    // Isolate thread room error so it does not propagate
  }

  // De-duplicate recipient user IDs so each user receives exactly one event
  const uniqueUserIds = [...new Set(userIds)];
  for (const userId of uniqueUserIds) {
    try {
      chatEmitter.emit(userRoomKey(userId), event);
    } catch {
      // Isolate per-user error so a failing listener does not block other recipients
    }
  }
}
