"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { postCallRingAction, type CallRingStatus } from "@/features/consult/incoming-call";

/** Re-ring cadence: each push makes the other phone alert again. */
const RE_RING_INTERVAL_MS = 7_000;
/** Matches CALL_RING_TIMEOUT_MS on the server, plus a little slack. */
const RING_TIMEOUT_MS = 47_000;

export type OutgoingRingState = "idle" | "ringing" | "answered" | "declined" | "missed";

/** Rings the other participant of a video consult until they answer, decline or it times out. */
export function useOutgoingCallRing(appointmentId: string) {
  const [state, setState] = useState<OutgoingRingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const ringIdRef = useRef<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const deadlineRef = useRef(0);

  const stopTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const settle = useCallback(
    (status: CallRingStatus) => {
      if (status === "ringing") return;
      stopTimer();
      ringIdRef.current = null;
      setState(status === "cancelled" ? "idle" : status);
    },
    [stopTimer],
  );

  const ringOnce = useCallback(async () => {
    const res = await postCallRingAction(appointmentId, {
      action: "ring",
      ringId: ringIdRef.current ?? undefined,
    });
    const json = (await res.json()) as {
      success?: boolean;
      data?: { ringId: string; status: CallRingStatus };
      error?: { message?: string };
    };
    if (!json.success || !json.data) {
      throw new Error(json.error?.message ?? "Could not ring right now.");
    }
    return json.data;
  }, [appointmentId]);

  const start = useCallback(async () => {
    if (ringIdRef.current) return;
    setError(null);
    setState("ringing");
    try {
      const { ringId, status } = await ringOnce();
      ringIdRef.current = ringId;
      deadlineRef.current = Date.now() + RING_TIMEOUT_MS;
      if (status !== "ringing") {
        settle(status);
        return;
      }

      stopTimer();
      intervalRef.current = window.setInterval(() => {
        if (Date.now() > deadlineRef.current) {
          settle("missed");
          return;
        }
        void ringOnce().then(
          (result) => settle(result.status),
          () => undefined,
        );
      }, RE_RING_INTERVAL_MS);
    } catch (e) {
      ringIdRef.current = null;
      setState("idle");
      setError(e instanceof Error ? e.message : "Could not ring right now.");
    }
  }, [ringOnce, settle, stopTimer]);

  const cancel = useCallback(() => {
    const ringId = ringIdRef.current;
    stopTimer();
    ringIdRef.current = null;
    setState("idle");
    if (ringId) {
      void postCallRingAction(appointmentId, { action: "cancel", ringId }, { keepalive: true }).catch(
        () => undefined,
      );
    }
  }, [appointmentId, stopTimer]);

  // Outcome messages ("declined", "no answer") fade back to idle.
  useEffect(() => {
    if ((state === "idle" || state === "ringing") && !error) return;
    const timeout = window.setTimeout(() => {
      setError(null);
      setState((current) => (current === "ringing" ? current : "idle"));
    }, 6_000);
    return () => window.clearTimeout(timeout);
  }, [state, error]);

  // Leaving the call page stops the ring on the other side too.
  useEffect(() => {
    return () => {
      const ringId = ringIdRef.current;
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      if (ringId) {
        void postCallRingAction(appointmentId, { action: "cancel", ringId }, { keepalive: true }).catch(
          () => undefined,
        );
      }
    };
  }, [appointmentId]);

  return { state, error, start, cancel };
}
