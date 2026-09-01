import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getNotificationSummary, type NotificationSummaryDto } from "@/api/notifications";

const POLL_MS = 30_000;

/** Polls the combined notification + chat unread counts while a tab layout is focused. */
export function useUnreadSummary() {
  const [summary, setSummary] = useState<NotificationSummaryDto | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = () => {
        getNotificationSummary()
          .then((res) => {
            if (!cancelled) setSummary(res);
          })
          .catch(() => {});
      };
      load();
      const interval = setInterval(load, POLL_MS);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }, []),
  );

  return summary;
}
