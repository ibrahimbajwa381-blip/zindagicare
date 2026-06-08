"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HomeVisitStatuses,
  HomeVisitServiceTypes,
  isDoctorHomeVisitService,
} from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { VisitStatusStepper } from "./visit-status-stepper";
import type { HomeVisitDto } from "@/server/services/home-visit.service";

type NurseOption = { id: string; name: string; serviceArea: string };
type DoctorOption = {
  id: string;
  name: string;
  specialties: string[];
  serviceArea: string;
};

const SERVICE_LABELS: Record<string, string> = {
  [HomeVisitServiceTypes.DOCTOR_VISIT]: "Doctor home visit",
  [HomeVisitServiceTypes.NURSE]: "General nurse visit",
  [HomeVisitServiceTypes.IV_DRIP]: "IV drip",
  [HomeVisitServiceTypes.INJECTION]: "Injection",
  [HomeVisitServiceTypes.WOUND_CARE]: "Wound care",
};

function isDoctorVisit(visit: HomeVisitDto) {
  return isDoctorHomeVisitService(visit.serviceType);
}

export function AdminHomeVisitsBoard() {
  const [visits, setVisits] = useState<HomeVisitDto[]>([]);
  const [nurses, setNurses] = useState<NurseOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const isDev = process.env.NODE_ENV === "development";

  const load = useCallback(async () => {
    const [visitsRes, staffRes] = await Promise.all([
      fetch("/api/v1/home-visits?scope=all"),
      fetch("/api/v1/home-visits/staff"),
    ]);
    const visitsJson = await visitsRes.json();
    const staffJson = await staffRes.json();
    if (visitsJson.success) setVisits(visitsJson.data ?? []);
    if (staffJson.success) {
      setNurses(staffJson.data?.nurses ?? staffJson.data ?? []);
      setDoctors(staffJson.data?.doctors ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async (visitId: string, auto: boolean) => {
    setPending(visitId);
    try {
      const body = auto ? { auto: true } : { staffId: selectedStaff[visitId] };
      const res = await fetch(`/api/v1/home-visits/${visitId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "Assignment failed");
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setPending(null);
    }
  };

  const cancelVisit = async (visitId: string) => {
    const reason = window.prompt("Cancellation reason (optional):") ?? undefined;
    setPending(visitId);
    try {
      const res = await fetch(`/api/v1/home-visits/${visitId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: HomeVisitStatuses.CANCELLED,
          cancellationReason: reason,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Cancel failed");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setPending(null);
    }
  };

  const seedNurses = async () => {
    const res = await fetch("/api/internal/seed-home-care", { method: "POST" });
    const json = await res.json();
    if (json.success) {
      setSeedMsg(`Seeded ${json.created?.length ?? 0} demo nurses.`);
      await load();
    } else {
      setSeedMsg(json.error ?? "Seed failed");
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  const pendingVisits = visits.filter((v) => v.status === HomeVisitStatuses.REQUESTED);
  const activeVisits = visits.filter(
    (v) =>
      v.status !== HomeVisitStatuses.REQUESTED &&
      v.status !== HomeVisitStatuses.COMPLETED &&
      v.status !== HomeVisitStatuses.CANCELLED,
  );
  const closedVisits = visits.filter(
    (v) =>
      v.status === HomeVisitStatuses.COMPLETED ||
      v.status === HomeVisitStatuses.CANCELLED,
  );

  function renderAssignControls(visit: HomeVisitDto) {
    const doctorVisit = isDoctorVisit(visit);
    const options = doctorVisit ? doctors : nurses;
    const autoLabel = doctorVisit
      ? "Auto-assign nearest doctor"
      : "Auto-assign nearest nurse";
    const selectLabel = doctorVisit ? "Select doctor…" : "Select nurse…";

    return (
      <div className="flex flex-wrap gap-3">
        <Button
          size="sm"
          disabled={pending === visit.id}
          onClick={() => assign(visit.id, true)}
        >
          {autoLabel}
        </Button>
        <select
          className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
          value={selectedStaff[visit.id] ?? ""}
          onChange={(e) =>
            setSelectedStaff((s) => ({ ...s, [visit.id]: e.target.value }))
          }
        >
          <option value="">{selectLabel}</option>
          {options.map((person) => (
            <option key={person.id} value={person.id}>
              {doctorVisit
                ? `${person.name} (${(person as DoctorOption).specialties.join(", ") || "General"}) · ${person.serviceArea}`
                : `${person.name} (${person.serviceArea})`}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending === visit.id || !selectedStaff[visit.id]}
          onClick={() => assign(visit.id, false)}
        >
          Assign selected
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending === visit.id}
          onClick={() => cancelVisit(visit.id)}
        >
          Cancel request
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand/15 bg-brand-muted/30 p-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Home treatment dispatch</p>
        <p className="mt-1">
          Nurse visits (IV, injection, wound care) are matched to available nurses by
          location. Doctor home visits are matched to approved doctors with home visits
          enabled — nearest available doctor in the patient&apos;s city is assigned
          first.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {doctors.length} doctor(s) and {nurses.length} nurse(s) available for manual
          assignment.
        </p>
      </div>

      {isDev && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={seedNurses}>
            Load demo nurses (dev)
          </Button>
          {seedMsg && <span className="text-xs text-slate-600">{seedMsg}</span>}
        </div>
      )}

      {pendingVisits.length === 0 && visits.length === 0 && (
        <Card className={surfaceCard}>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            No home care visits yet.
          </CardContent>
        </Card>
      )}

      {pendingVisits.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Pending assignment ({pendingVisits.length})
          </h2>
          <div className="space-y-4">
            {pendingVisits.map((visit) => (
              <Card key={visit.id} className={surfaceCard}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">
                      {SERVICE_LABELS[visit.serviceType] ?? visit.serviceType}
                    </CardTitle>
                    <Badge variant={isDoctorVisit(visit) ? "default" : "secondary"}>
                      {isDoctorVisit(visit) ? "Doctor" : "Nurse"}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    {visit.patient?.name} · {formatKarachiDateTime(visit.scheduledAt)}
                  </p>
                  <p className="text-sm text-slate-600">{visit.address.line}</p>
                  {visit.patientNotes && (
                    <p className="text-xs text-slate-500">Notes: {visit.patientNotes}</p>
                  )}
                </CardHeader>
                <CardContent>{renderAssignControls(visit)}</CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {activeVisits.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Active visits ({activeVisits.length})
          </h2>
          <div className="space-y-4">
            {activeVisits.map((visit) => (
              <Card key={visit.id} className={surfaceCard}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">
                      {SERVICE_LABELS[visit.serviceType] ?? visit.serviceType}
                    </CardTitle>
                    <Badge variant="outline">
                      {visit.assignedStaff?.role === "doctor" ? "Doctor" : "Nurse"}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    {visit.patient?.name} ·{" "}
                    {visit.assignedStaff?.name ?? "Unassigned"}
                    {visit.assignedStaff?.specialties?.length
                      ? ` · ${visit.assignedStaff.specialties.join(", ")}`
                      : ""}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <VisitStatusStepper status={visit.status} compact />
                  {visit.status === HomeVisitStatuses.ASSIGNED && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {renderAssignControls(visit)}
                    </div>
                  )}
                  {visit.status !== HomeVisitStatuses.CANCELLED && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending === visit.id}
                      onClick={() => cancelVisit(visit.id)}
                    >
                      Cancel visit
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {closedVisits.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Completed & cancelled
          </h2>
          <div className="space-y-4">
            {closedVisits.map((visit) => (
              <Card key={visit.id} className={surfaceCard}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {SERVICE_LABELS[visit.serviceType] ?? visit.serviceType}
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    {visit.patient?.name} · {visit.assignedStaff?.name ?? "—"}
                  </p>
                </CardHeader>
                <CardContent>
                  <VisitStatusStepper status={visit.status} compact />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
