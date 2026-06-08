"use client";

import { useCallback, useEffect, useState } from "react";
import { HomeVisitStatuses } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { VisitStatusStepper } from "@/features/home-care/components/visit-status-stepper";
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

export function DoctorHomeVisitsDashboard() {
  const [visits, setVisits] = useState<HomeVisitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/home-visits?scope=assigned");
    const json = await res.json();
    if (json.success) setVisits(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
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

  if (loading) return <p className="text-sm text-slate-500">Loading assigned visits…</p>;

  if (visits.length === 0) {
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
    <div className="space-y-4">
      {visits.map((visit) => {
        const next = NEXT_STATUS[visit.status];
        return (
          <Card key={visit.id} className={surfaceCard}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {visit.patient?.name ?? "Patient"}
              </CardTitle>
              <p className="text-sm text-slate-500">
                {visit.patient?.phone} · {formatKarachiDateTime(visit.scheduledAt)}
              </p>
              <p className="text-sm text-slate-600">
                {visit.address.line}, {visit.address.city}
              </p>
              {visit.patientNotes && (
                <p className="text-xs text-slate-500">Notes: {visit.patientNotes}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <VisitStatusStepper status={visit.status} compact />
              {next && (
                <Button
                  size="sm"
                  disabled={pending === visit.id}
                  onClick={() => updateStatus(visit.id, next)}
                >
                  {pending === visit.id ? "Updating…" : STATUS_LABELS[visit.status]}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
