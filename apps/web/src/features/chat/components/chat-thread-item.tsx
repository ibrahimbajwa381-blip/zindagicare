"use client";

import { cn } from "@zindagi/shared";
import type { ChatThreadDto } from "@/features/chat/types";
import { ChatAvatar } from "./chat-avatar";

type ChatThreadItemProps = {
  thread: ChatThreadDto;
  active?: boolean;
  onClick: () => void;
};

function formatPreviewTime(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

function formatUnreadCount(count: number) {
  if (count > 99) return "99+";
  return String(count);
}

export function ChatThreadItem({ thread, active, onClick }: ChatThreadItemProps) {
  const { otherParticipant } = thread;
  const hasUnread = thread.unreadCount > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors",
        active ? "bg-brand-muted/80" : "hover:bg-slate-50",
      )}
    >
      <ChatAvatar
        name={otherParticipant.name}
        avatarUrl={otherParticipant.avatarUrl}
        isDoctor={otherParticipant.role === "doctor"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-slate-900",
              hasUnread ? "font-bold" : "font-semibold",
            )}
          >
            {otherParticipant.name}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {thread.lastMessageAt && (
              <span
                className={cn(
                  "text-xs",
                  hasUnread ? "font-semibold text-brand" : "text-slate-500",
                )}
              >
                {formatPreviewTime(thread.lastMessageAt)}
              </span>
            )}
            {hasUnread && (
              <span
                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold leading-none text-white"
                aria-label={`${thread.unreadCount} unread messages`}
              >
                {formatUnreadCount(thread.unreadCount)}
              </span>
            )}
          </div>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-sm",
              hasUnread ? "font-medium text-slate-800" : "text-slate-500",
            )}
          >
            {thread.lastMessagePreview || otherParticipant.subtitle || "Start a conversation"}
          </p>
        </div>
      </div>
    </button>
  );
}
