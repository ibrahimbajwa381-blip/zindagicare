"use client";

import { cn, localizeIntakeSystemMessage, type IntakeLocale } from "@zindagi/shared";
import type { ChatMessageDto } from "@/features/chat/types";
import { useLocale } from "@/i18n/locale-provider";

type ChatMessageBubbleProps = {
  message: ChatMessageDto;
  showTail?: boolean;
};

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function IncomingMessageBubble({
  body,
  createdAt,
  showTail,
}: {
  body: string;
  createdAt: string;
  showTail?: boolean;
}) {
  return (
    <div className="flex w-full justify-start">
      <div
        className={cn(
          "relative max-w-[82%] px-3.5 py-2 text-[15px] leading-snug text-slate-900 shadow-sm",
          "rounded-2xl rounded-bl-md bg-white",
          showTail && "rounded-bl-sm",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{body}</p>
        <p className="mt-1 text-right text-[11px] text-slate-400">
          {formatTime(createdAt)}
        </p>
      </div>
    </div>
  );
}

export function ChatMessageBubble({ message, showTail = true }: ChatMessageBubbleProps) {
  const { locale } = useLocale();
  const isMine = message.isMine;

  if (message.kind === "system") {
    const displayBody = localizeIntakeSystemMessage(message.body, locale as IntakeLocale);
    return (
      <IncomingMessageBubble
        body={displayBody}
        createdAt={message.createdAt}
        showTail={showTail}
      />
    );
  }

  if (!isMine) {
    return (
      <IncomingMessageBubble
        body={message.body}
        createdAt={message.createdAt}
        showTail={showTail}
      />
    );
  }

  return (
    <div className="flex w-full justify-end">
      <div
        className={cn(
          "relative max-w-[82%] px-3.5 py-2 text-[15px] leading-snug text-slate-900 shadow-sm",
          "rounded-2xl rounded-br-md bg-[#dcf8c6]",
          showTail && "rounded-br-sm",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className="mt-1 text-right text-[11px] text-emerald-800/70">
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
