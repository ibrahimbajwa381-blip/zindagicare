"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "@zindagi/shared";
import type { ChatMessageDto, ChatThreadDto } from "@/features/chat/types";
import {
  createDirectThread,
  fetchMessages,
  fetchThreads,
} from "@/features/chat/lib/chat-api";
import { useChatRealtime } from "@/features/chat/hooks/use-chat-realtime";
import {
  dispatchChatUnreadTotal,
  totalUnreadCount,
} from "@/lib/chat/unread-events";
import { ChatInbox } from "./chat-inbox";
import { ChatConversation } from "./chat-conversation";
import { ChatNewContactPanel } from "./chat-new-contact-panel";

type ChatCopy = {
  title: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  newChatLabel: string;
  newChatTitle: string;
  newChatSearchPlaceholder: string;
  newChatEmpty: string;
  selectChatTitle: string;
  selectChatDescription: string;
  messagePlaceholder: string;
  backLabel: string;
};

type ChatAppProps = {
  copy: ChatCopy;
  currentUserId: string;
  isDoctorView?: boolean;
  initialThreadId?: string;
  initialParticipantId?: string;
  /** Shorter height when embedded in doctor workspace overview */
  embedded?: boolean;
  /** Fill the parent container (used on full-screen messages pages). */
  fillViewport?: boolean;
};

type ViewMode = "inbox" | "conversation" | "new";

/**
 * Keeps the list ordered by server creation time: when a patient answers an
 * intake question, the bot's next question can arrive over SSE before the
 * send request resolves, so plain appending would show them out of order.
 */
function sortByCreatedAt(messages: ChatMessageDto[]) {
  return [...messages].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}

function appendUniqueMessage(messages: ChatMessageDto[], incoming: ChatMessageDto) {
  if (messages.some((message) => message.id === incoming.id)) {
    return messages;
  }
  return sortByCreatedAt([...messages, incoming]);
}

