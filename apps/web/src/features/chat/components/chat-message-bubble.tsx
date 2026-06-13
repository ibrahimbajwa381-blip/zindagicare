"use client";

import { Sparkles } from "lucide-react";
import { cn, localizeIntakeSystemMessage, type IntakeLocale } from "@zindagi/shared";
import type { ChatMessageDto } from "@/features/chat/types";
import { useLocale, useTranslations } from "@/i18n/locale-provider";

type ChatMessageBubbleProps = {
  message: ChatMessageDto;
  showTail?: boolean;
};

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function SystemMessageBubble({
  message,
  locale,
}: {
  message: ChatMessageDto;
  locale: IntakeLocale;
}) {
  const t = useTranslations();
  const displayBody = localizeIntakeSystemMessage(message.body, locale);

  return (
    <div className="flex w-full justify-center">
      <div className="max-w-[88%] rounded-2xl border border-brand-light/40 bg-brand-muted/70 px-4 py-2.5 text-[14px] leading-snug text-slate-800 shadow-sm sm:max-w-[72%]">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-dark">
          <Sparkles className="h-3 w-3" aria-hidden />
          {t.chat.assistantName}
        </p>
        <p className="whitespace-pre-wrap break-words">{displayBody}</p>
        <p className="mt-1 text-right text-[11px] text-slate-400">
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

export function ChatMessageBubble({ message, showTail = true }: ChatMessageBubbleProps) {
  const { locale } = useLocale();
  const isMine = message.isMine;

  if (message.kind === "system") {
    return <SystemMessageBubble message={message} locale={locale} />;
  }

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
