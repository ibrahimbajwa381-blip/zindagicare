"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HomeVisitStatuses,
  HomeVisitServiceTypes,
} from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { VisitStatusStepper } from "./visit-status-stepper";
import type { HomeVisitDto } from "@/server/services/home-visit.service";

type StaffOption = { id: string; name: string; serviceArea: string };

const SERVICE_LABELS: Record<string, string> = {
  [HomeVisitServiceTypes.IV_DRIP]: "IV drip",
  [HomeVisitServiceTypes.INJECTION]: "Injection",
  [HomeVisitServiceTypes.WOUND_CARE]: "Wound care",
};

export function AdminHomeVisitsBoard() {
  const [visits, setVisits] = useState<HomeVisitDto[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
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
    if (staffJson.success) setStaff(staffJson.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async (visitId: string, auto: boolean) => {
    setPending(visitId);
    try {
      const body = auto
        ? { auto: true }
        : { staffId: selectedStaff[visitId] };
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

  const pendingVisits = visits.filter(
    (v) => v.status === HomeVisitStatuses.REQUESTED,
  );

  return (
    <div className="space-y-6">
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
                  <CardTitle className="text-base">
                    {SERVICE_LABELS[visit.serviceType] ?? visit.serviceType}
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    {visit.patient?.name} · {formatKarachiDateTime(visit.scheduledAt)}
                  </p>
                  <p className="text-sm text-slate-600">{visit.address.line}</p>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button
                    size="sm"
                    disabled={pending === visit.id}
                    onClick={() => assign(visit.id, true)}
                  >
                    Auto-assign nearest nurse
                  </Button>
                  <select
                    className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
                    value={selectedStaff[visit.id] ?? ""}
                    onChange={(e) =>
                      setSelectedStaff((s) => ({ ...s, [visit.id]: e.target.value }))
                    }
                  >
                    <option value="">Select nurse…</option>
                    {staff.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.serviceArea})
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
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {visits.filter((v) => v.status !== HomeVisitStatuses.REQUESTED).length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Active & completed
          </h2>
          <div className="space-y-4">
            {visits
              .filter((v) => v.status !== HomeVisitStatuses.REQUESTED)
              .map((visit) => (
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
