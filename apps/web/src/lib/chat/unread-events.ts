import type { ChatThreadDto } from "@/features/chat/types";

export const CHAT_UNREAD_EVENT = "zindagi:chat-unread";

export function totalUnreadCount(threads: readonly ChatThreadDto[]) {
  return threads.reduce((sum, thread) => sum + (thread.unreadCount ?? 0), 0);
}

export function dispatchChatUnreadTotal(total: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CHAT_UNREAD_EVENT, { detail: { total } }),
  );
}
