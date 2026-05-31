"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";

type SundayOverview = {
  sundayConsultEnabled: boolean;
  sundayDefaultMaxSlots: number;
  sundaySlotDurationMins: number;
  maintenanceMode: boolean;
  nextSundayKey: string;
  doctors: {
    doctorId: string;
    name: string;
    specialties: string[];
    totalSlots: number;
    bookedSlots: number;
    availableSlots: number;
  }[];
  queue: {
    appointmentId: string;
    patientName: string;
    patientPhone?: string;
    doctorName: string;
    scheduledStart: string;
    status: string;
  }[];
};

export function AdminSundayControl() {
  const [data, setData] = useState<SundayOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [maxSlots, setMaxSlots] = useState(10);
  const [duration, setDuration] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/admin/sunday");
    const json = await res.json();
    if (json.success) {
      setData(json.data);
      setMaxSlots(json.data.sundayDefaultMaxSlots);
      setDuration(json.data.sundaySlotDurationMins);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveSettings = async (patch: Record<string, unknown>) => {
    setPending(true);
    const res = await fetch("/api/v1/admin/sunday", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setPending(false);
    if (res.ok) await load();
    else alert("Failed to save settings");
  };

  const resetSlots = async () => {
    if (!window.confirm("Reset all Sunday slots for this week? Existing holds will be cleared.")) {
      return;
    }
    setPending(true);
    const res = await fetch("/api/v1/admin/sunday/reset", { method: "POST" });
    setPending(false);
    if (res.ok) await load();
    else alert("Reset failed");
  };

  const applyDefaults = async () => {
    setPending(true);
    const res = await fetch("/api/v1/admin/sunday/reset?action=apply-defaults", {
      method: "POST",
    });
    setPending(false);
    if (res.ok) await load();
    else alert("Failed to apply defaults");
  };

  if (loading || !data) {
    return <p className="text-sm text-slate-500">Loading Sunday consult control…</p>;
  }

  return (
    <div className="space-y-6">
      <Card className={surfaceCard}>
        <CardHeader>
          <CardTitle className="text-base">System settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.sundayConsultEnabled}
                disabled={pending}
                onChange={(e) =>
                  saveSettings({ sundayConsultEnabled: e.target.checked })
                }
              />
              Sunday consult enabled
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.maintenanceMode}
                disabled={pending}
                onChange={(e) => saveSettings({ maintenanceMode: e.target.checked })}
              />
              Maintenance mode
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Default slots per doctor (5–20)
              </label>
              <Input
                type="number"
                min={5}
                max={20}
                value={maxSlots}
                onChange={(e) => setMaxSlots(Number(e.target.value))}
                className="w-24"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Session duration (mins)
              </label>
              <Input
                type="number"
                min={5}
                max={60}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-24"
              />
            </div>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                saveSettings({
                  sundayDefaultMaxSlots: maxSlots,
                  sundaySlotDurationMins: duration,
                })
              }
            >
              Save slot defaults
            </Button>
          </div>

          <p className="text-sm text-slate-500">
            Next Sunday: <strong>{data.nextSundayKey}</strong>
          </p>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={pending} onClick={resetSlots}>
              Reset weekly slots
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={applyDefaults}>
              Apply defaults to all doctors
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className={surfaceCard}>
        <CardHeader>
          <CardTitle className="text-base">Doctor slot fill</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.doctors.map((d) => (
            <div
              key={d.doctorId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white/70 p-3 text-sm"
            >
              <div>
                <p className="font-medium">{d.name}</p>
                <p className="text-slate-500">{d.specialties.join(", ")}</p>
              </div>
              <Badge variant="outline">
                {d.bookedSlots}/{d.totalSlots} filled · {d.availableSlots} open
              </Badge>
            </div>
          ))}
          {data.doctors.length === 0 && (
            <p className="text-sm text-slate-500">No Sunday doctors configured.</p>
          )}
        </CardContent>
      </Card>

      <Card className={surfaceCard}>
        <CardHeader>
          <CardTitle className="text-base">Current queue (FIFO)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.queue.map((q, i) => (
            <div
              key={q.appointmentId}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white/70 p-3 text-sm"
            >
              <div>
                <span className="mr-2 font-mono text-slate-400">#{i + 1}</span>
                <span className="font-medium">{q.patientName}</span>
                <span className="text-slate-500"> → Dr. {q.doctorName}</span>
                <p className="text-slate-500">
                  {formatKarachiDateTime(q.scheduledStart)}
                  {q.patientPhone ? ` · ${q.patientPhone}` : ""}
                </p>
              </div>
              <Badge variant="outline">{q.status}</Badge>
            </div>
          ))}
          {data.queue.length === 0 && (
            <p className="text-sm text-slate-500">Queue is empty for this Sunday.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
