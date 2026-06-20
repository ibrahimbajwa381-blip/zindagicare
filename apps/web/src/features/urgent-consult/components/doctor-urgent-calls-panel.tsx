"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, User, Video, Zap } from "lucide-react";
import Link from "next/link";
import { UrgentCareRequestStatuses } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { VideoJoinLinkButton } from "@/features/consult/components/video-join-link-button";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { cn } from "@zindagi/shared";
import type { UrgentCareRequestDto } from "@/features/urgent-consult/types";

export function DoctorUrgentCallsPanel() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("requestId");
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [requests, setRequests] = useState<UrgentCareRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/doctor/urgent-calls");
    const json = await res.json();
    setRequests(json.success ? json.data ?? [] : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!highlightId || loading) return;
    const node = cardRefs.current[highlightId];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, loading, requests.length]);

  const markCompleted = async (requestId: string) => {
    setPending(requestId);
    try {
      const res = await fetch(`/api/v1/doctor/urgent-calls/${requestId}/complete`, {
        method: "PATCH",
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
    return <LoadingScreen message="Loading urgent care consults…" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Patients assigned to you for urgent video consults. Join the secure session on ZindagiCare
        within 10 minutes of assignment. During the call, use the <strong>Prescription</strong> button
        in the top bar to write an e-Rx while you speak with the patient.
      </p>

      {requests.length === 0 ? (
        <div
          className={`rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500 ${surfaceCard}`}
        >
          No urgent video consults assigned to you right now.
        </div>
      ) : (
        requests.map((request) => {
          const highlighted = highlightId === request.requestId;
          const canJoin =
            request.status === UrgentCareRequestStatuses.ASSIGNED &&
            Boolean(request.appointmentId);
          const joinStart =
            request.scheduledStart ?? request.assignedAt ?? request.createdAt;
          const joinEnd =
            request.scheduledEnd ??
            new Date(new Date(joinStart).getTime() + 10 * 60_000).toISOString();

          return (
            <Card
              key={request.requestId}
              ref={(node) => {
                cardRefs.current[request.requestId] = node;
              }}
              className={cn(
                surfaceCard,
                highlighted && "ring-2 ring-brand ring-offset-2",
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
                      Assigned {formatKarachiDateTime(request.assignedAt ?? request.createdAt)}
                    </p>
                  </div>
                  <Badge variant="default">Ready for video</Badge>
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
                      <dd className="mt-1 text-sm font-medium text-slate-800">
                        Secure video on ZindagiCare
                      </dd>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-xl border border-slate-200/70 bg-slate-50/80 p-3">
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Status
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-slate-800">
                        {request.status === UrgentCareRequestStatuses.ASSIGNED
                          ? "Join video session now"
                          : request.status}
                      </dd>
                    </div>
                  </div>
                </dl>

                {request.patientNotes ? (
                  <div className="rounded-xl border border-slate-200/70 bg-white p-3 text-sm text-slate-700">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Symptoms / notes
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{request.patientNotes}</p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {canJoin ? (
                    <VideoJoinLinkButton
                      urgent
                      appointmentId={request.appointmentId!}
                      scheduledStart={joinStart}
                      scheduledEnd={joinEnd}
                      label="Join video session"
                      className="bg-brand hover:bg-brand-dark"
                      iconClassName="h-4 w-4"
                    />
                  ) : (
                    <Button disabled className="bg-brand/60">
                      <Video className="mr-2 h-4 w-4" />
                      Video session preparing…
                    </Button>
                  )}
                  {request.appointmentId ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/doctor/prescriptions/new?appointmentId=${request.appointmentId}`}>
                        <FileText className="mr-2 h-4 w-4" />
                        Issue Rx
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending === request.requestId}
                    onClick={() => markCompleted(request.requestId)}
                  >
                    {pending === request.requestId ? "Saving…" : "Mark completed"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
