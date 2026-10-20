"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Eye, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime, formatKarachiTime } from "@/lib/format/datetime";
import {
  AppointmentStatuses,
  cn,
  SundayAffordabilityChoices,
  SundayFreeRequestStatuses,
  SUNDAY_CONSULT_CONFIG,
  withDoctorTitle,
} from "@zindagi/shared";
import type { SundayAdminRequestDto } from "@/features/sunday-consult/types";
import { PaymentProofModal } from "./payment-proof-modal";
import { AdminConsultChatTranscript } from "./admin-consult-chat-transcript";

type SundayOverview = {
  sundayConsultEnabled: boolean;
  sundayDefaultMaxSlots: number;
  sundaySlotDurationMins: number;
  maintenanceMode: boolean;
  nextSundayKey: string;
  doctors: {
    doctorId: string;
    name: string;
    specialties: string[];
    totalSlots: number;
    bookedSlots: number;
    availableSlots: number;
  }[];
  queue: {
    appointmentId: string;
    patientName: string;
    patientPhone?: string;
    doctorName: string;
    scheduledStart: string;
    status: string;
  }[];
};

function SundayReceiptButton({
  paymentId,
  onViewProof,
}: {
  paymentId: string;
  onViewProof: (paymentId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onViewProof(paymentId)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand hover:bg-brand/5 hover:text-brand"
      title="View payment proof"
    >
      <Eye className="h-3.5 w-3.5 text-brand" />
      View Proof
    </button>
  );
}

type RequestFilter = "all" | "waiting" | "scheduled" | "completed" | "missed" | "cancelled";

const REQUEST_FILTERS: { value: RequestFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "waiting", label: "Waiting" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "missed", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
];

function requestStage(request: SundayAdminRequestDto): Exclude<RequestFilter, "all"> {
  if (request.status === SundayFreeRequestStatuses.REQUESTED) return "waiting";
  if (request.status === SundayFreeRequestStatuses.CANCELLED) return "cancelled";
  if (request.appointmentStatus === AppointmentStatuses.NO_SHOW) return "missed";
  if (request.appointmentStatus === AppointmentStatuses.CANCELLED) return "cancelled";
  if (
    request.status === SundayFreeRequestStatuses.COMPLETED ||
    request.appointmentStatus === AppointmentStatuses.COMPLETED
  ) {
    return "completed";
  }
  return "scheduled";
}

function stageBadge(request: SundayAdminRequestDto): { label: string; className: string } {
  switch (requestStage(request)) {
    case "waiting":
      return { label: "Waiting for a doctor", className: "border-amber-200 bg-amber-50 text-amber-800" };
    case "cancelled":
      return request.rejectedByAdmin
        ? { label: "Rejected by admin", className: "border-rose-200 bg-rose-50 text-rose-700" }
        : { label: "Cancelled", className: "border-slate-200 bg-slate-100 text-slate-600" };
    case "missed":
      return {
        label:
          request.missedBy === "doctor"
            ? "No-show (doctor)"
            : request.missedBy === "patient"
              ? "No-show (patient)"
              : "No-show",
        className: "border-rose-200 bg-rose-50 text-rose-700",
      };
    case "completed":
      return { label: "Completed", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    default:
      return {
        label:
          request.appointmentStatus === AppointmentStatuses.IN_PROGRESS ? "In session" : "Scheduled",
        className: "border-sky-200 bg-sky-50 text-sky-800",
      };
  }
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={cn(
            "h-3.5 w-3.5",
            index < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-200",
          )}
        />
      ))}
    </span>
  );
}

function JoinBadge({ who, joinedAt }: { who: string; joinedAt?: string }) {
  return (
    <Badge
      variant="outline"
      className={
        joinedAt
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }
    >
      {joinedAt ? `${who} joined ${formatKarachiTime(joinedAt)}` : `${who} not joined`}
    </Badge>
  );
}

/** "2026-10-18" → "Sun, 18 Oct 2026" (parsed as a calendar date, no timezone shift). */
function formatSundayKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{children}</dd>
    </div>
  );
}

