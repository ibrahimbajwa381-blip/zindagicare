"use client";

import type { Dictionary } from "@/i18n/dictionaries/en";
import { ChatApp } from "@/features/chat/components/chat-app";

type Props = {
  currentUserId: string;
  initialParticipantId?: string;
  copy: Dictionary["chat"];
  embedded?: boolean;
  fillViewport?: boolean;
};

export function DoctorWorkspaceMessages({
  currentUserId,
  initialParticipantId,
  copy,
  embedded = false,
  fillViewport = false,
}: Props) {
  return (
    <ChatApp
      embedded={embedded}
      fillViewport={fillViewport}
      currentUserId={currentUserId}
      isDoctorView
      initialParticipantId={initialParticipantId}
      copy={{
        title: copy.title,
        searchPlaceholder: copy.searchPlaceholder,
        emptyTitle: copy.emptyTitle,
        emptyDescription: copy.emptyDescription,
        newChatLabel: copy.newChatLabel,
        newChatTitle: copy.newChatTitle,
        newChatSearchPlaceholder: copy.doctorNewChatSearchPlaceholder,
        newChatEmpty: copy.doctorNewChatEmpty,
        selectChatTitle: copy.selectChatTitle,
        selectChatDescription: copy.doctorSelectChatDescription,
        messagePlaceholder: copy.messagePlaceholder,
        backLabel: copy.backLabel,
      }}
    />
  );
}
