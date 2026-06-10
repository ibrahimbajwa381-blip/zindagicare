"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoJoinPayload } from "@/features/consult/types";

type Props = {
  appointmentId: string;
  payload: VideoJoinPayload;
  onLeave: () => void;
};

export function ZoomMeetingRoom({ appointmentId, payload, onLeave }: Props) {
  const [status, setStatus] = useState<"loading" | "joined" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function startMeeting() {
      try {
        const { ZoomMtg } = await import("@zoom/meetingsdk");
        if (cancelled) return;

        ZoomMtg.preLoadWasm();
        ZoomMtg.prepareWebSDK();

        const leaveUrl = `${window.location.origin}/consult/video/${appointmentId}?left=1`;

        ZoomMtg.init({
          leaveUrl,
          patchJsMedia: true,
          disableInvite: true,
          success: () => {
            ZoomMtg.join({
              signature: payload.signature,
              meetingNumber: payload.meetingNumber,
              userName: payload.userName,
              sdkKey: payload.sdkKey,
              passWord: payload.passcode,
              success: async () => {
                if (!joinedRef.current) {
                  joinedRef.current = true;
                  await fetch(`/api/v1/video/sessions/${appointmentId}/joined`, {
                    method: "POST",
                  });
                }
                if (!cancelled) setStatus("joined");
              },
              error: (error: { reason?: string; message?: string }) => {
                if (!cancelled) {
                  setStatus("error");
                  setErrorMessage(error?.reason ?? error?.message ?? "Could not join meeting");
                }
              },
            });
          },
          error: (error: { reason?: string; message?: string }) => {
            if (!cancelled) {
              setStatus("error");
              setErrorMessage(error?.reason ?? error?.message ?? "Could not initialize video");
            }
          },
        });
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : "Video SDK failed to load");
        }
      }
    }

    startMeeting();

    return () => {
      cancelled = true;
    };
  }, [appointmentId, payload]);

  if (status === "error") {
    const fallbackUrl = payload.role === "doctor" ? payload.startUrl : payload.joinUrl;
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="font-medium text-amber-900">Could not start embedded video</p>
        <p className="mt-2 text-sm text-amber-800">{errorMessage}</p>
        {fallbackUrl && (
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            onClick={() => onLeave()}
          >
            Open in Zoom app
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-slate-500">
        {status === "loading"
          ? "Connecting to your secure video room…"
          : "You are in the consultation. Use Zoom controls to mute, turn video on/off, or leave."}
      </p>
      <div id="zmmtg-root" className="min-h-[70vh] w-full" />
    </div>
  );
}
