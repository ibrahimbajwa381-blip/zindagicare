"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { surfaceCard } from "@/lib/ui/surfaces";
import { cn } from "@zindagi/shared";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import {
  AdminAppointmentDetailModal,
  type AppointmentDetail,
} from "./admin-appointment-detail-modal";
import { AppointmentCardDialog } from "./appointment-card-dialog";
import type { AppointmentCardProps } from "./appointment-card";

type Appointment = AppointmentDetail;

type DoctorOption = { id: string; name: string; specialties?: string[] };

type PatientOption = { id: string; name: string; phone?: string };

type CardState = {
  card: AppointmentCardProps;
  patient: { name: string; phone?: string };
  doctor: { name: string; phone?: string };
};

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const TYPE_TABS = [
  { key: "", label: "All" },
  { key: "online", label: "Online" },
  { key: "sunday", label: "Sunday" },
  { key: "home", label: "Home care" },
  { key: "clinic", label: "Clinic" },
];

export function AdminAppointmentsBoard() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("appointmentId");
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [reassignFor, setReassignFor] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [detailFor, setDetailFor] = useState<Appointment | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [rescheduleStart, setRescheduleStart] = useState("");
  const [rescheduleDuration, setRescheduleDuration] = useState(30);
  const [showManualForm, setShowManualForm] = useState(false);
  const [formMode, setFormMode] = useState<"new" | "reschedule">("new");
  const [cardState, setCardState] = useState<CardState | null>(null);

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

  useEffect(() => {
    if (!loading && highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, highlightId, appointments]);

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

  const callReschedule = async (id: string, startIso: string, endIso: string) => {
    const res = await fetch(`/api/v1/admin/appointments/${id}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledStart: startIso, scheduledEnd: endIso }),
    });
    return res.ok;
  };

  const reschedule = async (a: Appointment) => {
    if (!rescheduleStart) return;
    const start = new Date(rescheduleStart);
    const end = new Date(start.getTime() + rescheduleDuration * 60_000);
    setPending(a.id);
    const ok = await callReschedule(a.id, start.toISOString(), end.toISOString());
    setPending(null);
    if (ok) {
      setRescheduleFor(null);
      setRescheduleStart("");
      setCardState({
        card: {
          patientName: a.patient.name,
          doctorName: a.doctor.name,
          specialty: a.doctor.specialty,
          type: a.type,
          dateLabel: formatDateLabel(start.toISOString()),
          timeLabel: formatTimeLabel(start.toISOString()),
          location: a.clinic?.hospitalName,
          status: "rescheduled",
        },
        patient: { name: a.patient.name, phone: a.patient.phone },
        doctor: { name: a.doctor.name, phone: a.doctor.phone },
      });
      await load();
    } else alert("Reschedule failed");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <Button
          size="sm"
          onClick={() => {
            if (showManualForm) {
              setShowManualForm(false);
            } else {
              setShowManualForm(true);
              setFormMode("new");
            }
          }}
        >
          {showManualForm ? "Close" : "Book / Reschedule"}
        </Button>
      </div>

      {showManualForm && (
        <Card className={surfaceCard}>
          <CardContent className="space-y-4 pt-6">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={formMode === "new" ? "default" : "outline"}
                onClick={() => setFormMode("new")}
              >
                New appointment
              </Button>
              <Button
                size="sm"
                variant={formMode === "reschedule" ? "default" : "outline"}
                onClick={() => setFormMode("reschedule")}
              >
                Reschedule existing
              </Button>
            </div>

            {formMode === "new" ? (
              <ManualAppointmentForm
                doctors={doctors}
                onCreated={(card) => {
                  setShowManualForm(false);
                  setCardState(card);
                  load();
                }}
              />
            ) : (
              <RescheduleForm
                onRescheduled={(card) => {
                  setShowManualForm(false);
                  setCardState(card);
                  load();
                }}
                callReschedule={callReschedule}
              />
            )}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <LoadingScreen message="Loading appointments…" />
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <Card
              key={a.id}
              ref={a.id === highlightId ? highlightRef : undefined}
              className={cn(
                surfaceCard,
                a.id === highlightId && "ring-2 ring-brand ring-offset-2",
              )}
            >
              <CardContent className="space-y-2 pt-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium capitalize">
                        {a.type.replace(/_/g, " ")}
                        {a.isOnline ? " · Online" : ""} · {a.patient.name}
                      </p>
                      <Badge variant="outline">{a.status}</Badge>
                    </div>
                    <p className="text-sm text-slate-500">
                      {formatKarachiDateTime(a.scheduledStart)}
                      {a.scheduledEnd
                        ? ` – ${new Date(a.scheduledEnd).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
                        : ""}
                      {" · "}
                      {a.doctor.name}
                      {a.doctor.specialty ? ` (${a.doctor.specialty})` : ""}
                    </p>
                    {(a.doctor.phone || a.doctor.email) && (
                      <p className="text-sm text-slate-500">
                        <span className="text-slate-400">Doctor: </span>
                        {[a.doctor.phone, a.doctor.email].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {(a.patient.phone || a.patient.email) && (
                      <p className="text-sm text-slate-500">
                        <span className="text-slate-400">Patient: </span>
                        {[a.patient.phone, a.patient.email].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {a.clinic && (a.clinic.hospitalName || a.clinic.address || a.clinic.city) && (
                      <p className="text-sm text-slate-500">
                        {[a.clinic.hospitalName, a.clinic.address, a.clinic.city]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                    {a.patientNotes && (
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Reason: </span>
                        {a.patientNotes}
                      </p>
                    )}
                    {typeof a.amountPkr === "number" && (
                      <p className="text-sm text-slate-500">
                        Rs. {a.amountPkr.toLocaleString()}
                        {a.paymentStatus ? ` · ${a.paymentStatus}` : ""}
                        {a.transactionId ? ` · TID ${a.transactionId}` : ""}
                      </p>
                    )}
                    {a.status === "cancelled" && a.cancellationReason && (
                      <p className="text-sm text-red-500">
                        Cancelled: {a.cancellationReason}
                      </p>
                    )}
                  </div>

                  {a.receiptUploaded && a.paymentId && (
                    <ReceiptThumbnail
                      paymentId={a.paymentId}
                      onClick={() => setDetailFor(a)}
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDetailFor(a)}>
                    View details
                  </Button>
                  {!["cancelled", "completed", "no_show"].includes(a.status) && (
                    <>
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRescheduleFor(rescheduleFor === a.id ? null : a.id);
                        setRescheduleStart("");
                      }}
                    >
                      Reschedule
                    </Button>
                    {rescheduleFor === a.id && (
                      <>
                        <input
                          type="datetime-local"
                          className="rounded-lg border px-2 py-1 text-sm"
                          value={rescheduleStart}
                          onChange={(e) => setRescheduleStart(e.target.value)}
                        />
                        <select
                          className="rounded-lg border px-2 py-1 text-sm"
                          value={rescheduleDuration}
                          onChange={(e) => setRescheduleDuration(Number(e.target.value))}
                        >
                          <option value={15}>15 min</option>
                          <option value={30}>30 min</option>
                          <option value={45}>45 min</option>
                          <option value={60}>60 min</option>
                        </select>
                        <Button
                          size="sm"
                          disabled={pending === a.id || !rescheduleStart}
                          onClick={() => reschedule(a)}
                        >
                          Confirm
                        </Button>
                      </>
                    )}
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
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {appointments.length === 0 && (
            <p className="text-sm text-slate-500">No appointments found.</p>
          )}
        </div>
      )}
      <AdminAppointmentDetailModal appointment={detailFor} onClose={() => setDetailFor(null)} />
      {cardState && (
        <AppointmentCardDialog
          card={cardState.card}
          patient={cardState.patient}
          doctor={cardState.doctor}
          onClose={() => setCardState(null)}
        />
      )}
    </div>
  );
}

function PatientSearchPicker({
  selected,
  onSelect,
}: {
  selected: PatientOption | null;
  onSelect: (patient: PatientOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      const handle = setTimeout(() => setResults([]), 0);
      return () => clearTimeout(handle);
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/v1/admin/patients/search?search=${encodeURIComponent(query.trim())}`);
      const json = await res.json();
      setSearching(false);
      if (json.success) setResults(json.data?.patients ?? []);
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg border px-2 py-1 text-sm sm:col-span-2">
        <span>
          {selected.name}
          {selected.phone ? ` · ${selected.phone}` : ""}
        </span>
        <button type="button" className="text-xs text-brand underline" onClick={() => onSelect(null)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative sm:col-span-2">
      <input
        className="w-full rounded-lg border px-2 py-1 text-sm"
        placeholder="Search existing patient by name or phone…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {searching && <p className="mt-1 text-xs text-slate-400">Searching…</p>}
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="block w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50"
              onClick={() => {
                onSelect(p);
                setQuery("");
                setResults([]);
              }}
            >
              {p.name}
              {p.phone ? ` · ${p.phone}` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ManualAppointmentForm({
  doctors,
  onCreated,
}: {
  doctors: DoctorOption[];
  onCreated: (card: CardState) => void;
}) {
  const [existingPatient, setExistingPatient] = useState<PatientOption | null>(null);
  const [patientPhone, setPatientPhone] = useState("");
  const [patientName, setPatientName] = useState("");
  const [doctorQuery, setDoctorQuery] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [type, setType] = useState<"clinic" | "online" | "home_visit">("online");
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState("");
  const [source, setSource] = useState<"whatsapp" | "phone" | "walk_in">("whatsapp");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredDoctors = doctorQuery.trim()
    ? doctors.filter((d) => d.name.toLowerCase().includes(doctorQuery.trim().toLowerCase()))
    : doctors;
  const selectedDoctorOption = doctors.find((d) => d.id === doctorId);

  const submit = async () => {
    if ((!existingPatient && !patientPhone) || !doctorId || !start) {
      setError("Select or enter a patient, choose a doctor, and pick a start time.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + duration * 60_000);
    const res = await fetch("/api/v1/admin/appointments/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: existingPatient?.id,
        patientPhone: existingPatient ? undefined : patientPhone,
        patientName: existingPatient ? undefined : patientName || undefined,
        doctorId,
        type,
        scheduledStart: startDate.toISOString(),
        scheduledEnd: endDate.toISOString(),
        patientNotes: notes || undefined,
        source,
      }),
    });
    const json = await res.json().catch(() => null);
    setSubmitting(false);
    if (res.ok && json?.success) {
      const result = json.data as {
        patient: { name: string; phone?: string };
        doctor: { name: string; phone?: string; specialty?: string };
        scheduledStart: string;
        type: string;
      };
      onCreated({
        card: {
          patientName: result.patient.name,
          doctorName: result.doctor.name,
          specialty: result.doctor.specialty,
          type: result.type,
          dateLabel: formatDateLabel(result.scheduledStart),
          timeLabel: formatTimeLabel(result.scheduledStart),
          status: "confirmed",
        },
        patient: { name: result.patient.name, phone: result.patient.phone },
        doctor: { name: result.doctor.name, phone: result.doctor.phone },
      });
    } else {
      setError(json?.error?.message ?? "Failed to create appointment");
    }
  };

  return (
    <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Search an existing registered patient, or enter a phone number for a new WhatsApp/phone
          contact.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <PatientSearchPicker selected={existingPatient} onSelect={setExistingPatient} />
          {!existingPatient && (
            <>
              <input
                className="rounded-lg border px-2 py-1 text-sm"
                placeholder="Patient phone (03xxxxxxxxx)"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
              />
              <input
                className="rounded-lg border px-2 py-1 text-sm"
                placeholder="Patient name (optional)"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
              />
            </>
          )}

          <div className="relative">
            <input
              className="w-full rounded-lg border px-2 py-1 text-sm"
              placeholder="Search doctor by name…"
              value={selectedDoctorOption ? selectedDoctorOption.name : doctorQuery}
              onChange={(e) => {
                setDoctorQuery(e.target.value);
                setDoctorId("");
              }}
            />
            {doctorQuery && !doctorId && filteredDoctors.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-white shadow-lg">
                {filteredDoctors.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="block w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setDoctorId(d.id);
                      setDoctorQuery("");
                    }}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <select
            className="rounded-lg border px-2 py-1 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="online">Online</option>
            <option value="clinic">Clinic</option>
            <option value="home_visit">Home visit</option>
          </select>
          <input
            type="datetime-local"
            className="rounded-lg border px-2 py-1 text-sm"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <select
            className="rounded-lg border px-2 py-1 text-sm"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
          <select
            className="rounded-lg border px-2 py-1 text-sm"
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Phone call</option>
            <option value="walk_in">Walk-in</option>
          </select>
          <input
            className="rounded-lg border px-2 py-1 text-sm sm:col-span-2"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button size="sm" disabled={submitting} onClick={submit}>
          Create appointment
        </Button>
    </div>
  );
}

function RescheduleForm({
  onRescheduled,
  callReschedule,
}: {
  onRescheduled: (card: CardState) => void;
  callReschedule: (id: string, startIso: string, endIso: string) => Promise<boolean>;
}) {
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patient) {
      const handle = setTimeout(() => {
        setPatientAppointments([]);
        setSelected(null);
      }, 0);
      return () => clearTimeout(handle);
    }
    const handle = setTimeout(() => {
      setLoadingAppointments(true);
      fetch(`/api/v1/admin/appointments?patientId=${patient.id}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.success) {
            const all = (json.data?.appointments ?? []) as Appointment[];
            setPatientAppointments(
              all.filter((a) => !["cancelled", "completed", "no_show"].includes(a.status)),
            );
          }
          setLoadingAppointments(false);
        });
    }, 0);
    return () => clearTimeout(handle);
  }, [patient]);

  const submit = async () => {
    if (!selected || !start) {
      setError("Select the appointment to reschedule and a new start time.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + duration * 60_000);
    const ok = await callReschedule(selected.id, startDate.toISOString(), endDate.toISOString());
    setSubmitting(false);
    if (ok) {
      onRescheduled({
        card: {
          patientName: selected.patient.name,
          doctorName: selected.doctor.name,
          specialty: selected.doctor.specialty,
          type: selected.type,
          dateLabel: formatDateLabel(startDate.toISOString()),
          timeLabel: formatTimeLabel(startDate.toISOString()),
          location: selected.clinic?.hospitalName,
          status: "rescheduled",
        },
        patient: { name: selected.patient.name, phone: selected.patient.phone },
        doctor: { name: selected.doctor.name, phone: selected.doctor.phone },
      });
    } else {
      setError("Reschedule failed. Please try again.");
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Search the patient (already registered with a doctor), pick which of their appointments
        moved, and set the new time.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <PatientSearchPicker selected={patient} onSelect={setPatient} />
      </div>

      {patient && (
        <div className="space-y-2">
          {loadingAppointments && <p className="text-sm text-slate-400">Loading appointments…</p>}
          {!loadingAppointments && patientAppointments.length === 0 && (
            <p className="text-sm text-slate-500">No active appointments found for this patient.</p>
          )}
          {patientAppointments.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a)}
              className={cn(
                "block w-full rounded-lg border px-3 py-2 text-left text-sm",
                selected?.id === a.id ? "border-brand bg-brand/5" : "hover:bg-slate-50",
              )}
            >
              <span className="font-medium capitalize">{a.type.replace(/_/g, " ")}</span>
              {" · "}
              {a.doctor.name}
              {a.doctor.specialty ? ` (${a.doctor.specialty})` : ""}
              {" · "}
              {formatKarachiDateTime(a.scheduledStart)}
              {" · "}
              <span className="capitalize">{a.status}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="datetime-local"
            className="rounded-lg border px-2 py-1 text-sm"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <select
            className="rounded-lg border px-2 py-1 text-sm"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button size="sm" disabled={submitting || !selected || !start} onClick={submit}>
        Reschedule appointment
      </Button>
    </div>
  );
}

function ReceiptThumbnail({
  paymentId,
  onClick,
}: {
  paymentId: string;
  onClick: () => void;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 overflow-hidden rounded-lg border border-slate-200 transition hover:border-brand"
      title="View receipt"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/v1/payments/${paymentId}/receipt`}
        alt="Payment receipt"
        className="h-20 w-20 object-cover bg-slate-50"
        onError={() => setFailed(true)}
      />
    </button>
  );
}
