"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HomeVisitStatuses } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { VisitStatusStepper } from "@/features/home-care/components/visit-status-stepper";
import { VisitChatLink } from "@/features/home-care/components/visit-chat-link";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import type { HomeVisitDto } from "@/server/services/home-visit.service";

const NEXT_STATUS: Partial<Record<string, string>> = {
  [HomeVisitStatuses.ASSIGNED]: HomeVisitStatuses.EN_ROUTE,
  [HomeVisitStatuses.EN_ROUTE]: HomeVisitStatuses.ARRIVED,
  [HomeVisitStatuses.ARRIVED]: HomeVisitStatuses.COMPLETED,
};

const STATUS_LABELS: Partial<Record<string, string>> = {
  [HomeVisitStatuses.ASSIGNED]: "Mark en route",
  [HomeVisitStatuses.EN_ROUTE]: "Mark arrived",
  [HomeVisitStatuses.ARRIVED]: "Mark completed",
};

const HISTORY_STATUS_LABELS: Partial<Record<string, string>> = {
  [HomeVisitStatuses.COMPLETED]: "Completed",
  [HomeVisitStatuses.CANCELLED]: "Cancelled",
};

type VisitCardProps = {
  visit: HomeVisitDto;
  pending: string | null;
  onUpdateStatus?: (visitId: string, status: string) => void;
  history?: boolean;
};

function DoctorVisitCard({ visit, pending, onUpdateStatus, history }: VisitCardProps) {
  const next = history ? undefined : NEXT_STATUS[visit.status];
  const historyLabel = HISTORY_STATUS_LABELS[visit.status];

  return (
    <Card className={surfaceCard}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base">{visit.patient?.name ?? "Patient"}</CardTitle>
          {history && historyLabel ? (
            <Badge
              variant={
                visit.status === HomeVisitStatuses.COMPLETED ? "secondary" : "outline"
              }
            >
              {historyLabel}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-slate-500">
          {visit.patient?.phone} · {formatKarachiDateTime(visit.scheduledAt)}
        </p>
        {visit.completedAt && history ? (
          <p className="text-xs text-slate-500">
            Finished {formatKarachiDateTime(visit.completedAt)}
          </p>
        ) : null}
        <p className="text-sm text-slate-600">
          {visit.address.line}, {visit.address.city}
        </p>
        {visit.patientNotes ? (
          <p className="text-xs text-slate-500">Notes: {visit.patientNotes}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <VisitStatusStepper status={visit.status} compact />
        {next && onUpdateStatus ? (
          <Button
            size="sm"
            disabled={pending === visit.id}
            onClick={() => onUpdateStatus(visit.id, next)}
          >
            {pending === visit.id ? "Updating…" : STATUS_LABELS[visit.status]}
          </Button>
        ) : null}
        {visit.canMessage && visit.patient?.id ? (
          <VisitChatLink
            audience="patient"
            href={`${AUTH_ROUTES.doctorMessages}?patient=${encodeURIComponent(visit.patient.id)}`}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DoctorHomeVisitsDashboard() {
  const [activeVisits, setActiveVisits] = useState<HomeVisitDto[]>([]);
  const [historyVisits, setHistoryVisits] = useState<HomeVisitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    const [activeRes, historyRes] = await Promise.all([
      fetch("/api/v1/home-visits?scope=assigned"),
      fetch("/api/v1/home-visits?scope=assigned-history"),
    ]);
    const [activeJson, historyJson] = await Promise.all([
      activeRes.json(),
      historyRes.json(),
    ]);
    if (activeJson.success) setActiveVisits(activeJson.data ?? []);
    if (historyJson.success) setHistoryVisits(historyJson.data ?? []);
    hasLoadedRef.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (visitId: string, status: string) => {
    setPending(visitId);
    try {
      const res = await fetch(`/api/v1/home-visits/${visitId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
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

  if (loading) return <LoadingScreen message="Loading in-house visits…" />;

  if (activeVisits.length === 0 && historyVisits.length === 0) {
    return (
      <Card className={surfaceCard}>
        <CardContent className="py-8 text-center text-sm text-slate-500">
          No in-house doctor visits assigned to you yet. Admin dispatches doctor home
          visits based on your availability and proximity to the patient.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Active visits ({activeVisits.length})
        </h2>
        {activeVisits.length === 0 ? (
          <Card className={surfaceCard}>
            <CardContent className="py-6 text-center text-sm text-slate-500">
              No active in-house visits right now.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeVisits.map((visit) => (
              <DoctorVisitCard
                key={visit.id}
                visit={visit}
                pending={pending}
                onUpdateStatus={updateStatus}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Visit history ({historyVisits.length})
        </h2>
        {historyVisits.length === 0 ? (
          <Card className={surfaceCard}>
            <CardContent className="py-6 text-center text-sm text-slate-500">
              Completed and cancelled visits will appear here.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {historyVisits.map((visit) => (
              <DoctorVisitCard
                key={visit.id}
                visit={visit}
                pending={pending}
                history
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
