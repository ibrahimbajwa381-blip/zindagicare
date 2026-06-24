"use client";

import { useCallback, useEffect, useState } from "react";
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

export function PatientDashboardMessagesSection() {
  const router = useRouter();
  const t = useTranslations();
  const m = t.dashboard.messages;
  const c = t.chat;

  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<MergedContact[]>([]);
  const [loading, setLoading] = useState(true);

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
    const timer = setTimeout(() => {
      void load(search.trim() || undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [load, search]);

  function handleSelect(contact: MergedContact) {
    router.push(`/messages?doctor=${contact.id}`);
  }

  return (
    <Card
      className={cn(
        surfaceCard,
        "flex h-full flex-col max-md:overflow-visible max-md:shadow-sm md:overflow-hidden md:shadow-premium border-slate-200 p-0",
      )}
    >
      <CardHeader className="shrink-0 space-y-3 border-b border-slate-200/80 bg-[#f0f2f5] px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand">
              <MessageSquare className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">{t.dashboard.nav.messages}</CardTitle>
              <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">{m.description}</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={siteConfig.links.messages}>{m.viewAll}</Link>
          </Button>
        </div>
        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={c.searchPlaceholder}
            className={cn(
              "w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm",
              "outline-none focus:border-brand-light focus:ring-2 focus:ring-brand-muted",
            )}
          />
        </label>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">
        {loading ? (
          <LoadingScreen message={m.loading} size="md" />
        ) : contacts.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="font-medium text-slate-700">{c.emptyTitle}</p>
            <p className="mt-1 text-sm text-slate-500">{c.emptyDescription}</p>
          </div>
        ) : (
          <ul>
            {contacts.map((contact) => {
              const hasUnread = contact.unreadCount > 0;
              return (
              <li key={contact.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(contact)}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 sm:px-6"
                >
                  <ChatAvatar
                    name={contact.name}
                    avatarUrl={contact.avatarUrl}
                    isDoctor
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "truncate text-slate-900",
                          hasUnread ? "font-bold" : "font-semibold",
                        )}
                      >
                        {contact.name}
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {contact.lastMessageAt && (
                          <span
                            className={cn(
                              "text-xs",
                              hasUnread ? "font-semibold text-brand" : "text-slate-500",
                            )}
                          >
                            {formatPreviewTime(contact.lastMessageAt)}
                          </span>
                        )}
                        {hasUnread && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold leading-none text-white">
                            {contact.unreadCount > 99 ? "99+" : contact.unreadCount}
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
                        {contact.lastMessagePreview || contact.subtitle || m.tapToChat}
                      </p>
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
