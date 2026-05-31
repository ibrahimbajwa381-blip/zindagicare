"use client";

import { useCallback, useEffect, useState } from "react";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { surfaceCardInteractive, surfaceInset } from "@/lib/ui/surfaces";

type QueueAppointment = {
  _id: string;
  scheduledStart: string;
  status: string;
  patientId: { name?: string; phone?: string };
};

export function DoctorSundayDashboard() {
  const [enabled, setEnabled] = useState(true);
  const [template, setTemplate] = useState({
    startTimeLocal: "09:00",
    endTimeLocal: "13:00",
    slotDurationMins: 10,
    maxSlots: 16,
  });
  const [appointments, setAppointments] = useState<QueueAppointment[]>([]);
  const [loading, setLoading] = useState(false);

  const loadQueue = useCallback(async () => {
    const res = await fetch("/api/v1/sunday/doctor/queue");
    const json = await res.json();
    if (json.success) {
      setAppointments(json.data.appointments ?? []);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const saveTemplate = async () => {
    setLoading(true);
    await fetch("/api/v1/sunday/doctor/template", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...template, isActive: true }),
    });
    setLoading(false);
    loadQueue();
  };

  const toggleEnabled = async () => {
    const next = !enabled;
    await fetch("/api/v1/sunday/doctor/toggle", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    setEnabled(next);
  };

  const updateStatus = async (
    appointmentId: string,
    status: "completed" | "no_show",
  ) => {
    await fetch("/api/v1/sunday/doctor/appointment-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, status }),
    });
    loadQueue();
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle
          title="Sunday Free Consult"
          description="Manage your weekly free consult slots and patient queue."
        />
        <Button
          variant="outline"
          className="shrink-0 rounded-xl border-accent/30 bg-white/90 backdrop-blur-sm"
          onClick={toggleEnabled}
        >
          {enabled ? "Disable" : "Enable"} Sunday consults
        </Button>
      </div>

      <Card className={`mt-8 ${surfaceCardInteractive}`}>
        <CardHeader>
          <CardTitle className="text-base">Weekly slot template</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Start (PK)
            <Input
              className="mt-1"
              value={template.startTimeLocal}
              onChange={(e) =>
                setTemplate((t) => ({ ...t, startTimeLocal: e.target.value }))
              }
            />
          </label>
          <label className="text-sm">
            End (PK)
            <Input
              className="mt-1"
              value={template.endTimeLocal}
              onChange={(e) =>
                setTemplate((t) => ({ ...t, endTimeLocal: e.target.value }))
              }
            />
          </label>
          <label className="text-sm">
            Duration (mins)
            <Input
              type="number"
              className="mt-1"
              value={template.slotDurationMins}
              onChange={(e) =>
                setTemplate((t) => ({
                  ...t,
                  slotDurationMins: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="text-sm">
            Max slots
            <Input
              type="number"
              className="mt-1"
              value={template.maxSlots}
              onChange={(e) =>
                setTemplate((t) => ({ ...t, maxSlots: Number(e.target.value) }))
              }
            />
          </label>
          <Button onClick={saveTemplate} disabled={loading} className="sm:col-span-2">
            Save & materialize next Sunday
          </Button>
        </CardContent>
      </Card>

      <Card className={surfaceCardInteractive}>
        <CardHeader>
          <CardTitle className="text-base">Patient queue (this Sunday)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {appointments.map((apt) => (
            <div
              key={apt._id}
              className={`flex flex-wrap items-center justify-between gap-2 p-3 ${surfaceInset}`}
            >
              <div>
                <p className="font-medium">{apt.patientId?.name ?? "Patient"}</p>
                <p className="text-xs text-slate-500">
                  {new Date(apt.scheduledStart).toLocaleString("en-PK", {
                    timeZone: "Asia/Karachi",
                  })}
                </p>
                <Badge variant="secondary" className="mt-1">
                  {apt.status}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus(apt._id, "completed")}
                >
                  Completed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus(apt._id, "no_show")}
                >
                  No-show
                </Button>
              </div>
            </div>
          ))}
          {!appointments.length && (
            <p className="text-sm text-slate-500">No bookings yet for this Sunday.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

