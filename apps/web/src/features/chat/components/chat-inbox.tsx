"use client";

import { Search, MessageCirclePlus } from "lucide-react";
import { cn } from "@zindagi/shared";
import { LoadingScreen } from "@/components/ui/loading-screen";
import type { ChatThreadDto } from "@/features/chat/types";
import { ChatThreadItem } from "./chat-thread-item";

type ChatInboxProps = {
  threads: ChatThreadDto[];
  activeThreadId?: string;
  loading?: boolean;
  title: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  newChatLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectThread: (threadId: string) => void;
  onNewChat: () => void;
  showNewChat?: boolean;
};

export function ChatInbox({
  threads,
  activeThreadId,
  loading,
  title,
  searchPlaceholder,
  emptyTitle,
  emptyDescription,
  newChatLabel,
  search,
  onSearchChange,
  onSelectThread,
  onNewChat,
  showNewChat = true,
}: ChatInboxProps) {
  const filtered = threads.filter((thread) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      thread.otherParticipant.name.toLowerCase().includes(q) ||
      thread.lastMessagePreview?.toLowerCase().includes(q) ||
      thread.otherParticipant.subtitle?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-slate-200 bg-[#f0f2f5] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-slate-900">{title}</h2>
          {showNewChat && (
            <button
              type="button"
              onClick={onNewChat}
              className="rounded-full p-2 text-slate-600 transition-colors hover:bg-white hover:text-brand"
              aria-label={newChatLabel}
            >
              <MessageCirclePlus className="h-5 w-5" />
            </button>
          )}
        </div>
        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={cn(
              "w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm",
              "outline-none focus:border-brand-light focus:ring-2 focus:ring-brand-muted",
            )}
          />
        </label>
      </div>

      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <LoadingScreen message="Loading chats…" size="md" />
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-medium text-slate-700">{emptyTitle}</p>
            <p className="mt-1 text-sm text-slate-500">{emptyDescription}</p>
          </div>
        ) : (
          filtered.map((thread) => (
            <ChatThreadItem
              key={thread.id}
              thread={thread}
              active={thread.id === activeThreadId}
              onClick={() => onSelectThread(thread.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
