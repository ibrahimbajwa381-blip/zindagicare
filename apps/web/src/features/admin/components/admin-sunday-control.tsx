"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { SundayAffordabilityChoices, SundayFreeRequestStatuses, SUNDAY_CONSULT_CONFIG, withDoctorTitle } from "@zindagi/shared";
import { dispatchAdminNavCountsRefresh } from "@/features/admin/lib/nav-counts-events";
import type {
  SundayAdminRequestDto,
  SundayTeamDoctorOption,
} from "@/features/sunday-consult/types";
import { PaymentProofModal } from "./payment-proof-modal";

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

export function AdminSundayControl() {
  const [data, setData] = useState<SundayOverview | null>(null);
  const [requests, setRequests] = useState<SundayAdminRequestDto[]>([]);
  const [teamDoctors, setTeamDoctors] = useState<SundayTeamDoctorOption[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [maxSlots, setMaxSlots] = useState(10);
  const [duration, setDuration] = useState(10);
  const [activeProofPaymentId, setActiveProofPaymentId] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    const [overviewRes, requestsRes] = await Promise.all([
      fetch("/api/v1/admin/sunday"),
      fetch("/api/v1/admin/sunday/requests"),
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
      setTeamDoctors(requestsJson.data?.doctors ?? []);
    }
    hasLoadedRef.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assignDoctor = async (requestId: string, isReassign: boolean) => {
    const doctorId = selectedDoctor[requestId];
    if (!doctorId) {
      alert("Select a doctor first");
      return;
    }
    if (
      isReassign &&
      !window.confirm("Replace the assigned doctor? The patient and new doctor will be notified.")
    ) {
      return;
    }
    setAssigning(requestId);
    const res = await fetch(`/api/v1/admin/sunday/requests/${requestId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId }),
    });
    setAssigning(null);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      alert(json?.error?.message ?? "Failed to assign doctor");
      return;
    }
    setSelectedDoctor((prev) => ({ ...prev, [requestId]: "" }));
    dispatchAdminNavCountsRefresh();
    await load();
  };

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

  if (loading || !data) {
    return <LoadingScreen message="Loading Sunday consult control…" />;
  }

  return (
    <div className="space-y-6">
      <Card className={surfaceCard}>
        <CardHeader>
          <CardTitle className="text-base">
            Patient requests (assign within {SUNDAY_CONSULT_CONFIG.matchWithinMinutes} min)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.map((request) => {
            const awaiting = request.status === SundayFreeRequestStatuses.REQUESTED;
            return (
              <div
                key={request.requestId}
                className="rounded-lg border border-slate-100 bg-white/70 p-3 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{request.patientName}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">
                      {request.patientPhone}
                    </p>
                    {request.patientNotes ? (
                      <p className="mt-1 max-w-md text-slate-600">{request.patientNotes}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">
                      Requested {formatKarachiDateTime(request.createdAt)}
                      {request.doctor ? ` · ${withDoctorTitle(request.doctor.name)}` : ""}
                    </p>
                    {request.status === SundayFreeRequestStatuses.ASSIGNED && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge
                          variant="outline"
                          className={
                            request.patientJoinedAt
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-500"
                          }
                        >
                          {request.patientJoinedAt ? "Patient joined" : "Patient not joined"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            request.doctorJoinedAt
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-500"
                          }
                        >
                          {request.doctorJoinedAt ? "Doctor joined" : "Doctor not joined"}
                        </Badge>
                      </div>
                    )}
                    {request.review && (
                      <p className="mt-2 max-w-md text-xs text-slate-600">
                        <span className="font-medium text-slate-700">
                          Patient review: {request.review.rating}/5
                        </span>
                        {request.review.comment ? ` — "${request.review.comment}"` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-start gap-3">
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
                      <Badge variant={awaiting ? "default" : "outline"}>
                        {awaiting ? "Awaiting assignment" : "Doctor assigned"}
                      </Badge>
                    </div>
                    {request.affordabilityChoice === SundayAffordabilityChoices.PAY_FEE &&
                      request.paymentId && (
                        <SundayReceiptButton
                          paymentId={request.paymentId}
                          onViewProof={setActiveProofPaymentId}
                        />
                      )}
                  </div>
                </div>
                {(awaiting || request.status === SundayFreeRequestStatuses.ASSIGNED) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      className="min-w-[12rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      value={selectedDoctor[request.requestId] ?? ""}
                      onChange={(e) =>
                        setSelectedDoctor((prev) => ({
                          ...prev,
                          [request.requestId]: e.target.value,
                        }))
                      }
                    >
                      <option value="">
                        {awaiting ? "Select Sunday doctor…" : "Select replacement doctor…"}
                      </option>
                      {teamDoctors
                        .filter((doc) => doc.doctorId !== request.doctor?.doctorId)
                        .map((doc) => (
                          <option key={doc.doctorId} value={doc.doctorId}>
                            {doc.name}
                            {doc.specialties[0] ? ` · ${doc.specialties[0]}` : ""}
                          </option>
                        ))}
                    </select>
                    <Button
                      size="sm"
                      disabled={assigning === request.requestId}
                      onClick={() => assignDoctor(request.requestId, !awaiting)}
                    >
                      {assigning === request.requestId
                        ? "Assigning…"
                        : awaiting
                          ? "Assign doctor"
                          : "Change doctor"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {requests.length === 0 && (
            <p className="text-sm text-slate-500">No open Sunday free consult requests.</p>
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
