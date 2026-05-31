"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";

type PatientRow = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  appointmentCount: number;
};

type PatientDetail = PatientRow & {
  profile?: {
    gender?: string;
    bloodGroup?: string;
    defaultCity?: string;
  };
  recentAppointments: {
    id: string;
    type: string;
    status: string;
    scheduledStart: string;
    doctorName?: string;
  }[];
};

export function AdminPatientViewer() {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [selected, setSelected] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/v1/admin/patients${q}`);
    const json = await res.json();
    if (json.success) setPatients(json.data?.patients ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    const res = await fetch(`/api/v1/admin/patients/${id}`);
    const json = await res.json();
    setDetailLoading(false);
    if (json.success) setSelected(json.data?.patient ?? null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="button" variant="outline" onClick={load}>
            Search
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading patients…</p>
        ) : (
          <div className="space-y-2">
            {patients.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => loadDetail(p.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  selected?.id === p.id
                    ? "border-brand bg-brand-muted/30"
                    : "border-white/60 bg-white/85 hover:bg-white"
                }`}
              >
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-slate-500">
                  {p.phone ?? p.email ?? "No contact"} · {p.appointmentCount} bookings
                </p>
              </button>
            ))}
            {patients.length === 0 && (
              <p className="text-sm text-slate-500">No patients found.</p>
            )}
          </div>
        )}
      </div>

      <Card className={surfaceCard}>
        <CardHeader>
          <CardTitle className="text-base">Patient profile</CardTitle>
        </CardHeader>
        <CardContent>
          {detailLoading && <p className="text-sm text-slate-500">Loading…</p>}
          {!detailLoading && !selected && (
            <p className="text-sm text-slate-500">Select a patient to view details.</p>
          )}
          {selected && !detailLoading && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-lg font-semibold">{selected.name}</p>
                <p className="text-slate-500">{selected.phone ?? selected.email}</p>
                <p className="text-slate-500">City: {selected.city ?? "—"}</p>
                {selected.profile && (
                  <p className="text-slate-500">
                    {selected.profile.gender && `Gender: ${selected.profile.gender} · `}
                    {selected.profile.bloodGroup && `Blood: ${selected.profile.bloodGroup}`}
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 font-medium">Booking history</p>
                {selected.recentAppointments.length === 0 ? (
                  <p className="text-slate-500">No appointments yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {selected.recentAppointments.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-lg border border-slate-100 bg-white/70 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium capitalize">
                            {a.type.replace(/_/g, " ")}
                          </span>
                          <Badge variant="outline">{a.status}</Badge>
                        </div>
                        <p className="text-slate-500">
                          {formatKarachiDateTime(a.scheduledStart)}
                          {a.doctorName ? ` · Dr. ${a.doctorName}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
