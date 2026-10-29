"use client";

import { useCallback, useEffect, useState } from "react";
import { AppointmentStatuses } from "@zindagi/shared";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { CheckCircle2, FileText, Info } from "lucide-react";
import { surfaceCardInteractive, surfaceInset } from "@/lib/ui/surfaces";
import { DoctorIntakeSummary } from "@/features/intake/components/doctor-intake-summary";
import { VideoJoinLinkButton } from "@/features/consult/components/video-join-link-button";
import { finishConsult } from "@/features/consult/finish-consult";
import { DoctorSundayRequests } from "./doctor-sunday-requests";

type QueueAppointment = {
  _id: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  patientId: { name?: string; phone?: string };
};

export function DoctorSundayDashboard() {
  const [enabled, setEnabled] = useState(true);
  const [template, setTemplate] = useState({
    startTimeLocal: "09:00",
    endTimeLocal: "13:00",
    slotDurationMins: 10,
    maxSlots: 16,
  });
  const [appointments, setAppointments] = useState<QueueAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    // Network failures (offline, dev-server reload) keep the last queue instead of throwing.
    const res = await fetch("/api/v1/sunday/doctor/queue").catch(() => null);
    if (!res) return;
    const json = await res.json().catch(() => null);
    if (json?.success) {
      setAppointments(json.data.appointments ?? []);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const saveTemplate = async () => {
    setLoading(true);
    await fetch("/api/v1/sunday/doctor/template", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...template, isActive: true }),
    });
    setLoading(false);
    loadQueue();
  };

  const toggleEnabled = async () => {
    const next = !enabled;
    await fetch("/api/v1/sunday/doctor/toggle", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    setEnabled(next);
  };

  const updateStatus = async (
    appointmentId: string,
    status: "completed" | "no_show",
  ) => {
    const confirmText =
      status === "completed"
        ? "Finish this consultation? The video room and chat will close and the patient will be asked to review you."
        : "Mark this patient as a no-show? The video room and chat will close.";
    if (!window.confirm(confirmText)) return;

    setBusyId(appointmentId);
    setStatusError(null);
    const error = await finishConsult(appointmentId, status);
    setBusyId(null);
    if (error) setStatusError(error);
    loadQueue();
  };

  const isOpen = (status: string) =>
    status === AppointmentStatuses.CONFIRMED || status === AppointmentStatuses.IN_PROGRESS;
  const openCount = appointments.filter((apt) => isOpen(apt.status)).length;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle
          title="Sunday Free Consult"
          description="Pick waiting patients, choose a time, and run your free Sunday consults."
        />
        <Button
          variant="outline"
          className="shrink-0 rounded-xl border-accent/30 bg-white/90 backdrop-blur-sm"
          onClick={toggleEnabled}
        >
          {enabled ? "Disable" : "Enable"} Sunday consults
        </Button>
      </div>

      <DoctorSundayRequests onChange={loadQueue} />

      <Card className={`mt-8 ${surfaceCardInteractive}`}>
        <CardHeader>
          <CardTitle className="text-base">Weekly slot template</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Start (PK)
            <Input
              className="mt-1"
              value={template.startTimeLocal}
              onChange={(e) =>
                setTemplate((t) => ({ ...t, startTimeLocal: e.target.value }))
              }
            />
          </label>
          <label className="text-sm">
            End (PK)
            <Input
              className="mt-1"
              value={template.endTimeLocal}
              onChange={(e) =>
                setTemplate((t) => ({ ...t, endTimeLocal: e.target.value }))
              }
            />
          </label>
          <label className="text-sm">
            Duration (mins)
            <Input
              type="number"
              className="mt-1"
              value={template.slotDurationMins}
              onChange={(e) =>
                setTemplate((t) => ({
                  ...t,
                  slotDurationMins: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="text-sm">
            Max slots
            <Input
              type="number"
              className="mt-1"
              value={template.maxSlots}
              onChange={(e) =>
                setTemplate((t) => ({ ...t, maxSlots: Number(e.target.value) }))
              }
            />
          </label>
          <Button onClick={saveTemplate} disabled={loading} loading={loading} className="sm:col-span-2">
            Save & materialize next Sunday
          </Button>
        </CardContent>
      </Card>

      <Card className={surfaceCardInteractive}>
        <CardHeader>
          <CardTitle className="text-base">Patient queue (this Sunday)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {openCount > 0 && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                Video and chat stay open until you close the consultation. When you are done, press{" "}
                <strong>Finish consultation</strong> — only then is it marked completed and the
                patient can leave you a review.
              </p>
            </div>
          )}
          {statusError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {statusError}
            </p>
          )}
          {appointments.map((apt) => (
            <div key={apt._id} className={`space-y-3 p-3 ${surfaceInset}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{apt.patientId?.name ?? "Patient"}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(apt.scheduledStart).toLocaleString("en-PK", {
                      timeZone: "Asia/Karachi",
                    })}
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {apt.status}
                  </Badge>
                </div>
                {isOpen(apt.status) ? (
                  <div className="flex flex-wrap gap-2">
                    <VideoJoinLinkButton
                      appointmentId={apt._id}
                      scheduledStart={apt.scheduledStart}
                      scheduledEnd={apt.scheduledEnd}
                      openUntilClosed
                      size="sm"
                    />
                    <Button size="sm" variant="outline" asChild className="gap-1">
                      <Link href={`/doctor/prescriptions/new?appointmentId=${apt._id}`}>
                        <FileText className="h-3.5 w-3.5" />
                        Issue Rx
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1"
                      disabled={busyId === apt._id}
                      loading={busyId === apt._id}
                      onClick={() => updateStatus(apt._id, "completed")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Finish consultation
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === apt._id}
                      onClick={() => updateStatus(apt._id, "no_show")}
                    >
                      No-show
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" asChild className="gap-1">
                    <Link href={`/doctor/prescriptions/new?appointmentId=${apt._id}`}>
                      <FileText className="h-3.5 w-3.5" />
                      Issue Rx
                    </Link>
                  </Button>
                )}
              </div>
              <DoctorIntakeSummary appointmentId={apt._id} />
            </div>
          ))}
          {!appointments.length && (
            <p className="text-sm text-slate-500">No bookings yet for this Sunday.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

