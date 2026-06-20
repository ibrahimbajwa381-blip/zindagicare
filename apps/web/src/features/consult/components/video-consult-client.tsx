"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { SiteLogo } from "@/components/layout/site-logo";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, FileText, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { InCallPrescriptionPanel } from "@/features/prescriptions/components/in-call-prescription-panel";
import {
  formatConsultParticipantLine,
  ZOOM_CONSULT_MEETING_TITLE,
} from "@/lib/zoom/branding";
import { CountdownTimer } from "@/features/sunday-consult/components/countdown-timer";
import { PostConsultReviewPrompt } from "@/features/consult/components/post-consult-review-prompt";
import type { VideoJoinPayload } from "@/features/consult/types";

const ZoomMeetingRoom = dynamic(
  () =>
    import("./zoom-meeting-room").then((mod) => ({ default: mod.ZoomMeetingRoom })),
  { ssr: false },
);

type SessionStatus = {
  appointmentId: string;
  role: "patient" | "doctor";
  appointmentStatus: string;
  videoStatus: string;
  canJoin: boolean;
  joinOpensAt: string;
  joinClosesAt: string;
  scheduledStart: string;
  scheduledEnd: string;
  zoomConfigured: boolean;
};

type Props = {
  appointmentId: string;
  leftSession?: boolean;
};

