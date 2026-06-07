"use client";

import { cn } from "@zindagi/shared";
import type { ChatMessageDto } from "@/features/chat/types";

type ChatMessageBubbleProps = {
  message: ChatMessageDto;
  showTail?: boolean;
};

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatMessageBubble({ message, showTail = true }: ChatMessageBubbleProps) {
  const isMine = message.isMine;

  return (
    <div
      className={cn(
        "flex w-full",
        isMine ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "relative max-w-[82%] px-3.5 py-2 text-[15px] leading-snug shadow-sm",
          isMine
            ? "rounded-2xl rounded-br-md bg-[#dcf8c6] text-slate-900"
            : "rounded-2xl rounded-bl-md bg-white text-slate-900",
          showTail && isMine && "rounded-br-sm",
          showTail && !isMine && "rounded-bl-sm",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={cn(
            "mt-1 text-right text-[11px]",
            isMine ? "text-emerald-800/70" : "text-slate-400",
          )}
        >
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
