"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { SiteLogo } from "@/components/layout/site-logo";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MessageCircle,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { getWhatsAppSupportUrl } from "@/lib/support-contact";
import { InCallPrescriptionPanel } from "@/features/prescriptions/components/in-call-prescription-panel";
import { ZOOM_CONSULT_MEETING_TITLE } from "@/lib/zoom/branding";
import { CountdownTimer } from "@/features/sunday-consult/components/countdown-timer";
import { PostConsultReviewPrompt } from "@/features/consult/components/post-consult-review-prompt";
import type { VideoJoinPayload } from "@/features/consult/types";
import { AppointmentStatuses, AppointmentTypes } from "@zindagi/shared";
import { videoConsultPath } from "@/features/consult/paths";
import { useTranslations } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/messages";

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
  appointmentType?: string;
};

type Props = {
  appointmentId: string;
  leftSession?: boolean;
};

function JoiningTips({ tips }: { tips: string[] }) {
  return (
    <ul className="mt-4 space-y-2 text-start text-sm text-slate-600">
      {tips.map((tip) => (
        <li key={tip} className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <span>{tip}</span>
        </li>
      ))}
    </ul>
  );
}

export function VideoConsultClient({ appointmentId, leftSession }: Props) {
  const t = useTranslations();
  const copy = t.consult.videoSession;
  const videoLeftCopy = t.consult.videoLeft;
  const sundayDoctorCopy = copy.sundayDoctorOpen;
  const sundayPatientCopy = copy.sundayPatientOpen;
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  /** When sessionStatus was fetched; refreshed by the 30s status poll. */
  const [statusCheckedAt, setStatusCheckedAt] = useState(0);
  const [joinPayload, setJoinPayload] = useState<VideoJoinPayload | null>(null);
  const [inCall, setInCall] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPostConsultReview, setShowPostConsultReview] = useState(leftSession ?? false);
  const [showDoctorPostConsult, setShowDoctorPostConsult] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [rxPanelOpen, setRxPanelOpen] = useState(false);
  const rxAutoOpenedRef = useRef(false);
  const joinAttemptedRef = useRef(false);

  const supportUrl = getWhatsAppSupportUrl(copy.supportPrefill);
  const joiningTips = [copy.joiningTip1, copy.joiningTip2, copy.joiningTip3];

  const doctorDashboardHref =
    sessionStatus?.appointmentType === AppointmentTypes.URGENT_ONLINE
      ? "/doctor/urgent-calls"
      : sessionStatus?.appointmentType === AppointmentTypes.ONLINE
        ? "/doctor/requests"
        : "/doctor/sunday-consult";

  const dashboardHref =
    sessionStatus?.role === "doctor" ? doctorDashboardHref : siteConfig.links.dashboard;

  const formatParticipantLine = useCallback(
    (role: "patient" | "doctor", name: string) =>
      formatMessage(
        role === "doctor" ? copy.participantPatient : copy.participantDoctor,
        { name },
      ),
    [copy.participantDoctor, copy.participantPatient],
  );

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/video/sessions/${appointmentId}`);
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? copy.couldNotLoad);
      }
      setSessionStatus(json.data as SessionStatus);
      setStatusCheckedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.somethingWrong);
    } finally {
      setLoading(false);
    }
  }, [appointmentId, copy.couldNotLoad, copy.somethingWrong]);

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
        throw new Error(json.error?.message ?? copy.couldNotJoin);
      }
      setJoinPayload(json.data as VideoJoinPayload);
      setInCall(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.couldNotJoin);
    } finally {
      setJoining(false);
    }
  }, [appointmentId, copy.couldNotJoin, inCall, joining]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!sessionStatus || sessionStatus.canJoin) return;
    const interval = window.setInterval(loadStatus, 30_000);
    return () => window.clearInterval(interval);
  }, [sessionStatus, loadStatus]);

  useEffect(() => {
    if (!inCall || !joinPayload || joinPayload.role !== "doctor" || rxAutoOpenedRef.current) {
      return;
    }
    rxAutoOpenedRef.current = true;
    setRxPanelOpen(true);
  }, [inCall, joinPayload]);

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

  const isSundayFree = sessionStatus?.appointmentType === AppointmentTypes.SUNDAY_FREE;
  /** Sunday free consults stay open (video + chat) until the doctor finishes them. */
  const sundayStillOpen =
    isSundayFree &&
    !finished &&
    (sessionStatus?.appointmentStatus === AppointmentStatuses.CONFIRMED ||
      sessionStatus?.appointmentStatus === AppointmentStatuses.IN_PROGRESS);

  const rejoin = () => {
    if (leftSession) {
      window.location.href = videoConsultPath(appointmentId);
      return;
    }
    setShowPostConsultReview(false);
    setShowDoctorPostConsult(false);
    joinAttemptedRef.current = false;
    void loadStatus();
  };

  const finishSundayConsult = async () => {
    if (!window.confirm(sundayDoctorCopy.confirm)) return;
    setFinishing(true);
    setFinishError(null);
    const res = await fetch("/api/v1/sunday/doctor/appointment-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, status: "completed" }),
    }).catch(() => null);
    const json = await res?.json().catch(() => null);
    setFinishing(false);
    if (!res?.ok) {
      setFinishError(json?.error?.message ?? sundayDoctorCopy.finishError);
      return;
    }
    setFinished(true);
  };

  if (loading && !sessionStatus && (leftSession || showPostConsultReview)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
        {copy.loadingSession}
      </div>
    );
  }

  if (
    (showPostConsultReview || leftSession) &&
    sessionStatus?.role === "patient" &&
    sundayStillOpen
  ) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="font-display text-xl font-semibold text-foreground">
          {sundayPatientCopy.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{sundayPatientCopy.description}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button className="gap-1.5" onClick={rejoin}>
            <Video className="h-4 w-4" />
            {sundayPatientCopy.rejoin}
          </Button>
          <Button asChild variant="outline">
            <Link href={dashboardHref}>{videoLeftCopy.backToDashboard}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if ((showPostConsultReview || leftSession) && sessionStatus?.role === "patient") {
    return <PostConsultReviewPrompt appointmentId={appointmentId} />;
  }

  if (
    (showDoctorPostConsult || leftSession || finished) &&
    sessionStatus?.role === "doctor" &&
    isSundayFree
  ) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="font-display text-xl font-semibold text-foreground">
          {sundayStillOpen ? sundayDoctorCopy.title : sundayDoctorCopy.finishedTitle}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {sundayStillOpen ? sundayDoctorCopy.description : sundayDoctorCopy.finishedDescription}
        </p>
        {finishError && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {finishError}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          {sundayStillOpen && (
            <>
              <Button
                className="gap-1.5"
                onClick={() => void finishSundayConsult()}
                disabled={finishing}
                loading={finishing}
              >
                <CheckCircle2 className="h-4 w-4" />
                {sundayDoctorCopy.finish}
              </Button>
              <Button variant="outline" className="gap-1.5" onClick={rejoin}>
                <Video className="h-4 w-4" />
                {sundayDoctorCopy.rejoin}
              </Button>
            </>
          )}
          <Button asChild variant="outline">
            <Link href={`/doctor/prescriptions/new?appointmentId=${appointmentId}`}>
              {copy.doctorEnded.issuePrescription}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={dashboardHref}>{copy.doctorEnded.backToDashboard}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (showDoctorPostConsult && sessionStatus?.role === "doctor") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="font-display text-xl font-semibold text-foreground">
          {copy.doctorEnded.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{copy.doctorEnded.description}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href={`/doctor/prescriptions/new?appointmentId=${appointmentId}`}>
              {copy.doctorEnded.issuePrescription}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={dashboardHref}>{copy.doctorEnded.backToDashboard}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (leftSession) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="font-display text-xl font-semibold text-foreground">
          {videoLeftCopy.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{videoLeftCopy.description}</p>
        <Button asChild className="mt-6">
          <Link href={dashboardHref}>{videoLeftCopy.backToDashboard}</Link>
        </Button>
      </div>
    );
  }

  if (loading && !sessionStatus) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
        {copy.loading}
      </div>
    );
  }

  if (error && !sessionStatus) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-900">{error}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={() => void loadStatus()}>
            {copy.tryAgain}
          </Button>
          <Button asChild variant="outline">
            <Link href={siteConfig.links.dashboard}>{videoLeftCopy.backToDashboard}</Link>
          </Button>
        </div>
        <a
          href={supportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 text-sm font-medium text-brand hover:text-brand-dark"
        >
          <MessageCircle className="h-4 w-4" />
          {copy.contactSupport}
        </a>
      </div>
    );
  }

  if (!sessionStatus) return null;

  if (!sessionStatus.zoomConfigured) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-medium text-amber-900">{copy.zoomNotConfiguredTitle}</p>
        <p className="text-sm text-amber-800">{copy.zoomNotConfiguredDesc}</p>
        <a
          href={supportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          <MessageCircle className="h-4 w-4" />
          {copy.contactSupport}
        </a>
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
                {formatParticipantLine(joinPayload.role, joinPayload.counterpartName)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isDoctor && (
              <Button
                variant="outline"
                size="sm"
                className={`gap-1.5 border-white/20 bg-transparent text-white hover:bg-white/10 ${
                  rxPanelOpen ? "border-brand-light/60 bg-brand/20" : ""
                }`}
                onClick={() => setRxPanelOpen((open) => !open)}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                {rxPanelOpen ? copy.hideRx : copy.writePrescription}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
              onClick={() => void handleLeave()}
            >
              {copy.endSession}
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
                aria-label={copy.closeRxPanel}
                onClick={() => setRxPanelOpen(false)}
              />
              <aside
                className="absolute inset-y-0 end-0 z-20 flex w-[min(100%,20rem)] flex-col border-s border-slate-200/80 lg:relative lg:z-0 lg:w-80 lg:max-w-[40%] lg:shrink-0"
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
        <div className="mx-auto max-w-md">
          <p className="font-display text-lg font-semibold text-foreground">{copy.joining}</p>
          <p className="mt-1 text-sm text-slate-600">{copy.joiningHint}</p>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-start shadow-sm">
            <p className="text-sm font-semibold text-slate-800">{copy.joiningTipsTitle}</p>
            <JoiningTips tips={joiningTips} />
          </div>
        </div>
      </div>
    );
  }

  if (!sessionStatus.canJoin) {
    const joinWindowClosed = statusCheckedAt > new Date(sessionStatus.joinClosesAt).getTime();

    if (joinWindowClosed) {
      return (
        <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
          <Link
            href={dashboardHref}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark"
          >
            <ArrowLeft className="h-4 w-4" />
            {copy.back}
          </Link>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                <AlertCircle className="h-5 w-5" />
              </span>
              <div>
                <h1 className="font-display text-xl font-semibold text-red-900">{copy.missedTitle}</h1>
                <p className="mt-1 text-sm text-red-800">{copy.missedDescription}</p>
                <p className="mt-2 text-sm text-red-700">
                  {formatKarachiDateTime(sessionStatus.scheduledStart)}
                </p>
              </div>
            </div>
            <Button asChild className="mt-6">
              <Link href={dashboardHref}>{videoLeftCopy.backToDashboard}</Link>
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
        <Link
          href={dashboardHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark"
        >
          <ArrowLeft className="h-4 w-4" />
          {copy.back}
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Video className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-semibold text-foreground">{copy.title}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {formatKarachiDateTime(sessionStatus.scheduledStart)}
              </p>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-brand-light/30 bg-brand-muted/40 px-4 py-4">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Clock className="h-4 w-4 text-brand" />
              {copy.roomOpensSoon}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {isSundayFree
                ? formatMessage(copy.roomOpensUntilDoctorCloses, {
                    open: formatKarachiDateTime(sessionStatus.joinOpensAt),
                  })
                : formatMessage(copy.roomOpensBetween, {
                    open: formatKarachiDateTime(sessionStatus.joinOpensAt),
                    close: formatKarachiDateTime(sessionStatus.joinClosesAt),
                  })}
            </p>
            <p className="mt-2 text-xs text-slate-500">{copy.autoConnectNote}</p>
            <div className="mt-3">
              <CountdownTimer targetDate={sessionStatus.joinOpensAt} />
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-start">
            <p className="text-sm font-semibold text-slate-800">{copy.joiningTipsTitle}</p>
            <JoiningTips tips={joiningTips} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-8 text-center">
      <p className="text-sm text-red-600">{error ?? copy.couldNotStart}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          onClick={() => {
            joinAttemptedRef.current = false;
            void startCall();
          }}
        >
          {copy.tryAgain}
        </Button>
        <Button asChild variant="outline">
          <Link href={dashboardHref}>{videoLeftCopy.backToDashboard}</Link>
        </Button>
      </div>
      <a
        href={supportUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 text-sm font-medium text-brand hover:text-brand-dark"
      >
        <MessageCircle className="h-4 w-4" />
        {copy.contactSupport}
      </a>
    </div>
  );
}
