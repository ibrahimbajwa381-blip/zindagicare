"use client";

import { useCallback, useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import type { ChatMessageDto, ChatThreadDto } from "@/features/chat/types";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { ChatAvatar } from "./chat-avatar";
import { ChatComposer } from "./chat-composer";
import { ChatMessageBubble } from "./chat-message-bubble";
import {
  fetchMessages,
  markThreadRead,
  sendMessage,
  uploadChatFile,
  uploadVoiceNote,
} from "@/features/chat/lib/chat-api";
import { DoctorIntakeSummary } from "@/features/intake/components/doctor-intake-summary";
import { VideoJoinLinkButton } from "@/features/consult/components/video-join-link-button";

type ChatConversationProps = {
  thread: ChatThreadDto;
  messages: ChatMessageDto[];
  hasMore: boolean;
  loadingMessages: boolean;
  currentUserId: string;
  onBack?: () => void;
  onMessageSent: (message: ChatMessageDto) => void;
  onMessageReplaced: (tempId: string, message: ChatMessageDto) => void;
  onMessageFailed: (tempId: string) => void;
  onThreadRead?: (threadId: string) => void;
  onMessagesLoaded: (messages: ChatMessageDto[], hasMore: boolean, prepend?: boolean) => void;
  placeholder: string;
  backLabel: string;
  isDoctorView?: boolean;
};

export function ChatConversation({
  thread,
  messages,
  hasMore,
  loadingMessages,
  currentUserId,
  onBack,
  onMessageSent,
  onMessageReplaced,
  onMessageFailed,
  onThreadRead,
  onMessagesLoaded,
  placeholder,
  backLabel,
  isDoctorView = false,
}: ChatConversationProps) {
  const { locale } = useLocale();
  const t = useTranslations();
  const listRef = useRef<HTMLDivElement>(null);
  const uploadedVoiceNotes = useRef(new WeakMap<Blob, { url: string; mimeType: string }>());
  const loadingOlderRef = useRef(false);
  const onThreadReadRef = useRef(onThreadRead);
  useEffect(() => {
    onThreadReadRef.current = onThreadRead;
  }, [onThreadRead]);
  const { otherParticipant } = thread;

  // Scroll only the message list, never the page: scrollIntoView would also
  // scroll the window down to the footer whenever a message is added.
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    void markThreadRead(thread.id).then(() => {
      onThreadReadRef.current?.(thread.id);
    });
  }, [thread.id, messages.length]);

  useEffect(() => {
    scrollToBottom(messages.length <= 1 ? "auto" : "smooth");
  }, [messages.length, messages[messages.length - 1]?.id, scrollToBottom]);

  async function handleLoadOlder() {
    if (!hasMore || loadingOlderRef.current || messages.length === 0) return;
    loadingOlderRef.current = true;
    try {
      const oldest = messages[0];
      const result = await fetchMessages(thread.id, oldest.id);
      onMessagesLoaded(result.messages, result.hasMore, true);
    } finally {
      loadingOlderRef.current = false;
    }
  }

  async function handleSend(body: string) {
    const tempId = `pending-${Date.now()}`;
    const optimisticMessage: ChatMessageDto = {
      id: tempId,
      threadId: thread.id,
      senderId: currentUserId,
      kind: "user",
      body,
      createdAt: new Date().toISOString(),
      isMine: true,
      readBy: [currentUserId],
    };

    onMessageSent(optimisticMessage);
    scrollToBottom("auto");

    try {
      const message = await sendMessage(thread.id, body, locale);
      onMessageReplaced(tempId, message);
      scrollToBottom("smooth");
    } catch {
      onMessageFailed(tempId);
    }
  }

  async function handleSendVoiceNote(blob: Blob) {
    // A retry of the same recording reuses its finished upload, and the server
    // treats a resend with the same attachment URL as the original message.
    let uploaded = uploadedVoiceNotes.current.get(blob);
    const tempId = `pending-${Date.now()}`;
    const tempUrl = URL.createObjectURL(blob);
    const optimisticMessage: ChatMessageDto = {
      id: tempId,
      threadId: thread.id,
      senderId: currentUserId,
      kind: "user",
      body: "",
      attachmentUrl: tempUrl,
      attachmentMime: blob.type,
      createdAt: new Date().toISOString(),
      isMine: true,
      readBy: [currentUserId],
    };

    onMessageSent(optimisticMessage);
    scrollToBottom("auto");

    try {
      if (!uploaded) {
        uploaded = await uploadVoiceNote(thread.id, blob);
        uploadedVoiceNotes.current.set(blob, uploaded);
      }
      const message = await sendMessage(thread.id, "", locale, {
        url: uploaded.url,
        mime: uploaded.mimeType,
      });
      onMessageReplaced(tempId, message);
      scrollToBottom("smooth");
    } catch (error) {
      onMessageFailed(tempId);
      throw error; // composer shows the failure (and offers retry for voice notes)
    } finally {
      URL.revokeObjectURL(tempUrl);
    }
  }

  async function handleSendFile(file: File) {
    const tempId = `pending-${Date.now()}`;
    const tempUrl = URL.createObjectURL(file);
    const optimisticMessage: ChatMessageDto = {
      id: tempId,
      threadId: thread.id,
      senderId: currentUserId,
      kind: "user",
      body: "",
      attachmentUrl: tempUrl,
      attachmentMime: file.type,
      createdAt: new Date().toISOString(),
      isMine: true,
      readBy: [currentUserId],
    };

    onMessageSent(optimisticMessage);
    scrollToBottom("auto");

    try {
      const uploaded = await uploadChatFile(thread.id, file);
      const message = await sendMessage(thread.id, "", locale, {
        url: uploaded.url,
        mime: uploaded.mimeType,
      });
      onMessageReplaced(tempId, message);
      scrollToBottom("smooth");
    } catch (error) {
      onMessageFailed(tempId);
      throw error; // composer shows the failure (and offers retry for voice notes)
    } finally {
      URL.revokeObjectURL(tempUrl);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden overscroll-none bg-[#e5ddd5]">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-[#f0f2f5] px-3 py-3 sm:px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full p-2 text-slate-600 hover:bg-white md:hidden"
            aria-label={backLabel}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <ChatAvatar
          name={otherParticipant.name}
          avatarUrl={otherParticipant.avatarUrl}
          isDoctor={otherParticipant.role === "doctor"}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{otherParticipant.name}</p>
          <p className="truncate text-xs text-slate-500">
            {otherParticipant.subtitle}
          </p>
        </div>
        {thread.appointmentId && thread.scheduledStart && thread.scheduledEnd && (
          <VideoJoinLinkButton
            appointmentId={thread.appointmentId}
            scheduledStart={thread.scheduledStart}
            scheduledEnd={thread.scheduledEnd}
            label={t.chat.startConsultation}
            size="sm"
            urgent
          />
        )}
      </header>

      {isDoctorView && thread.appointmentId && (
        <div className="shrink-0 border-b border-slate-200 bg-[#f0f2f5] px-3 pb-2 sm:px-4">
          <DoctorIntakeSummary appointmentId={thread.appointmentId} />
        </div>
      )}

      <div
        ref={listRef}
        className="chat-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35) 0, transparent 45%), radial-gradient(circle at 80% 0%, rgba(15,167,155,0.08) 0, transparent 40%)",
        }}
        onScroll={(e) => {
          if (e.currentTarget.scrollTop < 80) {
            void handleLoadOlder();
          }
        }}
      >
        {loadingMessages ? null : (
          <div className="space-y-2">
            {hasMore && (
              <p className="text-center text-xs text-slate-500">Scroll up for older messages</p>
            )}
            {messages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>

      <ChatComposer
        onSend={handleSend}
        onSendVoiceNote={handleSendVoiceNote}
        onSendFile={handleSendFile}
        placeholder={placeholder}
        disabled={thread.isClosed}
      />
    </div>
  );
}