export function VideoConsultClient({ appointmentId, leftSession }: Props) {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [joinPayload, setJoinPayload] = useState<VideoJoinPayload | null>(null);
  const [inCall, setInCall] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPostConsultReview, setShowPostConsultReview] = useState(leftSession ?? false);
  const [showDoctorPostConsult, setShowDoctorPostConsult] = useState(false);
  const [rxPanelOpen, setRxPanelOpen] = useState(false);
  const joinAttemptedRef = useRef(false);

  const dashboardHref =
    sessionStatus?.role === "doctor" ? "/doctor/sunday-consult" : siteConfig.links.dashboard;

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/video/sessions/${appointmentId}`);
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "Could not load session");
      }
      setSessionStatus(json.data as SessionStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  const startCall = useCallback(async () => {
    if (joining || inCall) return;
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/video/sessions/${appointmentId}/join`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "Could not join session");
      }
      setJoinPayload(json.data as VideoJoinPayload);
      setInCall(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
      joinAttemptedRef.current = false;
    } finally {
      setJoining(false);
    }
  }, [appointmentId, inCall, joining]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!sessionStatus || sessionStatus.canJoin) return;
    const interval = window.setInterval(loadStatus, 30_000);
    return () => window.clearInterval(interval);
  }, [sessionStatus, loadStatus]);

  /** Single-click flow: auto-join as soon as the room window opens. */
  useEffect(() => {
    if (!sessionStatus?.canJoin || inCall || joining || joinAttemptedRef.current) return;
    joinAttemptedRef.current = true;
    void startCall();
  }, [sessionStatus?.canJoin, inCall, joining, startCall]);

  const handleLeave = async () => {
    await fetch(`/api/v1/video/sessions/${appointmentId}/leave`, { method: "POST" });
    setInCall(false);
    setJoinPayload(null);
    if (sessionStatus?.role === "patient") {
      setShowPostConsultReview(true);
      return;
    }
    setShowDoctorPostConsult(true);
    await loadStatus();
  };

  if (loading && !sessionStatus && (leftSession || showPostConsultReview)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
        Loading video session…
      </div>
    );
  }

  if ((showPostConsultReview || leftSession) && sessionStatus?.role === "patient") {
    return <PostConsultReviewPrompt appointmentId={appointmentId} />;
  }

  if (showDoctorPostConsult && sessionStatus?.role === "doctor") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="font-display text-xl font-semibold text-foreground">Consultation ended</h1>
        <p className="mt-2 text-sm text-slate-600">
          Issue a digital prescription for your patient if clinically appropriate.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href={`/doctor/prescriptions/new?appointmentId=${appointmentId}`}>
              Issue prescription
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={dashboardHref}>Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (leftSession) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="font-display text-xl font-semibold text-foreground">Consultation ended</h1>
        <p className="mt-2 text-sm text-slate-600">
          You have left the video session. Your doctor or patient may still be in the room briefly.
        </p>
        <Button asChild className="mt-6">
          <Link href={dashboardHref}>Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  if (loading && !sessionStatus) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
        Loading your consultation…
      </div>
    );
  }

  if (error && !sessionStatus) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-900">{error}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={siteConfig.links.dashboard}>Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  if (!sessionStatus) return null;

  if (!sessionStatus.zoomConfigured) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-medium text-amber-900">Video is not configured</p>
        <p className="mt-2 text-sm text-amber-800">
          Zoom credentials are missing or incomplete. You need two Zoom Marketplace apps:
          a Server-to-Server OAuth app (meeting creation) and an activated General app with
          Meeting SDK enabled (embedded join). Add the variables listed in{" "}
          <code className="text-xs">.env.example</code> to{" "}
          <code className="text-xs">apps/web/.env.local</code> (dev) and your hosting
          provider (production), and add your domain to the General app allowlist.
        </p>
      </div>
    );
  }

  if (inCall && joinPayload) {
    const isDoctor = joinPayload.role === "doctor";

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-brand/30 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-3 py-2.5 text-white sm:gap-3 sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <SiteLogo size="lg" href={null} priority className="shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold text-white">
                {joinPayload.meetingTitle || ZOOM_CONSULT_MEETING_TITLE}
              </p>
              <p className="truncate text-xs text-slate-400">
                {formatConsultParticipantLine(joinPayload.role, joinPayload.counterpartName)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isDoctor && (
              <Button
                variant="outline"
                size="sm"
                className={`gap-1 border-white/20 bg-transparent text-white hover:bg-white/10 ${
                  rxPanelOpen ? "border-brand-light/60 bg-brand/20" : ""
                }`}
                onClick={() => setRxPanelOpen((open) => !open)}
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {rxPanelOpen ? "Hide Rx" : "Write Rx"}
                </span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
              onClick={() => void handleLeave()}
            >
              End session
            </Button>
          </div>
        </header>
        <div className="relative flex min-h-0 flex-1">
          <div
            className={`min-h-0 min-w-0 transition-[flex] duration-200 ${
              isDoctor && rxPanelOpen ? "flex-1" : "h-full w-full flex-1"
            }`}
          >
            <ZoomMeetingRoom
              appointmentId={appointmentId}
              payload={joinPayload}
              onLeave={handleLeave}
            />
          </div>
          {isDoctor && rxPanelOpen && (
            <>
              <button
                type="button"
                className="absolute inset-0 z-10 bg-black/40 lg:hidden"
                aria-label="Close prescription panel"
                onClick={() => setRxPanelOpen(false)}
              />
              <aside
                className="absolute inset-y-0 right-0 z-20 flex w-[min(100%,20rem)] flex-col border-l border-slate-200/80 lg:relative lg:z-0 lg:w-80 lg:max-w-[40%] lg:shrink-0"
              >
                <InCallPrescriptionPanel
                  appointmentId={appointmentId}
                  patientName={joinPayload.counterpartName}
                  onClose={() => setRxPanelOpen(false)}
                />
              </aside>
            </>
          )}
        </div>
      </div>
    );
  }

  if (joining || (sessionStatus.canJoin && !error)) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <div>
          <p className="font-display text-lg font-semibold text-foreground">
            Joining your consultation…
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Allow camera and microphone when your browser asks.
          </p>
        </div>
      </div>
    );
  }

  if (!sessionStatus.canJoin) {
    return (
      <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
        <Link
          href={dashboardHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Video className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-semibold text-foreground">
                Video consultation
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {formatKarachiDateTime(sessionStatus.scheduledStart)}
              </p>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-brand-light/30 bg-brand-muted/40 px-4 py-4">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Clock className="h-4 w-4 text-brand" />
              Room opens soon
            </p>
            <p className="mt-1 text-xs text-slate-500">
              You can join from {formatKarachiDateTime(sessionStatus.joinOpensAt)} until{" "}
              {formatKarachiDateTime(sessionStatus.joinClosesAt)} (Pakistan time). We&apos;ll connect
              you automatically — no extra steps.
            </p>
            <div className="mt-3">
              <CountdownTimer targetDate={sessionStatus.joinOpensAt} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 text-center">
      <p className="text-sm text-red-600">{error ?? "Could not start video."}</p>
      <Button className="mt-4" onClick={() => void startCall()}>
        Try again
      </Button>
    </div>
  );
}
