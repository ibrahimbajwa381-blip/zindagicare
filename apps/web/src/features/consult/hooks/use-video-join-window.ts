"use client";

import { useEffect, useState } from "react";
import { getVideoJoinWindow } from "@zindagi/shared";

/**
 * Join window for a video consult, re-evaluated every second. `now` is the
 * time of that evaluation (null until the first client tick, so server and
 * first client render match); read it instead of calling Date.now() while
 * rendering.
 */
export function useVideoJoinWindow(scheduledStart: string, scheduledEnd: string) {
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
      setJoinWindow({ ...getVideoJoinWindow(scheduledStart, scheduledEnd, now), now: now.getTime() });
    };
    refresh();
    const intervalId = window.setInterval(refresh, 1_000);
    return () => window.clearInterval(intervalId);
  }, [scheduledStart, scheduledEnd]);

  return joinWindow;
}
