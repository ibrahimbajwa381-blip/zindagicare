"use client";

import { useCallback, useEffect, useState } from "react";
import { SundayAffordabilityChoices, SundayFreeRequestStatuses } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { surfaceCardInteractive, surfaceInset } from "@/lib/ui/surfaces";
import { formatKarachiDateTime, formatKarachiTime } from "@/lib/format/datetime";
import type { SundayDoctorRequestDto } from "@/features/sunday-consult/types";

const REFRESH_INTERVAL_MS = 30_000;

const LEAVE_REASONS = [
  "Not my specialty",
  "Not available at this time",
  "Patient needs an in-person visit",
];

/** Suggested start: next 10-minute mark in Karachi if the Sunday is today, else 10:00. */
function suggestedStartTime(sundayDateKey: string): string {
  const now = new Date();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(now);
  if (todayKey !== sundayDateKey) return "10:00";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const total = Math.min(hour * 60 + Math.ceil((minute + 1) / 10) * 10, 23 * 60 + 50);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function SundayHistoryList({ request }: { request: SundayDoctorRequestDto }) {
  if (!request.history.length) {
    return request.patientNotes ? (
      <p className="mt-1 max-w-xl whitespace-pre-line text-sm text-slate-700">
        {request.patientNotes}
      </p>
    ) : (
      <p className="mt-1 text-sm text-slate-400">No medical history on this request.</p>
    );
  }
  return (
    <dl className="mt-2 max-w-xl space-y-2">
      {request.history.map((item) => (
        <div key={item.key}>
          <dt className="text-xs font-semibold text-slate-500">{item.text}</dt>
          <dd className="whitespace-pre-line text-sm text-slate-800">{item.answer}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReleaseNotesList({ request }: { request: SundayDoctorRequestDto }) {
  if (!request.releaseNotes.length) return null;
  return (
    <ul className="mt-3 max-w-xl space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {request.releaseNotes.map((r) => (
        <li key={r.releasedAt}>
          <span className="font-medium">
            {r.byMe ? "You left this patient" : "A doctor left this patient"}
          </span>
          {r.note ? `: “${r.note}”` : ""}
        </li>
      ))}
    </ul>
  );
}

async function fetchDoctorRequests(): Promise<SundayDoctorRequestDto[] | null> {
  // Network failures (offline, dev-server reload) keep the last list; the next poll retries.
  const res = await fetch("/api/v1/sunday/doctor/requests").catch(() => null);
  if (!res) return null;
  const json = await res.json().catch(() => null);
  return json?.success ? (json.data ?? []) : null;
}

type Props = {
  /** Called after a pick/release so the parent can refresh the consult queue. */
  onChange?: () => void;
};

export function DoctorSundayRequests({ onChange }: Props) {
  const [requests, setRequests] = useState<SundayDoctorRequestDto[]>([]);
  const [times, setTimes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [leaveNote, setLeaveNote] = useState("");

  const load = useCallback(
    () =>
      fetchDoctorRequests().then((data) => {
        if (data) setRequests(data);
      }),
    [],
  );

  useEffect(() => {
    load();
    const id = window.setInterval(load, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const pick = async (request: SundayDoctorRequestDto) => {
    const startTimeLocal = times[request.requestId] ?? suggestedStartTime(request.consultDateKey);
    setBusyId(request.requestId);
    setError(null);
    const res = await fetch(`/api/v1/sunday/doctor/requests/${request.requestId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTimeLocal }),
    });
    const json = await res.json().catch(() => null);
    setBusyId(null);
    if (!res.ok) setError(json?.error?.message ?? "Could not pick this patient");
    await load();
    onChange?.();
  };

  const startLeaving = (request: SundayDoctorRequestDto) => {
    setLeavingId(request.requestId);
    setLeaveNote("");
    setError(null);
  };

  const release = async (request: SundayDoctorRequestDto) => {
    setBusyId(request.requestId);
    setError(null);
    const res = await fetch(`/api/v1/sunday/doctor/requests/${request.requestId}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: leaveNote.trim() || undefined }),
    });
    const json = await res.json().catch(() => null);
    setBusyId(null);
    if (res.ok) setLeavingId(null);
    else setError(json?.error?.message ?? "Could not leave this patient");
    await load();
    onChange?.();
  };

  const waiting = requests.filter((r) => r.status === SundayFreeRequestStatuses.REQUESTED);
  const open = waiting.filter((r) => !r.overdue);
  const overdue = waiting.filter((r) => r.overdue);
  const mine = requests.filter((r) => r.pickedByMe);

  const renderOpenRequest = (request: SundayDoctorRequestDto) => (
    <div key={request.requestId} className={`space-y-3 p-3 ${surfaceInset}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{request.patientName}</p>
          <p className="text-xs text-slate-500">
            Requested {formatKarachiDateTime(request.createdAt)}
            {request.overdue ? ` · will be scheduled on ${request.consultDateKey}` : ""}
          </p>
          <SundayHistoryList request={request} />
          <ReleaseNotesList request={request} />
        </div>
        <div className="flex flex-wrap gap-1">
          {request.preferredSpecialty && (
            <Badge variant="default">Asked for {request.preferredSpecialty}</Badge>
          )}
          {request.overdue && <Badge variant="accent">Waiting over a week</Badge>}
          {request.affordabilityChoice === SundayAffordabilityChoices.CANNOT_AFFORD && (
            <Badge variant="secondary">Cannot afford paid care</Badge>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Consult time (PK)
          <Input
            type="time"
            step={600}
            className="mt-1 w-36"
            value={times[request.requestId] ?? suggestedStartTime(request.consultDateKey)}
            onChange={(e) =>
              setTimes((prev) => ({ ...prev, [request.requestId]: e.target.value }))
            }
          />
        </label>
        <Button
          size="sm"
          disabled={busyId === request.requestId}
          loading={busyId === request.requestId}
          onClick={() => pick(request)}
        >
          Pick patient
        </Button>
      </div>
    </div>
  );

  return (
    <Card className={`mt-8 ${surfaceCardInteractive}`}>
      <CardHeader>
        <CardTitle className="text-base">
          Patients waiting for a free consult
        </CardTitle>
        <p className="text-sm text-slate-500">
          Pick a patient and choose a time. The consultation is free for the patient, and the
          review they leave counts toward your profile. Patients who asked for a specific
          specialty are only shown to doctors verified in it.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {open.map(renderOpenRequest)}
        {!open.length && (
          <p className="text-sm text-slate-500">No patients are waiting right now.</p>
        )}

        {overdue.length > 0 && (
          <div className="space-y-3 pt-2">
            <div>
              <p className="text-sm font-medium text-slate-700">
                Waiting over a week ({overdue.length})
              </p>
              <p className="text-xs text-slate-500">
                No doctor picked these patients on their Sunday. Picking one schedules the consult
                on this Sunday.
              </p>
            </div>
            {overdue.map(renderOpenRequest)}
          </div>
        )}

        {mine.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium text-slate-700">Your picked patients</p>
            {mine.map((request) => (
              <div key={request.requestId} className={`space-y-3 p-3 ${surfaceInset}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {request.patientName}
                      {request.preferredSpecialty ? (
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          ({request.preferredSpecialty})
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500">
                      {request.scheduledStart
                        ? `Scheduled ${formatKarachiTime(request.scheduledStart)}`
                        : "Scheduling…"}
                      {request.patientPhone ? ` · ${request.patientPhone}` : ""}
                    </p>
                  </div>
                  {request.status !== SundayFreeRequestStatuses.ASSIGNED ? (
                    <Badge variant="secondary">{request.status}</Badge>
                  ) : leavingId !== request.requestId ? (
                    <Button size="sm" variant="outline" onClick={() => startLeaving(request)}>
                      Can&apos;t take this? Leave patient
                    </Button>
                  ) : null}
                </div>
                {leavingId === request.requestId && (
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-sm font-medium text-slate-800">Leave this patient</p>
                    <p className="text-xs text-slate-500">
                      They go back to the waiting list so another doctor can pick them. Your note is
                      shown to the next doctor, not the patient.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {LEAVE_REASONS.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => setLeaveNote(reason)}
                          className={`rounded-full border px-3 py-1 text-xs ${
                            leaveNote === reason
                              ? "border-teal-600 bg-teal-50 text-teal-800"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                    <label className="block text-sm">
                      <span className="sr-only">Note for the next doctor</span>
                      <textarea
                        value={leaveNote}
                        onChange={(e) => setLeaveNote(e.target.value)}
                        maxLength={300}
                        rows={2}
                        placeholder="Optional note for the next doctor, e.g. I'm not a dermatologist"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="bg-red-600 text-white hover:bg-red-700"
                        disabled={busyId === request.requestId}
                        loading={busyId === request.requestId}
                        onClick={() => release(request)}
                      >
                        Leave patient
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === request.requestId}
                        onClick={() => setLeavingId(null)}
                      >
                        Keep patient
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
