"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@zindagi/shared";
import { fetchThreads } from "@/features/chat/lib/chat-api";
import {
  DOCTOR_WORKSPACE_ACTIONS,
  doctorNavBadgeCount,
  summaryToNavStats,
  type DoctorNavStats,
} from "@/features/doctor/data/doctor-workspace-nav";
import { CHAT_UNREAD_EVENT } from "@/lib/chat/unread-events";
import type { DoctorDashboardSummary } from "@/server/services/doctor-dashboard.service";

const SHORT_LABELS: Record<string, string> = {
  "/doctor/messages": "Messages",
  "/doctor/patients": "Patients",
  "/doctor/requests": "Requests",
  "/doctor/urgent-calls": "Urgent",
  "/doctor/prescriptions": "Rx",
  "/doctor/sunday-consult": "Sunday",
  "/doctor/home-visits": "Visits",
};

type Props = {
  className?: string;
};

export function DoctorMobilePracticeNav({ className }: Props) {
  const [stats, setStats] = useState<DoctorNavStats>({
    unreadMessages: 0,
    pendingRequests: 0,
    sundayQueue: 0,
    homeVisits: 0,
    urgentCalls: 0,
  });

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const [unreadMessages, summaryRes] = await Promise.all([
        fetchThreads()
          .then((threads) =>
            threads.reduce((sum, t) => sum + (t.unreadCount ?? 0), 0),
          )
          .catch(() => 0),
        fetch("/api/v1/doctor/summary")
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
      ]);

      if (cancelled) return;

      const summary = summaryRes?.success
        ? (summaryRes.data as DoctorDashboardSummary)
        : null;

      if (summary) {
        setStats(summaryToNavStats(summary, unreadMessages));
      } else {
        setStats((prev) => ({ ...prev, unreadMessages }));
      }
    };

    void refresh();

    const onChatUnread = (event: Event) => {
      const total = (event as CustomEvent<{ total: number }>).detail?.total;
      if (typeof total === "number") {
        setStats((prev) => ({ ...prev, unreadMessages: total }));
      }
    };

    window.addEventListener(CHAT_UNREAD_EVENT, onChatUnread);
    return () => {
      cancelled = true;
      window.removeEventListener(CHAT_UNREAD_EVENT, onChatUnread);
    };
  }, []);

  return (
    <nav
      aria-label="Practice shortcuts"
      className={cn(className)}
    >
      <ul className="flex gap-0.5 overflow-x-auto px-2 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-3">
        {DOCTOR_WORKSPACE_ACTIONS.map((item) => {
          const Icon = item.icon;
          const badge = doctorNavBadgeCount(item, stats);
          const shortLabel = SHORT_LABELS[item.href] ?? item.label;

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                title={item.label}
                aria-label={
                  badge !== null ? `${item.label}, ${badge} pending` : item.label
                }
                className="relative flex w-[3.75rem] flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 text-slate-600 transition-colors hover:bg-slate-100 hover:text-brand active:bg-slate-200 sm:w-16"
              >
                <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                  <Icon className="h-3.5 w-3.5" />
                  {badge !== null && (
                    <span className="absolute -right-1 -top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-brand px-0.5 text-[8px] font-bold leading-none text-white tabular-nums">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate text-[9px] font-medium leading-none sm:text-[10px]">
                  {shortLabel}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
