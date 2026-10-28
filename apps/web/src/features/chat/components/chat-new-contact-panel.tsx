"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { cn } from "@zindagi/shared";
import type { ChatContactDto } from "@/features/chat/types";
import { createDirectThread, fetchContacts } from "@/features/chat/lib/chat-api";
import { ChatAvatar } from "./chat-avatar";

type ChatNewContactPanelProps = {
  title: string;
  searchPlaceholder: string;
  backLabel: string;
  emptyTitle: string;
  isDoctorView?: boolean;
  onBack: () => void;
  onThreadCreated: (threadId: string) => void;
};

export function ChatNewContactPanel({
  title,
  searchPlaceholder,
  backLabel,
  emptyTitle,
  isDoctorView = false,
  onBack,
  onThreadCreated,
}: ChatNewContactPanelProps) {
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<ChatContactDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const rows = await fetchContacts(q);
      setContacts(rows);
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

  async function handleSelect(contact: ChatContactDto) {
    if (contact.threadId) {
      onThreadCreated(contact.threadId);
      return;
    }

    setPending(contact.id);
    try {
      const thread = await createDirectThread(contact.id);
      onThreadCreated(thread.id);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-slate-200 bg-[#f0f2f5] px-3 py-4 sm:px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full p-2 text-slate-600 hover:bg-white"
            aria-label={backLabel}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="font-display text-lg font-semibold text-slate-900">{title}</h2>
        </div>
        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className={cn(
              "w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm",
              "outline-none focus:border-brand-light focus:ring-2 focus:ring-brand-muted",
            )}
          />
        </label>
      </div>

      <div className="chat-scroll min-h-0 flex-1 overflow-y-auto">
        {loading ? null : contacts.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">{emptyTitle}</div>
        ) : (
          contacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              disabled={pending === contact.id}
              onClick={() => void handleSelect(contact)}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <ChatAvatar
                name={contact.name}
                avatarUrl={contact.avatarUrl}
                isDoctor={!isDoctorView}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{contact.name}</p>
                <p className="truncate text-sm text-slate-500">{contact.subtitle}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
