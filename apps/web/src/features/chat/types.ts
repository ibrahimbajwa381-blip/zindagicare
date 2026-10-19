export type ChatParticipantDto = {
  id: string;
  name: string;
  avatarUrl?: string;
  role: "doctor" | "patient";
  subtitle?: string;
};

export type ChatThreadDto = {
  id: string;
  type: string;
  appointmentId?: string;
  /** Present only when appointmentId refers to an online/urgent-online consult. */
  appointmentType?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount: number;
  isClosed: boolean;
  otherParticipant: ChatParticipantDto;
};

export type ChatMessageDto = {
  id: string;
  threadId: string;
  /** Absent for system (assistant) messages. */
  senderId?: string;
  kind?: "user" | "system";
  body: string;
  attachmentUrl?: string;
  attachmentMime?: string;
  createdAt: string;
  isMine: boolean;
  readBy: string[];
};

export type ChatContactDto = {
  id: string;
  name: string;
  avatarUrl?: string;
  subtitle?: string;
  threadId?: string;
};

/** Read-only doctor–patient transcript shown to admins (they are not thread participants). */
export type AdminChatTranscriptDto = {
  threadId: string | null;
  messages: {
    id: string;
    sender: "patient" | "doctor" | "system";
    body: string;
    attachmentUrl?: string;
    attachmentMime?: string;
    createdAt: string;
  }[];
  /** True when older messages were cut off by the limit. */
  truncated: boolean;
};
