"use client";

import { useEffect, useState } from "react";
import { getVideoJoinWindow } from "@zindagi/shared";

export function useVideoJoinWindow(scheduledStart: string, scheduledEnd: string) {
  const [joinWindow, setJoinWindow] = useState(() => {
    const start = new Date(scheduledStart);
    const end = new Date(scheduledEnd);
    return {
      joinOpensAt: start,
      joinClosesAt: end,
      canJoin: false,
    };
  });

  useEffect(() => {
    const refresh = () => setJoinWindow(getVideoJoinWindow(scheduledStart, scheduledEnd));
    refresh();
    const intervalId = window.setInterval(refresh, 1_000);
    return () => window.clearInterval(intervalId);
  }, [scheduledStart, scheduledEnd]);

  return joinWindow;
}
