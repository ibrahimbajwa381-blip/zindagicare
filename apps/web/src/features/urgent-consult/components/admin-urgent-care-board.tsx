"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone, User, Zap } from "lucide-react";
import { UrgentCareRequestStatuses } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import type { UrgentCareRequestDto, UrgentTeamDoctorOption } from "@/features/urgent-consult/types";

const STATUS_LABELS: Record<string, string> = {
  [UrgentCareRequestStatuses.REQUESTED]: "Awaiting assignment",
  [UrgentCareRequestStatuses.ASSIGNED]: "Doctor assigned",
};

export function AdminUrgentCareBoard() {
  const [requests, setRequests] = useState<UrgentCareRequestDto[]>([]);
  const [doctors, setDoctors] = useState<UrgentTeamDoctorOption[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [reqRes, docRes] = await Promise.all([
      fetch("/api/v1/admin/urgent-care"),
      fetch("/api/v1/admin/urgent-care/doctors"),
    ]);
    const reqJson = await reqRes.json();
    const docJson = await docRes.json();
    setRequests(reqJson.success ? reqJson.data ?? [] : []);
    setDoctors(docJson.success ? docJson.data ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const assign = async (requestId: string) => {
    const doctorId = selectedDoctor[requestId];
    if (!doctorId) {
      alert("Select a doctor first.");
      return;
    }
    setPending(requestId);
    try {
      const res = await fetch(`/api/v1/admin/urgent-care/${requestId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Assignment failed");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setPending(null);
    }
  };

  const setStatus = async (requestId: string, status: "completed" | "cancelled") => {
    const reason =
      status === "cancelled" ? (window.prompt("Cancellation reason (optional):") ?? undefined) : undefined;
    setPending(requestId);
    try {
      const res = await fetch(`/api/v1/admin/urgent-care/${requestId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, cancellationReason: reason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Update failed");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setPending(null);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading urgent care requests…" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        MVP dispatch: assign a doctor from your team. The doctor calls the patient directly on the
        number below — no in-app video required.
      </p>

      {requests.length === 0 ? (
        <div className={`rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500 ${surfaceCard}`}>
          No open urgent care requests.
        </div>
      ) : (
        requests.map((request) => (
          <Card key={request.requestId} className={surfaceCard}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Zap className="h-4 w-4 text-brand" />
                    {request.patientName}
                  </CardTitle>
                  <p className="mt-1 text-xs text-slate-500">
                    Requested {formatKarachiDateTime(request.createdAt)}
                  </p>
                </div>
                <Badge variant={request.status === UrgentCareRequestStatuses.REQUESTED ? "secondary" : "default"}>
                  {STATUS_LABELS[request.status] ?? request.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="flex gap-3 rounded-xl border border-slate-200/70 bg-slate-50/80 p-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Callback number
                    </dt>
                    <dd className="mt-1 font-mono text-sm font-semibold text-slate-900">
                      {request.patientPhone}
                    </dd>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl border border-slate-200/70 bg-slate-50/80 p-3">
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Assigned doctor
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800">
                      {request.doctor?.name ?? "Not assigned yet"}
                    </dd>
                  </div>
                </div>
              </dl>

              {request.patientNotes && (
                <div className="rounded-xl border border-slate-200/70 bg-white p-3 text-sm text-slate-700">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Symptoms / notes
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{request.patientNotes}</p>
                </div>
              )}

              {request.status === UrgentCareRequestStatuses.REQUESTED && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex-1 text-sm">
                    <span className="mb-1.5 block font-medium text-slate-700">Assign doctor</span>
                    <select
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                      value={selectedDoctor[request.requestId] ?? ""}
                      onChange={(e) =>
                        setSelectedDoctor((prev) => ({
                          ...prev,
                          [request.requestId]: e.target.value,
                        }))
                      }
                    >
                      <option value="">Select from team…</option>
                      {doctors.map((doc) => (
                        <option key={doc.doctorId} value={doc.doctorId}>
                          {doc.name}
                          {doc.specialties[0] ? ` · ${doc.specialties[0]}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    className="shrink-0 bg-brand hover:bg-brand-dark"
                    disabled={pending === request.requestId}
                    onClick={() => assign(request.requestId)}
                  >
                    {pending === request.requestId ? "Assigning…" : "Assign & notify doctor"}
                  </Button>
                </div>
              )}

              {request.status === UrgentCareRequestStatuses.ASSIGNED && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending === request.requestId}
                    onClick={() => setStatus(request.requestId, "completed")}
                  >
                    Mark completed
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending === request.requestId}
                    onClick={() => setStatus(request.requestId, "cancelled")}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
