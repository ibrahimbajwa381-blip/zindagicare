"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Search } from "lucide-react";
import { cn } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { ChatAvatar } from "@/features/chat/components/chat-avatar";
import { fetchContacts, fetchThreads } from "@/features/chat/lib/chat-api";
import type { ChatContactDto, ChatThreadDto } from "@/features/chat/types";
import { useTranslations } from "@/i18n/locale-provider";
import { surfaceCard } from "@/lib/ui/surfaces";

type MergedContact = ChatContactDto & {
  lastMessagePreview?: string;
  lastMessageAt?: string;
  unreadCount: number;
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

function mergeContactsWithThreads(
  contactRows: ChatContactDto[],
  threadRows: ChatThreadDto[],
): MergedContact[] {
  const threadByParticipant = new Map<string, ChatThreadDto>();
  for (const thread of threadRows) {
    const key = thread.otherParticipant.id;
    const existing = threadByParticipant.get(key);
    if (!existing) {
      threadByParticipant.set(key, thread);
      continue;
    }

    const existingTime = existing.lastMessageAt
      ? new Date(existing.lastMessageAt).getTime()
      : 0;
    const threadTime = thread.lastMessageAt
      ? new Date(thread.lastMessageAt).getTime()
      : 0;
    if (threadTime > existingTime) {
      threadByParticipant.set(key, thread);
    }
  }

  const merged = contactRows.map((contact) => {
    const thread = threadByParticipant.get(contact.id);
    return {
      ...contact,
      threadId: contact.threadId ?? thread?.id,
      lastMessagePreview: thread?.lastMessagePreview,
      lastMessageAt: thread?.lastMessageAt,
      unreadCount: thread?.unreadCount ?? 0,
    };
  });

  return merged.sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    return a.name.localeCompare(b.name);
  });
}

export function PatientDashboardMessagesSection({
  initialContacts,
  initialThreads,
}: {
  initialContacts?: ChatContactDto[];
  initialThreads?: ChatThreadDto[];
}) {
  const router = useRouter();
  const t = useTranslations();
  const m = t.dashboard.messages;
  const c = t.chat;

  const hasInitialData = initialContacts != null && initialThreads != null;
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<MergedContact[]>(() =>
    hasInitialData
      ? mergeContactsWithThreads(initialContacts, initialThreads)
      : [],
  );
  const [loading, setLoading] = useState(!hasInitialData);
  const initialLoadDone = useRef(hasInitialData);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const [contactRows, threadRows] = await Promise.all([
        fetchContacts(q),
        fetchThreads(),
      ]);
      setContacts(mergeContactsWithThreads(contactRows, threadRows));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const query = search.trim() || undefined;
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      void load(query);
      return;
    }

    if (hasInitialData && !query) {
      return;
    }

    const timer = setTimeout(() => {
      void load(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [hasInitialData, load, search]);

  function handleSelect(contact: MergedContact) {
    router.push(`/messages?doctor=${contact.id}`);
  }

  return (
    <Card
      className={cn(
        surfaceCard,
        "flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden border-slate-200 p-0 shadow-sm md:shadow-premium",
      )}
    >
      <CardHeader className="shrink-0 space-y-3 border-b border-slate-200/80 bg-[#f0f2f5] px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand sm:size-10">
              <MessageSquare className="size-4 sm:size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{t.dashboard.nav.messages}</CardTitle>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 sm:line-clamp-1 sm:text-sm">
                {m.description}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="h-8 shrink-0 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm">
            <Link href={siteConfig.links.messages}>{m.viewAll}</Link>
          </Button>
        </div>
        <label className="relative block min-w-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={c.searchPlaceholder}
            className={cn(
              "w-full min-w-0 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm",
              "outline-none focus:border-brand-light focus:ring-2 focus:ring-brand-muted",
            )}
          />
        </label>
      </CardHeader>

      <CardContent className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-0">
        {loading ? (
          <LoadingScreen message={m.loading} size="md" />
        ) : contacts.length === 0 ? (
          <div className="px-4 py-10 text-center sm:px-6">
            <p className="font-medium text-slate-700">{c.emptyTitle}</p>
            <p className="mt-1 text-sm text-slate-500">{c.emptyDescription}</p>
          </div>
        ) : (
          <ul className="min-w-0">
            {contacts.map((contact) => {
              const hasUnread = contact.unreadCount > 0;
              return (
              <li key={contact.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => handleSelect(contact)}
                  className="flex w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden border-b border-slate-100 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 sm:gap-3 sm:px-6 sm:py-3"
                >
                  <ChatAvatar
                    name={contact.name}
                    avatarUrl={contact.avatarUrl}
                    isDoctor
                    size="sm"
                    className="sm:h-12 sm:w-12"
                  />
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
                      <p
                        className={cn(
                          "truncate text-sm text-slate-900 sm:text-base",
                          hasUnread ? "font-bold" : "font-semibold",
                        )}
                      >
                        {contact.name}
                      </p>
                      {contact.lastMessageAt ? (
                        <span
                          className={cn(
                            "shrink-0 text-[11px] whitespace-nowrap sm:text-xs",
                            hasUnread ? "font-semibold text-brand" : "text-slate-500",
                          )}
                        >
                          {formatPreviewTime(contact.lastMessageAt)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-2">
                      <p
                        className={cn(
                          "min-w-0 flex-1 truncate text-xs sm:text-sm",
                          hasUnread ? "font-medium text-slate-800" : "text-slate-500",
                        )}
                      >
                        {contact.lastMessagePreview || contact.subtitle || m.tapToChat}
                      </p>
                      {hasUnread ? (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold leading-none text-white sm:text-[11px]">
                          {contact.unreadCount > 99 ? "99+" : contact.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
