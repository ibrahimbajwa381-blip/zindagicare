"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquarePlus, Sparkles } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import type { CopilotMessageDto, CopilotSessionDto } from "@/features/copilot/types";
import {
  createCopilotSession,
  fetchCopilotMessages,
  fetchCopilotSessions,
} from "@/features/copilot/lib/copilot-api";
import { CopilotConversation } from "./copilot-conversation";
import { useLocale } from "@/i18n/locale-provider";

type CopilotCopy = {
  newChat: string;
  emptyTitle: string;
  emptyDescription: string;
  selectChatTitle: string;
  selectChatDescription: string;
  messagePlaceholder: string;
  disclaimer: string;
  bookConsultation: string;
  consultationFee: string;
  pmdcVerified: string;
  urgentTitle: string;
  urgentDescription: string;
  urgentCta: string;
  emergencyTitle: string;
  emergencyBody: string;
  urgentBannerTitle: string;
  urgentBannerBody: string;
  callEmergency: string;
  thinking: string;
  checkingTools: string;
  retry: string;
  loading: string;
  micLabel: string;
  stopMicLabel: string;
  doctorReferralTitle: string;
  slotsAvailable: string;
  bookedConfirmedTitle: string;
  bookedPendingTitle: string;
  bookedPendingDescription: string;
  payNow: string;
  viewDashboard: string;
  viewProfile: string;
};

type CopilotAppProps = {
  copy: CopilotCopy;
  fillViewport?: boolean;
};

export function CopilotApp({ copy, fillViewport = false }: CopilotAppProps) {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const pendingMessage = searchParams.get("message")?.trim() || undefined;
  const [sessions, setSessions] = useState<CopilotSessionDto[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<CopilotMessageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchCopilotSessions();
      setSessions(rows);
      if (rows.length > 0 && !activeSessionId) {
        setActiveSessionId(rows[0]?.id);
      }
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [activeSessionId]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoadingMessages(true);
    void fetchCopilotMessages(activeSessionId)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  const startNewChat = async () => {
    const session = await createCopilotSession(locale);
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    const rows = await fetchCopilotMessages(session.id);
    setMessages(rows);
  };

  const ensureSession = async () => {
    if (activeSessionId) return;
    await startNewChat();
  };

  useEffect(() => {
    if (!loading && sessions.length === 0) {
      void startNewChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sessions.length]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden bg-white lg:flex-row",
        fillViewport
          ? "h-full flex-1"
          : "min-h-[calc(100dvh-12rem)] rounded-2xl border border-slate-200/80 shadow-premium",
      )}
    >
      <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200/80 bg-gradient-to-b from-brand-muted/30 to-white lg:flex">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-sm font-semibold text-slate-900">{copy.newChat}</p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="rounded-xl text-brand hover:bg-brand-muted hover:text-brand-dark"
            onClick={() => void startNewChat()}
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <div className="chat-scroll min-h-0 flex-1 overflow-y-auto p-2.5">
          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">{copy.loading}</p>
          ) : sessions.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">{copy.emptyDescription}</p>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setActiveSessionId(session.id)}
                className={cn(
                  "mb-1.5 w-full rounded-xl border px-3 py-3 text-left text-sm transition-all",
                  activeSessionId === session.id
                    ? "border-brand-light/50 bg-brand-muted/80 text-brand-dark shadow-sm"
                    : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-white hover:shadow-sm",
                )}
              >
                <p className="line-clamp-2 font-medium leading-snug">
                  {session.title ?? copy.emptyTitle}
                </p>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!activeSessionId || loadingMessages ? (
          <div className="copilot-chat-bg flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-lg shadow-brand/25">
              <Sparkles className="h-8 w-8" aria-hidden />
            </span>
            <h2 className="font-display text-xl font-semibold text-slate-900">
              {copy.selectChatTitle}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
              {copy.selectChatDescription}
            </p>
            <Button
              type="button"
              className="mt-7 rounded-full px-6 shadow-md shadow-brand/20"
              onClick={() => void ensureSession()}
            >
              {copy.newChat}
            </Button>
          </div>
        ) : (
          <CopilotConversation
            key={activeSessionId}
            sessionId={activeSessionId}
            initialMessages={messages}
            pendingMessage={pendingMessage}
            copy={copy}
          />
        )}
      </div>
    </div>
  );
}
