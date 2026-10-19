"use client";

import { useEffect, useState } from "react";
import { getSundayFreeJoinWindow, getVideoJoinWindow } from "@zindagi/shared";

/**
 * Join window for a video consult, re-evaluated every second. `now` is the
 * time of that evaluation (null until the first client tick, so server and
 * first client render match); read it instead of calling Date.now() while
 * rendering. `openUntilClosed` (Sunday free consults) keeps the room open
 * until the doctor finishes the consultation.
 */
export function useVideoJoinWindow(
  scheduledStart: string,
  scheduledEnd: string,
  openUntilClosed = false,
) {
  const [joinWindow, setJoinWindow] = useState(() => {
    const start = new Date(scheduledStart);
    const end = new Date(scheduledEnd);
    return {
      joinOpensAt: start,
      joinClosesAt: end,
      canJoin: false,
      now: null as number | null,
    };
  });

  useEffect(() => {
    const refresh = () => {
      const now = new Date();
      const next = openUntilClosed
        ? getSundayFreeJoinWindow(scheduledStart, now)
        : getVideoJoinWindow(scheduledStart, scheduledEnd, now);
      setJoinWindow({ ...next, now: now.getTime() });
    };
    refresh();
    const intervalId = window.setInterval(refresh, 1_000);
    return () => window.clearInterval(intervalId);
  }, [scheduledStart, scheduledEnd, openUntilClosed]);

  return joinWindow;
}
