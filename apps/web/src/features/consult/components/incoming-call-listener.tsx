"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PhoneOff, Video } from "lucide-react";
import { ChatAvatar } from "@/features/chat/components/chat-avatar";
import {
  INCOMING_CALL_MESSAGE,
  postCallRingAction,
  type IncomingCallRing,
} from "@/features/consult/incoming-call";
import { videoConsultPath } from "@/features/consult/paths";
import { startRingtone } from "@/features/consult/ringtone";
import { useEventSourceListener } from "@/lib/realtime/use-event-source";
import { useTranslations } from "@/i18n/locale-provider";

/** While ringing, re-check so a cancel/timeout on another server instance still stops it. */
const RINGING_POLL_MS = 4_000;

async function fetchIncomingRing(): Promise<IncomingCallRing | null> {
  const res = await fetch("/api/v1/video/ring/incoming", { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { success?: boolean; data?: IncomingCallRing | null };
  return json.success ? (json.data ?? null) : null;
}

/**
 * WhatsApp-style incoming call screen for video consults. Mounted once for
 * every signed-in user; learns about rings from the realtime stream and from
 * the service worker (push), and shows a full-screen ringing overlay.
 */
export function IncomingCallListener() {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const [ring, setRing] = useState<IncomingCallRing | null>(null);
  const handledRef = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    const next = await fetchIncomingRing().catch(() => null);
    setRing(next && !handledRef.current.has(next.ringId) ? next : null);
  }, []);

  useEventSourceListener(signedIn ? "/api/v1/video/ring/events" : null, () => {
    void refresh();
  });

  useEffect(() => {
    if (!signedIn || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === INCOMING_CALL_MESSAGE) {
        void refresh();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [signedIn, refresh]);

  useEffect(() => {
    if (!ring) return;
    const interval = window.setInterval(() => void refresh(), RINGING_POLL_MS);
    return () => window.clearInterval(interval);
  }, [ring, refresh]);

  if (!ring) return null;

  return (
    <IncomingCallOverlay
      ring={ring}
      onDone={() => {
        handledRef.current.add(ring.ringId);
        setRing(null);
      }}
    />
  );
}

function IncomingCallOverlay({ ring, onDone }: { ring: IncomingCallRing; onDone: () => void }) {
  const t = useTranslations();
  const copy = t.consult.callRing;
  const router = useRouter();
  const pathname = usePathname();
  const callPath = videoConsultPath(ring.appointmentId);
  const alreadyOnCallPage = pathname === callPath;

  useEffect(() => {
    if (alreadyOnCallPage) return;
    return startRingtone();
  }, [alreadyOnCallPage]);

  // Already on this consult's call page: the page joins (and answers) by itself.
  if (alreadyOnCallPage) return null;

  const accept = () => {
    onDone();
    router.push(callPath);
  };

  const decline = () => {
    onDone();
    void postCallRingAction(ring.appointmentId, { action: "decline", ringId: ring.ringId }).catch(
      () => undefined,
    );
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="incoming-call-name"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b from-slate-900 via-slate-900 to-brand-dark px-6 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))] text-white"
    >
      <div className="flex flex-col items-center text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-white/70">
          {copy.incomingTitle}
        </p>
        <div className="relative mt-10">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand-light/30" aria-hidden />
          <ChatAvatar
            name={ring.fromName}
            avatarUrl={ring.fromAvatarUrl ?? undefined}
            isDoctor={ring.fromRole === "doctor"}
            className="relative h-28 w-28 text-3xl ring-4 ring-white/20"
          />
        </div>
        <h2 id="incoming-call-name" className="mt-8 font-display text-2xl font-semibold">
          {ring.fromName}
        </h2>
        <p className="mt-2 max-w-xs text-sm text-white/70">
          {ring.fromRole === "doctor" ? copy.incomingFromDoctor : copy.incomingFromPatient}
        </p>
      </div>

      <div className="flex w-full max-w-xs items-center justify-between">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={decline}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-lg transition hover:bg-red-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-300"
            aria-label={copy.decline}
          >
            <PhoneOff className="h-7 w-7" />
          </button>
          <span className="text-sm text-white/80">{copy.decline}</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={accept}
            className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-emerald-500 shadow-lg transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
            aria-label={copy.accept}
          >
            <Video className="h-7 w-7" />
          </button>
          <span className="text-sm text-white/80">{copy.accept}</span>
        </div>
      </div>
    </div>
  );
}
