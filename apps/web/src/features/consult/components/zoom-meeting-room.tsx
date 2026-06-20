"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoJoinPayload } from "@/features/consult/types";

type Props = {
  appointmentId: string;
  payload: VideoJoinPayload;
  onLeave: () => void;
};

/** Embedded Zoom via isolated iframe (Zoom CDN + React 18), stays on ZindagiCare. */
export function ZoomMeetingRoom({ appointmentId, payload, onLeave }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const joinSentRef = useRef(false);
  const joinedRecordedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const sendJoinToFrame = useCallback(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame || joinSentRef.current) return;

    joinSentRef.current = true;
    frame.postMessage(
      {
        type: "zindagi-zoom-join",
        payload: {
          signature: payload.signature,
          meetingNumber: payload.meetingNumber,
          userName: payload.userName,
          sdkKey: payload.sdkKey,
          passcode: payload.passcode,
          meetingTitle: payload.meetingTitle,
          leaveUrl: `${window.location.origin}/consult/video/${appointmentId}?left=1`,
        },
      },
      window.location.origin,
    );
  }, [appointmentId, payload]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "zindagi-zoom-ready") {
        sendJoinToFrame();
      }

      if (event.data?.type === "zindagi-zoom-joined" && !joinedRecordedRef.current) {
        joinedRecordedRef.current = true;
        void fetch(`/api/v1/video/sessions/${appointmentId}/joined`, { method: "POST" });
      }

      if (event.data?.type === "zindagi-zoom-error") {
        const message =
          event.data.message ??
          "Could not join video room. If you changed domains, add this site to your Zoom SDK allowlist.";
        setError(message);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [appointmentId, sendJoinToFrame]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white"
          onClick={() => {
            setError(null);
            joinSentRef.current = false;
            sendJoinToFrame();
          }}
        >
          Try again
        </button>
        <button
          type="button"
          className="text-sm text-slate-500 underline"
          onClick={() => void onLeave()}
        >
          Leave
        </button>
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src="/zoom/meeting.html"
      title="ZindagiCare video consultation"
      className="h-full min-h-0 w-full flex-1 border-0 bg-slate-900"
      allow="camera; microphone; fullscreen; display-capture; autoplay"
    />
  );
}
