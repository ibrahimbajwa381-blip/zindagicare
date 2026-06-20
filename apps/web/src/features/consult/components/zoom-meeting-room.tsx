"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import type { VideoJoinPayload } from "@/features/consult/types";
import { getWhatsAppSupportUrl } from "@/lib/support-contact";
import { useOptionalLocale, useTranslations } from "@/i18n/locale-provider";

type Props = {
  appointmentId: string;
  payload: VideoJoinPayload;
  onLeave: () => void;
};

/** Embedded Zoom via isolated iframe (Zoom CDN + React 18), stays on ZindagiCare. */
export function ZoomMeetingRoom({ appointmentId, payload, onLeave }: Props) {
  const t = useTranslations();
  const copy = t.consult.videoSession;
  const locale = useOptionalLocale();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const joinSentRef = useRef(false);
  const joinedRecordedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const uiCopy = useMemo(
    () => ({
      gettingReady: copy.gettingReady,
      couldNotJoinTitle: copy.couldNotJoinTitle,
      pleaseTryAgain: copy.pleaseTryAgain,
      errors: {
        generic: copy.errors.generic,
        timeout: copy.errors.timeout,
        sdkLoad: copy.errors.sdkLoad,
      },
    }),
    [copy],
  );

  const supportUrl = getWhatsAppSupportUrl(copy.supportPrefill);

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
          locale,
          uiCopy,
        },
      },
      window.location.origin,
    );
  }, [appointmentId, locale, payload, uiCopy]);

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
        const raw = event.data.message ?? "";
        const message =
          raw.includes("allowlist") || raw.includes("timed out")
            ? copy.errors.timeout
            : raw.includes("SDK failed to load")
              ? copy.errors.sdkLoad
              : raw.includes("permission") || raw.includes("Permission")
                ? copy.errors.permissions
                : copy.errors.generic;
        setError(message);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [appointmentId, copy.errors, sendJoinToFrame]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="max-w-md text-sm text-red-600">{error}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            onClick={() => {
              setError(null);
              joinSentRef.current = false;
              sendJoinToFrame();
            }}
          >
            {copy.tryAgain}
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => void onLeave()}
          >
            {copy.leave}
          </button>
        </div>
        <a
          href={supportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-dark"
        >
          <MessageCircle className="h-4 w-4" />
          {copy.contactSupport}
        </a>
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
