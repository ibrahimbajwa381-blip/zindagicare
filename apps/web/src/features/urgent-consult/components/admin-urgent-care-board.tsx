"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, User, Video, XCircle, Zap } from "lucide-react";
import { UrgentCareRequestStatuses } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { cn } from "@zindagi/shared";
import type { UrgentCareRequestDto, UrgentTeamDoctorOption } from "@/features/urgent-consult/types";

type BoardTab = "open" | "history";

const OPEN_STATUS_LABELS: Record<string, string> = {
  [UrgentCareRequestStatuses.REQUESTED]: "Awaiting assignment",
  [UrgentCareRequestStatuses.ASSIGNED]: "Doctor assigned",
};

const HISTORY_STATUS_LABELS: Record<string, string> = {
  [UrgentCareRequestStatuses.COMPLETED]: "Completed",
  [UrgentCareRequestStatuses.CANCELLED]: "Cancelled",
};

function resolvedAt(request: UrgentCareRequestDto) {
  return request.completedAt ?? request.cancelledAt;
}

function HistoryTable({ requests }: { requests: UrgentCareRequestDto[] }) {
  if (requests.length === 0) {
    return (
      <div
        className={`rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500 ${surfaceCard}`}
      >
        No completed or cancelled urgent care requests yet.
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ${surfaceCard}`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Doctor</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Resolved</th>
              <th className="px-4 py-3">Fee</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map((request) => {
              const resolved = resolvedAt(request);
              const isCompleted = request.status === UrgentCareRequestStatuses.COMPLETED;

              return (
                <tr key={request.requestId} className="align-top hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{request.patientName}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">{request.patientPhone}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {request.doctor?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={isCompleted ? "default" : "secondary"}
                      className={cn(
                        "gap-1",
                        isCompleted && "bg-emerald-600 hover:bg-emerald-600",
                        !isCompleted && "text-slate-700",
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {HISTORY_STATUS_LABELS[request.status] ?? request.status}
                    </Badge>
                    {request.cancellationReason ? (
                      <p className="mt-1 max-w-[12rem] text-xs text-slate-500">
                        {request.cancellationReason}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {formatKarachiDateTime(request.createdAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {resolved ? formatKarachiDateTime(resolved) : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                    {request.feePkr != null ? `Rs. ${request.feePkr.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3 max-w-[14rem] text-slate-600">
                    {request.patientNotes ? (
                      <span className="line-clamp-3">{request.patientNotes}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminUrgentCareBoard() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("requestId");
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [tab, setTab] = useState<BoardTab>("open");
  const [openRequests, setOpenRequests] = useState<UrgentCareRequestDto[]>([]);
  const [historyRequests, setHistoryRequests] = useState<UrgentCareRequestDto[]>([]);
  const [doctors, setDoctors] = useState<UrgentTeamDoctorOption[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  const loadOpen = useCallback(async () => {
    const [reqRes, docRes] = await Promise.all([
      fetch("/api/v1/admin/urgent-care"),
      fetch("/api/v1/admin/urgent-care/doctors"),
    ]);
    const reqJson = await reqRes.json();
    const docJson = await docRes.json();
    setOpenRequests(reqJson.success ? reqJson.data ?? [] : []);
    setDoctors(docJson.success ? docJson.data ?? [] : []);
  }, []);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/v1/admin/urgent-care?scope=history");
    const json = await res.json();
    setHistoryRequests(json.success ? json.data ?? [] : []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const openReq = fetch("/api/v1/admin/urgent-care");
    const historyReq =
      tab === "history" ? fetch("/api/v1/admin/urgent-care?scope=history") : null;
    const doctorsReq =
      tab === "open" ? fetch("/api/v1/admin/urgent-care/doctors") : null;

    const [openRes, historyRes, docRes] = await Promise.all([
      openReq,
      historyReq,
      doctorsReq,
    ]);

    const openJson = await openRes.json();
    setOpenRequests(openJson.success ? openJson.data ?? [] : []);

    if (historyRes) {
      const historyJson = await historyRes.json();
      setHistoryRequests(historyJson.success ? historyJson.data ?? [] : []);
    }

    if (docRes) {
      const docJson = await docRes.json();
      setDoctors(docJson.success ? docJson.data ?? [] : []);
    }

    setLoading(false);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab !== "open") return;
    const interval = setInterval(loadOpen, 15000);
    return () => clearInterval(interval);
  }, [tab, loadOpen]);

  useEffect(() => {
    if (!highlightId || loading || tab !== "open") return;
    const node = cardRefs.current[highlightId];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, loading, tab, openRequests.length]);

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
      await loadOpen();
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
      await loadOpen();
      await loadHistory();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {tab === "open"
            ? "Assign a doctor from your team for an in-app video consult within 10 minutes."
            : "Past urgent care requests and how they were resolved."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={tab === "open" ? "default" : "outline"}
            className={tab === "open" ? "bg-brand hover:bg-brand-dark" : undefined}
            onClick={() => setTab("open")}
          >
            Open queue
            {openRequests.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-[11px] font-bold">
                {openRequests.length}
              </span>
            ) : null}
          </Button>
          <Button
            size="sm"
            variant={tab === "history" ? "default" : "outline"}
            className={tab === "history" ? "bg-brand hover:bg-brand-dark" : undefined}
            onClick={() => setTab("history")}
          >
            <Clock className="mr-1.5 h-3.5 w-3.5" />
            History
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingScreen message={tab === "open" ? "Loading urgent care requests…" : "Loading history…"} />
      ) : tab === "history" ? (
        <HistoryTable requests={historyRequests} />
      ) : openRequests.length === 0 ? (
        <div
          className={`rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500 ${surfaceCard}`}
        >
          No open urgent care requests.
        </div>
      ) : (
        openRequests.map((request) => (
          <Card
            key={request.requestId}
            ref={(node) => {
              cardRefs.current[request.requestId] = node;
            }}
            className={cn(
              surfaceCard,
              highlightId === request.requestId && "ring-2 ring-brand ring-offset-2",
            )}
          >
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
                  {OPEN_STATUS_LABELS[request.status] ?? request.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="flex gap-3 rounded-xl border border-slate-200/70 bg-slate-50/80 p-3">
                  <Video className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Consult type
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-slate-900">
                      Secure video on ZindagiCare
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