export function ChatApp({
  copy,
  currentUserId,
  isDoctorView = false,
  initialThreadId,
  initialParticipantId,
  embedded = false,
  fillViewport = false,
}: ChatAppProps) {
  const [threads, setThreads] = useState<ChatThreadDto[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>(initialThreadId);
  const [view, setView] = useState<ViewMode>(initialThreadId ? "conversation" : "inbox");
  const [search, setSearch] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [messagesByThread, setMessagesByThread] = useState<
    Record<string, { messages: ChatMessageDto[]; hasMore: boolean; loaded: boolean }>
  >({});

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId),
    [threads, activeThreadId],
  );

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const rows = await fetchThreads();
      setThreads(rows);
    } catch {
      // Keep the inbox usable when the API is temporarily unavailable.
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    dispatchChatUnreadTotal(totalUnreadCount(threads));
  }, [threads]);

  useEffect(() => {
    if (!initialParticipantId) return;
    let cancelled = false;

    void (async () => {
      try {
        const thread = await createDirectThread(initialParticipantId);
        if (cancelled) return;
        await loadThreads();
        setActiveThreadId(thread.id);
        setView("conversation");
      } catch {
        // Participant may be invalid; inbox still works.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialParticipantId, loadThreads]);

  const loadMessages = useCallback(async (threadId: string) => {
    const result = await fetchMessages(threadId);
    setMessagesByThread((prev) => ({
      ...prev,
      [threadId]: {
        messages: result.messages.map((message) => ({ ...message, isMine: message.isMine })),
        hasMore: result.hasMore,
        loaded: true,
      },
    }));
  }, []);

  useEffect(() => {
    if (!activeThreadId) return;
    const state = messagesByThread[activeThreadId];
    if (!state?.loaded) {
      void loadMessages(activeThreadId);
    }
  }, [activeThreadId, loadMessages, messagesByThread]);

  useChatRealtime((event) => {
    if (event.type === "read") {
      if (event.readByUserId === currentUserId) {
        setThreads((prev) =>
          prev.map((thread) =>
            thread.id === event.threadId ? { ...thread, unreadCount: 0 } : thread,
          ),
        );
      }
      return;
    }

    if (event.type === "message") {
      setThreads((prev) => {
        const updated = prev.map((thread) => {
          if (thread.id !== event.threadId) return thread;
          return {
            ...thread,
            lastMessageAt: event.lastMessageAt ?? event.createdAt,
            lastMessagePreview: event.lastMessagePreview ?? event.body,
            unreadCount:
              activeThreadId === thread.id || event.senderId === currentUserId
                ? 0
                : thread.unreadCount + 1,
          };
        });
        return updated.sort((a, b) => {
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        });
      });

      const { messageId, senderId, kind, body, createdAt, threadId } = event;
      const isSystem = kind === "system";
      if (!messageId || !body || !createdAt) return;
      if (!senderId && !isSystem) return;

      // Own sends are already appended from the send API response.
      if (senderId === currentUserId) return;

      setMessagesByThread((prev) => {
        const current = prev[threadId];
        if (!current) return prev;

        const incoming: ChatMessageDto = {
          id: messageId,
          threadId,
          senderId,
          kind: kind ?? "user",
          body,
          createdAt,
          isMine: false,
          readBy: [],
        };

        return {
          ...prev,
          [threadId]: {
            ...current,
            messages: appendUniqueMessage(current.messages, incoming),
          },
        };
      });

      if (activeThreadId === threadId) {
        void loadThreads();
      }
      return;
    }

    if (event.type === "thread_updated") {
      void loadThreads();
    }
  });

  function handleSelectThread(threadId: string) {
    setActiveThreadId(threadId);
    setView("conversation");
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, unreadCount: 0 } : thread,
      ),
    );
  }

  function handleThreadRead(threadId: string) {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, unreadCount: 0 } : thread,
      ),
    );
  }

  function handleThreadCreated(threadId: string) {
    void loadThreads().then(() => {
      setActiveThreadId(threadId);
      setView("conversation");
    });
  }

  function handleMessageSent(message: ChatMessageDto) {
    if (!activeThreadId) return;
    setMessagesByThread((prev) => {
      const current = prev[activeThreadId] ?? { messages: [], hasMore: false, loaded: true };
      return {
        ...prev,
        [activeThreadId]: {
          ...current,
          messages: appendUniqueMessage(current.messages, message),
        },
      };
    });
    setThreads((prev) =>
      prev
        .map((thread) =>
          thread.id === activeThreadId
            ? {
                ...thread,
                lastMessageAt: message.createdAt,
                lastMessagePreview: message.body,
                unreadCount: 0,
              }
            : thread,
        )
        .sort((a, b) => {
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        }),
    );
  }

  function handleMessagesLoaded(
    threadId: string,
    messages: ChatMessageDto[],
    hasMore: boolean,
    prepend?: boolean,
  ) {
    setMessagesByThread((prev) => {
      const current = prev[threadId] ?? { messages: [], hasMore: false, loaded: true };
      const merged = prepend
        ? [...messages, ...current.messages]
        : messages;
      const deduped = merged.filter(
        (message, index, arr) => arr.findIndex((m) => m.id === message.id) === index,
      );
      return {
        ...prev,
        [threadId]: {
          loaded: true,
          hasMore,
          messages: sortByCreatedAt(deduped),
        },
      };
    });
  }

  const messageState = activeThreadId ? messagesByThread[activeThreadId] : undefined;

  const shellHeight = embedded
    ? "h-[28rem] md:h-[32rem]"
    : fillViewport
      ? "h-full min-h-0"
      : "h-[calc(100dvh-13rem)] min-h-[24rem]";

  return (
    <div
      className={cn(
        "w-full",
        embedded || fillViewport ? "h-full max-w-none" : "mx-auto max-w-6xl",
      )}
    >
      <div
        className={cn(
          "grid overflow-hidden bg-white",
          fillViewport
            ? "h-full border-y border-slate-200"
            : "rounded-2xl border border-slate-200 shadow-sm",
          shellHeight,
          "md:grid-cols-[360px_1fr]",
        )}
      >
        <div
          className={cn(
            "flex h-full min-h-0 flex-col overflow-hidden border-r border-slate-200",
            view !== "inbox" && view !== "new" ? "hidden md:flex" : "flex",
          )}
        >
          {view === "new" ? (
            <ChatNewContactPanel
              title={copy.newChatTitle}
              searchPlaceholder={copy.newChatSearchPlaceholder}
              backLabel={copy.backLabel}
              emptyTitle={copy.newChatEmpty}
              isDoctorView={isDoctorView}
              onBack={() => setView("inbox")}
              onThreadCreated={handleThreadCreated}
            />
          ) : (
            <ChatInbox
              threads={threads}
              activeThreadId={activeThreadId}
              loading={loadingThreads}
              title={copy.title}
              searchPlaceholder={copy.searchPlaceholder}
              emptyTitle={copy.emptyTitle}
              emptyDescription={copy.emptyDescription}
              newChatLabel={copy.newChatLabel}
              search={search}
              onSearchChange={setSearch}
              onSelectThread={handleSelectThread}
              onNewChat={() => setView("new")}
            />
          )}
        </div>

        <div
          className={cn(
            "flex h-full min-h-0 flex-col overflow-hidden",
            view === "conversation" ? "flex" : "hidden md:flex",
          )}
        >
          {activeThread && activeThreadId ? (
            <ChatConversation
              thread={activeThread}
              messages={messageState?.messages ?? []}
              hasMore={messageState?.hasMore ?? false}
              loadingMessages={!messageState?.loaded}
              onBack={() => setView("inbox")}
              onMessageSent={handleMessageSent}
              onThreadRead={handleThreadRead}
              onMessagesLoaded={(messages, hasMore, prepend) =>
                handleMessagesLoaded(activeThreadId, messages, hasMore, prepend)
              }
              placeholder={copy.messagePlaceholder}
              backLabel={copy.backLabel}
              isDoctorView={isDoctorView}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-[#f8faf9] px-6 text-center">
              <div className="mb-4 rounded-full bg-brand-muted p-5 text-brand">
                <MessageSquare className="h-10 w-10" />
              </div>
              <h3 className="font-display text-xl font-semibold text-slate-900">
                {copy.selectChatTitle}
              </h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                {copy.selectChatDescription}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
