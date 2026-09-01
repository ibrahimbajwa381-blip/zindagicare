"use client";

import Link from "next/link";
import { FileText, Download } from "lucide-react";
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

const LINK_PATTERN = /(https?:\/\/[^\s]+|\/intake\/[a-f0-9]{24})/gi;

function LinkifiedText({ text, intakeLinkLabel }: { text: string; intakeLinkLabel: string }) {
  const parts = text.split(LINK_PATTERN);

  return (
    <>
      {parts.map((part, index) => {
        if (part.match(/^https?:\/\//i) || part.startsWith("/intake/")) {
          const href = part.startsWith("/intake/") ? part : part;
          return (
            <Link
              key={`${part}-${index}`}
              href={href}
              className="font-medium text-brand underline underline-offset-2 hover:text-brand-dark"
            >
              {part.startsWith("/intake/") ? intakeLinkLabel : part}
            </Link>
          );
        }
        return <span key={`${part}-${index}`}>{part}</span>;
      })}
    </>
  );
}

function VoiceNotePlayer({ url, className }: { url: string; className?: string }) {
  return (
    <audio
      controls
      preload="metadata"
      src={url}
      className={cn("h-10 w-56 max-w-full", className)}
    />
  );
}

function fileLabelFromMime(mime: string): string {
  if (mime === "application/pdf") return "PDF document";
  if (mime === "application/msword" || mime.includes("wordprocessingml")) return "Word document";
  return "File";
}

function AttachmentContent({
  url,
  mime,
  className,
}: {
  url: string;
  mime: string;
  className?: string;
}) {
  if (mime.startsWith("image/")) {
    return (
      <Link href={url} target="_blank" rel="noopener noreferrer" className={cn("block", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Attachment"
          className="max-h-64 w-auto max-w-full rounded-lg object-cover"
        />
      </Link>
    );
  }

  if (mime.startsWith("audio/")) {
    return <VoiceNotePlayer url={url} className={className} />;
  }

  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100",
        className,
      )}
    >
      <FileText className="h-5 w-5 shrink-0 text-slate-500" />
      <span className="flex-1 truncate">{fileLabelFromMime(mime)}</span>
      <Download className="h-4 w-4 shrink-0 text-slate-400" />
    </Link>
  );
}

function IncomingMessageBubble({
  body,
  attachmentUrl,
  attachmentMime,
  createdAt,
  showTail,
  intakeLinkLabel,
}: {
  body: string;
  attachmentUrl?: string;
  attachmentMime?: string;
  createdAt: string;
  showTail?: boolean;
  intakeLinkLabel: string;
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
        {attachmentUrl && (
          <AttachmentContent url={attachmentUrl} mime={attachmentMime ?? "audio/webm"} className="mb-1" />
        )}
        {body && (
          <p className="whitespace-pre-wrap break-words">
            <LinkifiedText text={body} intakeLinkLabel={intakeLinkLabel} />
          </p>
        )}
        <p className="mt-1 text-right text-[11px] text-slate-400">
          {formatTime(createdAt)}
        </p>
      </div>
    </div>
  );
}

export function ChatMessageBubble({ message, showTail = true }: ChatMessageBubbleProps) {
  const { locale } = useLocale();
  const t = useTranslations();
  const isMine = message.isMine;
  const intakeLinkLabel = t.intake.ctaPending;

  if (message.kind === "system") {
    const displayBody = localizeIntakeSystemMessage(message.body, locale as IntakeLocale);
    return (
      <IncomingMessageBubble
        body={displayBody}
        createdAt={message.createdAt}
        showTail={showTail}
        intakeLinkLabel={intakeLinkLabel}
      />
    );
  }

  if (!isMine) {
    return (
      <IncomingMessageBubble
        body={message.body}
        attachmentUrl={message.attachmentUrl}
        attachmentMime={message.attachmentMime}
        createdAt={message.createdAt}
        showTail={showTail}
        intakeLinkLabel={intakeLinkLabel}
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
        {message.attachmentUrl && (
          <AttachmentContent
            url={message.attachmentUrl}
            mime={message.attachmentMime ?? "audio/webm"}
            className="mb-1"
          />
        )}
        {message.body && (
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
        )}
        <p className="mt-1 text-right text-[11px] text-emerald-800/70">
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
