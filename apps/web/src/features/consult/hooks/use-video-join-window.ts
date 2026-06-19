"use client";

import { useEffect, useState } from "react";
import { getVideoJoinWindow } from "@zindagi/shared";

export function useVideoJoinWindow(scheduledStart: string, scheduledEnd: string) {
  const [joinWindow, setJoinWindow] = useState(() =>
    getVideoJoinWindow(scheduledStart, scheduledEnd),
  );

  useEffect(() => {
    const refresh = () => setJoinWindow(getVideoJoinWindow(scheduledStart, scheduledEnd));
    refresh();
    const intervalId = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(intervalId);
  }, [scheduledStart, scheduledEnd]);

  return joinWindow;
}