/** Requests an admin can still reject: waiting, or picked but not started yet. */
function canReject(request: SundayAdminRequestDto) {
  if (request.status === SundayFreeRequestStatuses.REQUESTED) return true;
  return (
    request.status === SundayFreeRequestStatuses.ASSIGNED &&
    (!request.appointmentStatus ||
      request.appointmentStatus === AppointmentStatuses.PENDING ||
      request.appointmentStatus === AppointmentStatuses.CONFIRMED)
  );
}

function RejectRequestForm({
  request,
  onRejected,
}: {
  request: SundayAdminRequestDto;
  onRejected: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (reason.trim().length < 3) {
      setError("Add a short note explaining the rejection.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/admin/sunday/requests/${request.requestId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    const json = await res.json().catch(() => null);
    setSubmitting(false);
    if (!res.ok || !json?.success) {
      setError(json?.error?.message ?? "Could not reject this request.");
      return;
    }
    setOpen(false);
    setReason("");
    onRejected();
  };

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
        onClick={() => setOpen(true)}
      >
        Reject request
      </Button>
    );
  }

  return (
    <div className="w-full rounded-md border border-rose-100 bg-rose-50/50 p-3">
      <label className="block text-xs font-medium text-slate-700">
        Rejection note (sent to the patient{request.doctor ? " — the doctor is also notified" : ""})
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="e.g. Duplicate request / symptoms need emergency care / incomplete details"
          className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-brand focus:outline-none"
        />
      </label>
      {request.affordabilityChoice === SundayAffordabilityChoices.PAY_FEE && request.paymentId && (
        <p className="mt-1.5 text-xs text-amber-700">
          This patient paid a contribution — handle any refund separately.
        </p>
      )}
      {error && <p className="mt-1.5 text-xs text-rose-700">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={submitting}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Keep request
        </Button>
        <Button
          size="sm"
          disabled={submitting}
          className="bg-rose-600 text-white hover:bg-rose-700"
          onClick={submit}
        >
          {submitting ? "Rejecting…" : "Reject request"}
        </Button>
      </div>
    </div>
  );
}

function SundayRequestCard({
  request,
  onViewProof,
  onRejected,
}: {
  request: SundayAdminRequestDto;
  onViewProof: (paymentId: string) => void;
  onRejected: () => void;
}) {
  const stage = stageBadge(request);
  const doctor = request.doctor;
  const session = request.session;

  return (
    <div className="rounded-lg border border-slate-100 bg-white/70 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{request.patientName}</p>
          <p className="mt-0.5 font-mono text-xs text-slate-500">{request.patientPhone}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge
            variant="outline"
            className={
              request.affordabilityChoice === SundayAffordabilityChoices.PAY_FEE
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-sky-200 bg-sky-50 text-sky-800"
            }
          >
            {request.affordabilityChoice === SundayAffordabilityChoices.PAY_FEE
              ? `Paid Rs. ${request.contributionFeePkr ?? SUNDAY_CONSULT_CONFIG.contributionFeePkr}`
              : "Cannot afford (free)"}
          </Badge>
          {request.preferredSpecialty && (
            <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">
              {request.preferredSpecialty} only
            </Badge>
          )}
          <Badge variant="outline" className={stage.className}>
            {stage.label}
          </Badge>
          {request.affordabilityChoice === SundayAffordabilityChoices.PAY_FEE &&
            request.paymentId && (
              <SundayReceiptButton paymentId={request.paymentId} onViewProof={onViewProof} />
            )}
        </div>
      </div>

      <dl className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Requested">{formatKarachiDateTime(request.createdAt)}</Detail>
        <Detail label="Accepted by">
          {doctor ? (
            <span className="block space-y-0.5">
              <Link
                href={`/admin/doctors/manage/${doctor.doctorId}`}
                className="block font-medium text-brand hover:underline"
              >
                {withDoctorTitle(doctor.name)}
              </Link>
              <span className="block text-xs text-slate-500">
                {doctor.specialty}
                {doctor.pmdcVerified ? " · PMDC verified" : ""}
              </span>
              {doctor.phone ? (
                <span className="block font-mono text-xs text-slate-500">{doctor.phone}</span>
              ) : null}
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <RatingStars rating={doctor.ratingAvg} />
                {doctor.ratingCount > 0
                  ? `${doctor.ratingAvg.toFixed(1)} (${doctor.ratingCount})`
                  : "No reviews yet"}
              </span>
              {request.assignedAt ? (
                <span className="block text-xs text-slate-400">
                  Picked {formatKarachiDateTime(request.assignedAt)}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="text-slate-400">Not picked yet</span>
          )}
        </Detail>
        <Detail label="Scheduled">
          {request.scheduledStart ? (
            <>
              {formatKarachiTime(request.scheduledStart)}
              {request.scheduledEnd ? ` – ${formatKarachiTime(request.scheduledEnd)}` : ""}
            </>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </Detail>
        <Detail label="Session">
          {session?.startedAt || session?.endedAt ? (
            <span className="block text-xs">
              {[
                session.startedAt ? `Started ${formatKarachiTime(session.startedAt)}` : null,
                session.endedAt ? `Ended ${formatKarachiTime(session.endedAt)}` : null,
                session.durationSeconds ? formatDuration(session.durationSeconds) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : request.completedAt ? (
            <span className="text-xs">Completed {formatKarachiDateTime(request.completedAt)}</span>
          ) : (
            <span className="text-slate-400">{doctor ? "Not started" : "—"}</span>
          )}
        </Detail>
      </dl>

      <details className="group mt-3 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 hover:text-brand [&::-webkit-details-marker]:hidden">
          <span>
            Patient&apos;s medical details
            {request.history.length > 0 ? ` · ${request.history.length}` : ""}
          </span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        {request.history.length > 0 ? (
          <dl className="mt-1.5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {request.history.map((item) => (
              <div key={item.key}>
                <dt className="text-xs font-semibold text-slate-500">{item.text}</dt>
                <dd className="whitespace-pre-line text-sm text-slate-800">{item.answer}</dd>
              </div>
            ))}
          </dl>
        ) : request.patientNotes ? (
          <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{request.patientNotes}</p>
        ) : (
          <p className="mt-1 text-sm text-slate-400">No details added by the patient.</p>
        )}
      </details>

      {doctor && request.appointmentId && (
        <AdminConsultChatTranscript
          appointmentId={request.appointmentId}
          patientName={request.patientName}
          doctorName={withDoctorTitle(doctor.name)}
        />
      )}

      {doctor && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <JoinBadge who="Patient" joinedAt={request.patientJoinedAt} />
          <JoinBadge who="Doctor" joinedAt={request.doctorJoinedAt} />
        </div>
      )}

      {request.cancellationReason && (
        <p
          className={cn(
            "mt-2 text-xs",
            request.rejectedByAdmin
              ? "rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-rose-800"
              : "text-slate-500",
          )}
        >
          <span className="font-medium">
            {request.rejectedByAdmin ? "Admin rejection note:" : "Cancellation reason:"}
          </span>{" "}
          {request.cancellationReason}
          {request.cancelledAt ? ` (${formatKarachiDateTime(request.cancelledAt)})` : ""}
        </p>
      )}

      {canReject(request) && (
        <div className="mt-3 flex justify-end">
          <RejectRequestForm request={request} onRejected={onRejected} />
        </div>
      )}

      {doctor && (
        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs">
          {request.review ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-700">Patient review</span>
                <RatingStars rating={request.review.rating} />
                <span className="text-slate-500">{request.review.rating}/5</span>
                {!request.review.isVisible && (
                  <Badge variant="outline" className="border-slate-200 text-[10px] text-slate-500">
                    Hidden
                  </Badge>
                )}
                {request.review.createdAt && (
                  <span className="text-slate-400">
                    {formatKarachiDateTime(request.review.createdAt)}
                  </span>
                )}
              </div>
              {request.review.comment ? (
                <p className="text-slate-600">&ldquo;{request.review.comment}&rdquo;</p>
              ) : null}
            </div>
          ) : (
            <span className="text-slate-400">No patient review yet</span>
          )}
          <div className="mt-2 border-t border-slate-200/70 pt-2">
            {request.platformReview ? (
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-700">ZindagiCare review</span>
                  <RatingStars rating={request.platformReview.rating} />
                  <span className="text-slate-500">{request.platformReview.rating}/5</span>
                  <span className="text-slate-400">
                    {formatKarachiDateTime(request.platformReview.createdAt)}
                  </span>
                </div>
                {request.platformReview.comment ? (
                  <p className="text-slate-600">&ldquo;{request.platformReview.comment}&rdquo;</p>
                ) : null}
              </div>
            ) : (
              <span className="text-slate-400">No ZindagiCare review yet</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminSundayControl() {
  const [data, setData] = useState<SundayOverview | null>(null);
  const [requests, setRequests] = useState<SundayAdminRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [maxSlots, setMaxSlots] = useState(10);
  const [duration, setDuration] = useState(10);
  const [activeProofPaymentId, setActiveProofPaymentId] = useState<string | null>(null);
  /** "all" = every Sunday, otherwise a YYYY-MM-DD Sunday key. */
  const [requestDate, setRequestDate] = useState("all");
  const [requestDates, setRequestDates] = useState<string[]>([]);
  const [requestFilter, setRequestFilter] = useState<RequestFilter>("all");

  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    const [overviewRes, requestsRes] = await Promise.all([
      fetch("/api/v1/admin/sunday"),
      fetch(`/api/v1/admin/sunday/requests?date=${encodeURIComponent(requestDate)}`),
    ]);
    const overviewJson = await overviewRes.json();
    const requestsJson = await requestsRes.json();
    if (overviewJson.success) {
      setData(overviewJson.data);
      setMaxSlots(overviewJson.data.sundayDefaultMaxSlots);
      setDuration(overviewJson.data.sundaySlotDurationMins);
    }
    if (requestsJson.success) {
      setRequests(requestsJson.data?.requests ?? []);
      setRequestDates(requestsJson.data?.dates ?? []);
    }
    hasLoadedRef.current = true;
    setLoading(false);
  }, [requestDate]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSettings = async (patch: Record<string, unknown>) => {
    setPending(true);
    const res = await fetch("/api/v1/admin/sunday", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setPending(false);
    if (res.ok) await load();
    else alert("Failed to save settings");
  };

  const resetSlots = async () => {
    if (!window.confirm("Reset all Sunday slots for this week? Existing holds will be cleared.")) {
      return;
    }
    setPending(true);
    const res = await fetch("/api/v1/admin/sunday/reset", { method: "POST" });
    setPending(false);
    if (res.ok) await load();
    else alert("Reset failed");
  };

  const applyDefaults = async () => {
    setPending(true);
    const res = await fetch("/api/v1/admin/sunday/reset?action=apply-defaults", {
      method: "POST",
    });
    setPending(false);
    if (res.ok) await load();
    else alert("Failed to apply defaults");
  };

  const visibleRequests =
    requestFilter === "all"
      ? requests
      : requests.filter((request) => requestStage(request) === requestFilter);

  const dateOptions =
    data && !requestDates.includes(data.nextSundayKey)
      ? [data.nextSundayKey, ...requestDates]
      : requestDates;

  if (loading || !data) {
    return <LoadingScreen message="Loading Sunday consult control…" />;
  }

  return (
    <div className="space-y-6">
      <Card className={surfaceCard}>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Patient requests — progress</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Doctors pick patients from their open-requests board and choose a time. This view
                is read-only.
              </p>
            </div>
            <label className="text-xs text-slate-500">
              <span className="mb-1 block">Sunday</span>
              <select
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                className="h-9 w-48 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
              >
                <option value="all">All Sundays</option>
                {dateOptions.map((key) => (
                  <option key={key} value={key}>
                    {formatSundayKey(key)}
                    {key === data.nextSundayKey ? " (upcoming)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REQUEST_FILTERS.map((filter) => {
              const count =
                filter.value === "all"
                  ? requests.length
                  : requests.filter((r) => requestStage(r) === filter.value).length;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setRequestFilter(filter.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    requestFilter === filter.value
                      ? "border-brand bg-brand text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-brand",
                  )}
                >
                  {filter.label} · {count}
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleRequests.map((request, index) => (
            <Fragment key={request.requestId}>
              {requestDate === "all" &&
                request.sundayDateKey !== visibleRequests[index - 1]?.sundayDateKey && (
                  <p
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide text-slate-500",
                      index > 0 && "pt-3",
                    )}
                  >
                    {formatSundayKey(request.sundayDateKey)}
                    {request.sundayDateKey === data.nextSundayKey ? " · upcoming" : ""}
                  </p>
                )}
              <SundayRequestCard
                request={request}
                onViewProof={setActiveProofPaymentId}
                onRejected={load}
              />
            </Fragment>
          ))}
          {visibleRequests.length === 0 && (
            <p className="text-sm text-slate-500">No Sunday free consult requests here.</p>
          )}
        </CardContent>
      </Card>

      <Card className={surfaceCard}>
        <CardHeader>
          <CardTitle className="text-base">System settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.sundayConsultEnabled}
                disabled={pending}
                onChange={(e) =>
                  saveSettings({ sundayConsultEnabled: e.target.checked })
                }
              />
              Sunday consult enabled
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.maintenanceMode}
                disabled={pending}
                onChange={(e) => saveSettings({ maintenanceMode: e.target.checked })}
              />
              Maintenance mode
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Default slots per doctor (5–20)
              </label>
              <Input
                type="number"
                min={5}
                max={20}
                value={maxSlots}
                onChange={(e) => setMaxSlots(Number(e.target.value))}
                className="w-24"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Session duration (mins)
              </label>
              <Input
                type="number"
                min={5}
                max={60}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-24"
              />
            </div>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                saveSettings({
                  sundayDefaultMaxSlots: maxSlots,
                  sundaySlotDurationMins: duration,
                })
              }
            >
              Save slot defaults
            </Button>
          </div>

          <p className="text-sm text-slate-500">
            Next Sunday: <strong>{data.nextSundayKey}</strong>
          </p>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={pending} onClick={resetSlots}>
              Reset weekly slots
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={applyDefaults}>
              Apply defaults to all doctors
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className={surfaceCard}>
        <CardHeader>
          <CardTitle className="text-base">Doctor slot fill</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.doctors.map((d) => (
            <div
              key={d.doctorId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white/70 p-3 text-sm"
            >
              <div>
                <p className="font-medium">{d.name}</p>
                <p className="text-slate-500">{d.specialties.join(", ")}</p>
              </div>
              <Badge variant="outline">
                {d.bookedSlots}/{d.totalSlots} filled · {d.availableSlots} open
              </Badge>
            </div>
          ))}
          {data.doctors.length === 0 && (
            <p className="text-sm text-slate-500">No Sunday doctors configured.</p>
          )}
        </CardContent>
      </Card>

      <Card className={surfaceCard}>
        <CardHeader>
          <CardTitle className="text-base">Current queue (FIFO)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.queue.map((q, i) => (
            <div
              key={q.appointmentId}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white/70 p-3 text-sm"
            >
              <div>
                <span className="mr-2 font-mono text-slate-400">#{i + 1}</span>
                <span className="font-medium">{q.patientName}</span>
                <span className="text-slate-500"> → Dr. {q.doctorName}</span>
                <p className="text-slate-500">
                  {formatKarachiDateTime(q.scheduledStart)}
                  {q.patientPhone ? ` · ${q.patientPhone}` : ""}
                </p>
              </div>
              <Badge variant="outline">{q.status}</Badge>
            </div>
          ))}
          {data.queue.length === 0 && (
            <p className="text-sm text-slate-500">Queue is empty for this Sunday.</p>
          )}
        </CardContent>
      </Card>
      <PaymentProofModal
        isOpen={!!activeProofPaymentId}
        paymentId={activeProofPaymentId}
        onClose={() => setActiveProofPaymentId(null)}
      />
    </div>
  );
}
