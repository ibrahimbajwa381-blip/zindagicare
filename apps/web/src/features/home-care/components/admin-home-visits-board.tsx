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
import { googleMapsLink } from "@/lib/geo/parse-google-maps-url";
import { VisitStatusStepper } from "./visit-status-stepper";
import type {
  HomeCareStaffOption,
  HomeVisitDto,
} from "@/server/services/home-visit.service";
import { ExternalLink, MapPin } from "lucide-react";

type VisitStaffLists = {
  nearby: { nurses: HomeCareStaffOption[]; doctors: HomeCareStaffOption[] };
  all: { nurses: HomeCareStaffOption[]; doctors: HomeCareStaffOption[] };
  radiusKm: number;
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

function formatStaffOption(
  person: HomeCareStaffOption,
  doctorVisit: boolean,
): string {
  const distance =
    person.distanceKm !== undefined
      ? `${person.distanceKm.toFixed(1)} km · `
      : "";
  if (doctorVisit) {
    const specs = person.specialties?.join(", ") || "General";
    return `${person.name} · ${distance}${specs} · ${person.serviceArea}`;
  }
  return `${person.name} · ${distance}${person.serviceArea}`;
}

export function AdminHomeVisitsBoard() {
  const [visits, setVisits] = useState<HomeVisitDto[]>([]);
  const [staffByVisit, setStaffByVisit] = useState<Record<string, VisitStaffLists>>({});
  const [selectedStaff, setSelectedStaff] = useState<Record<string, string>>({});
  const [manualOverride, setManualOverride] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const isDev = process.env.NODE_ENV === "development";

  const loadStaffForVisits = useCallback(async (visitList: HomeVisitDto[]) => {
    const assignable = visitList.filter(
      (v) =>
        v.status === HomeVisitStatuses.REQUESTED ||
        v.status === HomeVisitStatuses.ASSIGNED,
    );
    const results = await Promise.all(
      assignable.map(async (visit) => {
        const res = await fetch(`/api/v1/home-visits/staff?visitId=${visit.id}`);
        const json = await res.json();
        if (!json.success) return [visit.id, null] as const;
        return [
          visit.id,
          {
            nearby: json.data.nearby,
            all: json.data.all,
            radiusKm: json.data.radiusKm,
          },
        ] as const;
      }),
    );
    const next: Record<string, VisitStaffLists> = {};
    for (const [id, data] of results) {
      if (data) next[id] = data;
    }
    setStaffByVisit(next);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const visitsRes = await fetch("/api/v1/home-visits?scope=all");
    const visitsJson = await visitsRes.json();
    const list: HomeVisitDto[] = visitsJson.success ? visitsJson.data ?? [] : [];
    setVisits(list);
    await loadStaffForVisits(list);
    setLoading(false);
  }, [loadStaffForVisits]);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async (visitId: string, auto: boolean) => {
    setPending(visitId);
    try {
      const body = auto
        ? { auto: true }
        : {
            staffId: selectedStaff[visitId],
            override: manualOverride[visitId] ?? false,
          };
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
    const staffLists = staffByVisit[visit.id];
    const override = manualOverride[visit.id] ?? false;
    const nearbyOptions = doctorVisit
      ? (staffLists?.nearby.doctors ?? [])
      : (staffLists?.nearby.nurses ?? []);
    const allOptions = doctorVisit
      ? (staffLists?.all.doctors ?? [])
      : (staffLists?.all.nurses ?? []);
    const options = override ? allOptions : nearbyOptions;
    const radiusKm = staffLists?.radiusKm ?? 15;
    const autoLabel = doctorVisit
      ? "Auto-assign nearest doctor"
      : "Auto-assign nearest nurse";
    const selectLabel = doctorVisit ? "Select doctor…" : "Select nurse…";

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <Button
            size="sm"
            disabled={pending === visit.id || nearbyOptions.length === 0}
            onClick={() => assign(visit.id, true)}
          >
            {autoLabel}
          </Button>
          <select
            className="h-9 min-w-[220px] flex-1 rounded-lg border border-border bg-white px-2 text-sm"
            value={selectedStaff[visit.id] ?? ""}
            onChange={(e) =>
              setSelectedStaff((s) => ({ ...s, [visit.id]: e.target.value }))
            }
          >
            <option value="">{selectLabel}</option>
            {options.map((person) => (
              <option key={person.id} value={person.id}>
                {formatStaffOption(person, doctorVisit)}
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

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={override}
              onChange={(e) =>
                setManualOverride((s) => ({
                  ...s,
                  [visit.id]: e.target.checked,
                }))
              }
              className="rounded border-slate-300"
            />
            Assign outside {radiusKm} km radius (manual override)
          </label>
          {!override && (
            <span>
              {nearbyOptions.length} provider(s) within {radiusKm} km
              {nearbyOptions.length === 0 && " — enable override to assign any provider"}
            </span>
          )}
          {override && (
            <span>{allOptions.length} total provider(s) available</span>
          )}
        </div>
      </div>
    );
  }

  function renderPatientLocation(visit: HomeVisitDto) {
    const { geo } = visit.address;
    const mapsUrl = googleMapsLink(geo);
    return (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
      >
        <MapPin className="h-3.5 w-3.5" />
        View patient on Google Maps
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand/15 bg-brand-muted/30 p-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Home treatment dispatch</p>
        <p className="mt-1">
          Providers within 15 km of the patient&apos;s Google Maps pin are shown
          first. Use auto-assign for the closest match, pick from the list, or
          enable manual override to assign any available nurse or doctor.
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
                  {renderPatientLocation(visit)}
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
                  {renderPatientLocation(visit)}
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
