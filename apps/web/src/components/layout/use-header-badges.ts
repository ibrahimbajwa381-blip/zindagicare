"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchThreads } from "@/features/chat/lib/chat-api";
import { CHAT_UNREAD_EVENT } from "@/lib/chat/unread-events";
import { useIsMountedRef } from "@/hooks/use-is-mounted-ref";

type NotificationSummary = {
  unreadCount: number;
};

async function fetchNotificationSummary(): Promise<NotificationSummary> {
  const res = await fetch("/api/v1/notifications/summary");
  if (!res.ok) return { unreadCount: 0 };
  const json = (await res.json()) as {
    success: boolean;
    data?: NotificationSummary;
  };
  return json.data ?? { unreadCount: 0 };
}

async function fetchChatUnreadTotal() {
  const threads = await fetchThreads();
  return threads.reduce((sum, thread) => sum + (thread.unreadCount ?? 0), 0);
}

export function useHeaderBadges(enabled: boolean) {
  const mountedRef = useIsMountedRef();
  const [chatUnread, setChatUnread] = useState(0);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    const [chatTotal, summary] = await Promise.all([
      fetchChatUnreadTotal().catch(() => 0),
      fetchNotificationSummary().catch(() => ({ unreadCount: 0 })),
    ]);

    if (!mountedRef.current) return;

    setChatUnread(chatTotal);
    setNotificationUnread(summary.unreadCount);
    setLoading(false);
  }, [enabled, mountedRef]);

  useEffect(() => {
    if (!enabled) {
      setChatUnread(0);
      setNotificationUnread(0);
      setLoading(false);
      return;
    }

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 60_000);

    const onFocus = () => {
      void refresh();
    };

    const onChatUnread = (event: Event) => {
      const total = (event as CustomEvent<{ total: number }>).detail?.total;
      if (typeof total === "number") {
        setChatUnread(total);
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener(CHAT_UNREAD_EVENT, onChatUnread);

    const source = new EventSource("/api/v1/chat/events");
    source.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data) as { type?: string };
        if (!payload.type || payload.type === "connected" || payload.type === "read") {
          return;
        }
        void refresh();
      } catch {
        // Ignore malformed events.
      }
    };
    source.onerror = () => {
      source.close();
    };

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(CHAT_UNREAD_EVENT, onChatUnread);
      source.close();
    };
  }, [enabled, refresh]);

  return {
    chatUnread,
    notificationUnread,
    loading,
    refresh,
  };
}
