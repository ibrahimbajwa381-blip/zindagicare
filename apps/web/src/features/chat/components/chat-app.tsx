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
};

type ViewMode = "inbox" | "conversation" | "new";

function appendUniqueMessage(messages: ChatMessageDto[], incoming: ChatMessageDto) {
  if (messages.some((message) => message.id === incoming.id)) {
    return messages;
  }
  return [...messages, incoming];
}

export function ChatApp({
  copy,
  currentUserId,
  isDoctorView = false,
  initialThreadId,
  initialParticipantId,
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
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

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
    if (event.type === "message") {
      setThreads((prev) => {
        const updated = prev.map((thread) => {
          if (thread.id !== event.threadId) return thread;
          return {
            ...thread,
            lastMessageAt: event.lastMessageAt ?? event.createdAt,
            lastMessagePreview: event.lastMessagePreview ?? event.body,
            unreadCount:
              activeThreadId === thread.id ? 0 : thread.unreadCount + 1,
          };
        });
        return updated.sort((a, b) => {
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        });
      });

      const { messageId, senderId, body, createdAt, threadId } = event;
      if (!messageId || !senderId || !body || !createdAt) return;

      // Own sends are already appended from the send API response.
      if (senderId === currentUserId) return;

      setMessagesByThread((prev) => {
        const current = prev[threadId];
        if (!current) return prev;

        const incoming: ChatMessageDto = {
          id: messageId,
          threadId,
          senderId,
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
          messages: deduped,
        },
      };
    });
  }

  const messageState = activeThreadId ? messagesByThread[activeThreadId] : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div
        className={cn(
          "grid min-h-[calc(100dvh-8rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg",
          "md:grid-cols-[360px_1fr]",
        )}
      >
        <div
          className={cn(
            "border-r border-slate-200",
            view !== "inbox" && view !== "new" ? "hidden md:block" : "block",
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
            "min-h-[calc(100dvh-8rem)]",
            view === "conversation" ? "block" : "hidden md:block",
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
              onMessagesLoaded={(messages, hasMore, prepend) =>
                handleMessagesLoaded(activeThreadId, messages, hasMore, prepend)
              }
              placeholder={copy.messagePlaceholder}
              backLabel={copy.backLabel}
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
