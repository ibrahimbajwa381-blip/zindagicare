"use client";

import { useEffect, useState } from "react";
import { fetchThreads } from "@/features/chat/lib/chat-api";
import {
  summaryToNavStats,
  type DoctorNavStats,
} from "@/features/doctor/data/doctor-workspace-nav";
import { CHAT_UNREAD_EVENT } from "@/lib/chat/unread-events";
import type { DoctorDashboardSummary } from "@/server/services/doctor-dashboard.service";

const EMPTY_STATS: DoctorNavStats = {
  unreadMessages: 0,
  pendingRequests: 0,
  sundayQueue: 0,
  homeVisits: 0,
  urgentCalls: 0,
};

type StatsUpdate = (prev: DoctorNavStats) => DoctorNavStats;

const listeners = new Set<(update: StatsUpdate) => void>();
let inflight: Promise<void> | null = null;

/**
 * Fetch chat threads + /doctor/summary once and push the result to every
 * mounted doctor nav (sidebar and mobile practice nav), so concurrent callers
 * share one request instead of each firing their own.
 */
export function refreshDoctorNavStats(): Promise<void> {
  if (!inflight) {
    inflight = (async () => {
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

      const summary = summaryRes?.success
        ? (summaryRes.data as DoctorDashboardSummary)
        : null;

      const update: StatsUpdate = summary
        ? () => summaryToNavStats(summary, unreadMessages)
        : (prev) => ({ ...prev, unreadMessages });
      listeners.forEach((listener) => listener(update));
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/**
 * `refreshKey` (e.g. the pathname) re-fetches when it changes; `refreshOnFocus`
 * re-fetches when the window regains focus. Either way the request is shared.
 */
export function useDoctorNavStats({
  enabled = true,
  refreshOnFocus = false,
  refreshKey,
}: { enabled?: boolean; refreshOnFocus?: boolean; refreshKey?: string } = {}): DoctorNavStats {
  const [stats, setStats] = useState<DoctorNavStats>(EMPTY_STATS);

  useEffect(() => {
    if (!enabled) return;

    listeners.add(setStats);
    void refreshDoctorNavStats();

    const onFocus = () => {
      void refreshDoctorNavStats();
    };

    const onChatUnread = (event: Event) => {
      const total = (event as CustomEvent<{ total: number }>).detail?.total;
      if (typeof total === "number") {
        setStats((prev) => ({ ...prev, unreadMessages: total }));
      }
    };

    if (refreshOnFocus) window.addEventListener("focus", onFocus);
    window.addEventListener(CHAT_UNREAD_EVENT, onChatUnread);

    return () => {
      listeners.delete(setStats);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(CHAT_UNREAD_EVENT, onChatUnread);
    };
  }, [enabled, refreshOnFocus, refreshKey]);

  return stats;
}
