"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";

type Appointment = {
  id: string;
  type: string;
  status: string;
  scheduledStart: string;
  patient: { name: string; phone?: string };
  doctor: { id: string; name: string };
};

type DoctorOption = { id: string; name: string };

const TYPE_TABS = [
  { key: "", label: "All" },
  { key: "online", label: "Online" },
  { key: "sunday", label: "Sunday" },
  { key: "home", label: "Home care" },
  { key: "clinic", label: "Clinic" },
];

export function AdminAppointmentsBoard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [reassignFor, setReassignFor] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    const res = await fetch(`/api/v1/admin/appointments?${params}`);
    const json = await res.json();
    if (json.success) setAppointments(json.data?.appointments ?? []);
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => {
    load();
    fetch("/api/v1/admin/doctors/options")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setDoctors(json.data?.doctors ?? []);
      });
  }, [load]);

  const cancel = async (id: string) => {
    const reason = window.prompt("Cancellation reason (optional):") ?? undefined;
    setPending(id);
    const res = await fetch(`/api/v1/admin/appointments/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setPending(null);
    if (res.ok) await load();
    else alert("Cancel failed");
  };

  const reassign = async (id: string) => {
    if (!selectedDoctor) return;
    setPending(id);
    const res = await fetch(`/api/v1/admin/appointments/${id}/reassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId: selectedDoctor }),
    });
    setPending(null);
    if (res.ok) {
      setReassignFor(null);
      setSelectedDoctor("");
      await load();
    } else alert("Reassign failed");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TYPE_TABS.map((tab) => (
          <Button
            key={tab.key}
            size="sm"
            variant={typeFilter === tab.key ? "default" : "outline"}
            onClick={() => setTypeFilter(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <LoadingScreen message="Loading appointments…" />
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <Card key={a.id} className={surfaceCard}>
              <CardContent className="space-y-2 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium capitalize">
                      {a.type.replace(/_/g, " ")} · {a.patient.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatKarachiDateTime(a.scheduledStart)} · Dr. {a.doctor.name}
                    </p>
                    {a.patient.phone && (
                      <p className="text-sm text-slate-500">{a.patient.phone}</p>
                    )}
                  </div>
                  <Badge variant="outline">{a.status}</Badge>
                </div>

                {!["cancelled", "completed", "no_show"].includes(a.status) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending === a.id}
                      onClick={() => cancel(a.id)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReassignFor(reassignFor === a.id ? null : a.id);
                        setSelectedDoctor(a.doctor.id);
                      }}
                    >
                      Reassign doctor
                    </Button>
                    {reassignFor === a.id && (
                      <>
                        <select
                          className="rounded-lg border px-2 py-1 text-sm"
                          value={selectedDoctor}
                          onChange={(e) => setSelectedDoctor(e.target.value)}
                        >
                          {doctors.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          disabled={pending === a.id}
                          onClick={() => reassign(a.id)}
                        >
                          Confirm
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {appointments.length === 0 && (
            <p className="text-sm text-slate-500">No appointments found.</p>
          )}
        </div>
      )}
    </div>
  );
}
