"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Clock, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { CountdownTimer } from "@/features/sunday-consult/components/countdown-timer";
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
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!sessionStatus || sessionStatus.canJoin) return;
    const interval = window.setInterval(loadStatus, 30_000);
    return () => window.clearInterval(interval);
  }, [sessionStatus, loadStatus]);

  const startCall = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    await fetch(`/api/v1/video/sessions/${appointmentId}/leave`, { method: "POST" });
    setInCall(false);
    setJoinPayload(null);
    await loadStatus();
  };

  const dashboardHref =
    sessionStatus?.role === "doctor" ? "/doctor/sunday-consult" : siteConfig.links.dashboard;

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
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
        Loading video session…
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
          Zoom credentials are missing on the server. Add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID,
          ZOOM_CLIENT_SECRET, ZOOM_SDK_KEY, and ZOOM_SDK_SECRET to enable consultations.
        </p>
      </div>
    );
  }

  if (inCall && joinPayload) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {joinPayload.role === "doctor" ? "Doctor" : "Patient"} session
            </p>
            <h1 className="font-display text-lg font-semibold text-foreground">
              With {joinPayload.counterpartName}
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleLeave}>
            End session
          </Button>
        </div>
        <ZoomMeetingRoom
          appointmentId={appointmentId}
          payload={joinPayload}
          onLeave={handleLeave}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
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
              {sessionStatus.role === "doctor" ? "Patient" : "Doctor"} consult ·{" "}
              {formatKarachiDateTime(sessionStatus.scheduledStart)}
            </p>
          </div>
        </div>

        {!sessionStatus.canJoin ? (
          <div className="mt-6 rounded-xl border border-brand-light/30 bg-brand-muted/40 px-4 py-4">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Clock className="h-4 w-4 text-brand" />
              Room opens soon
            </p>
            <p className="mt-1 text-xs text-slate-500">
              You can join from {formatKarachiDateTime(sessionStatus.joinOpensAt)} until{" "}
              {formatKarachiDateTime(sessionStatus.joinClosesAt)} (Pakistan time).
            </p>
            <div className="mt-3">
              <CountdownTimer targetDate={sessionStatus.joinOpensAt} />
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-slate-600">
              Your secure Zoom room is ready. Join with camera and microphone enabled for the best
              experience.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full gap-2" onClick={startCall} disabled={loading}>
              <Video className="h-4 w-4" />
              {loading ? "Preparing room…" : "Join video consultation"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
