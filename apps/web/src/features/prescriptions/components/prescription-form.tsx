"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/loading-screen";
import type { PrescriptionDetail } from "@/features/prescriptions/types";

type MedicationRow = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
};

type AppointmentContext = {
  appointmentId: string;
  appointmentType: string;
  scheduledStart: string;
  patientName: string;
  patientPhone?: string;
  status: string;
  canIssue: boolean;
  existingPrescription?: { id: string; downloadUrl: string };
};

type Props = {
  appointmentId: string;
  copy: {
    loading: string;
    notFound: string;
    patientLabel: string;
    consultLabel: string;
    alreadyIssued: string;
    viewPdf: string;
    cannotIssue: string;
    medicationsTitle: string;
    medicineName: string;
    dosage: string;
    frequency: string;
    duration: string;
    addMedication: string;
    removeMedication: string;
    notesLabel: string;
    notesPlaceholder: string;
    submit: string;
    submitting: string;
    submitError: string;
    successTitle: string;
    successDesc: string;
    downloadPdf: string;
    backToRequests: string;
  };
};

const EMPTY_MED: MedicationRow = {
  name: "",
  dosage: "",
  frequency: "",
  duration: "",
};

export function PrescriptionForm({ appointmentId, copy }: Props) {
  const [context, setContext] = useState<AppointmentContext | null>(null);
  const [medications, setMedications] = useState<MedicationRow[]>([{ ...EMPTY_MED }]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrescriptionDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/v1/doctor/prescriptions/context/${appointmentId}`,
    );
    const json = await res.json();
    if (json.success && json.data) {
      setContext(json.data as AppointmentContext);
    } else {
      setContext(null);
    }
    setLoading(false);
  }, [appointmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateMed = (index: number, field: keyof MedicationRow, value: string) => {
    setMedications((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const addRow = () => {
    if (medications.length >= 20) return;
    setMedications((rows) => [...rows, { ...EMPTY_MED }]);
  };

  const removeRow = (index: number) => {
    if (medications.length <= 1) return;
    setMedications((rows) => rows.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      appointmentId,
      medications: medications.map((m) => ({
        name: m.name.trim(),
        dosage: m.dosage.trim(),
        frequency: m.frequency.trim(),
        duration: m.duration.trim(),
      })),
      notes: notes.trim() || undefined,
    };

    const res = await fetch("/api/v1/doctor/prescriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();

    if (json.success && json.data) {
      setResult(json.data as PrescriptionDetail);
      void load();
    } else {
      setError(json.error?.message ?? copy.submitError);
    }
    setSubmitting(false);
  };

  if (loading) {
    return <LoadingScreen message={copy.loading} />;
  }

  if (!context) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
        {copy.notFound}
      </div>
    );
  }

  if (result || context.existingPrescription) {
    const downloadUrl =
      result?.downloadUrl ?? context.existingPrescription?.downloadUrl;
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h2 className="mt-3 font-display text-lg font-semibold text-emerald-900">
          {copy.successTitle}
        </h2>
        <p className="mt-1 text-sm text-emerald-800">
          {context.existingPrescription && !result ? copy.alreadyIssued : copy.successDesc}
        </p>
        {downloadUrl && (
          <Button asChild className="mt-4 gap-1.5">
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <FileText className="h-4 w-4" />
              {copy.downloadPdf}
            </a>
          </Button>
        )}
        <Button asChild variant="outline" className="mt-3">
          <Link href="/doctor/requests">{copy.backToRequests}</Link>
        </Button>
      </div>
    );
  }

  if (!context.canIssue) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        {copy.cannotIssue}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">{copy.patientLabel}</p>
        <p className="font-medium text-slate-900">{context.patientName}</p>
        {context.patientPhone && (
          <p className="text-sm text-slate-600">{context.patientPhone}</p>
        )}
        <p className="mt-3 text-sm text-slate-500">{copy.consultLabel}</p>
        <p className="text-sm text-slate-800">
          {context.appointmentType} ·{" "}
          {new Date(context.scheduledStart).toLocaleString("en-PK", {
            timeZone: "Asia/Karachi",
          })}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900">
            {copy.medicationsTitle}
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            {copy.addMedication}
          </Button>
        </div>

        {medications.map((med, index) => (
          <div
            key={index}
            className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                #{index + 1}
              </span>
              {medications.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(index)}
                  className="h-8 gap-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {copy.removeMedication}
                </Button>
              )}
            </div>
            <label className="block text-sm">
              {copy.medicineName}
              <Input
                className="mt-1 bg-white"
                value={med.name}
                onChange={(e) => updateMed(index, "name", e.target.value)}
                placeholder="Paracetamol"
                required
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                {copy.dosage}
                <Input
                  className="mt-1 bg-white"
                  value={med.dosage}
                  onChange={(e) => updateMed(index, "dosage", e.target.value)}
                  placeholder="500mg"
                  required
                />
              </label>
              <label className="block text-sm">
                {copy.frequency}
                <Input
                  className="mt-1 bg-white"
                  value={med.frequency}
                  onChange={(e) => updateMed(index, "frequency", e.target.value)}
                  placeholder="Twice daily"
                  required
                />
              </label>
              <label className="block text-sm">
                {copy.duration}
                <Input
                  className="mt-1 bg-white"
                  value={med.duration}
                  onChange={(e) => updateMed(index, "duration", e.target.value)}
                  placeholder="5 days"
                  required
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <label className="block text-sm">
        {copy.notesLabel}
        <textarea
          className="mt-1 min-h-[100px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={copy.notesPlaceholder}
          maxLength={2000}
        />
      </label>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting} loading={submitting} className="w-full sm:w-auto">
        {submitting ? copy.submitting : copy.submit}
      </Button>
    </form>
  );
}
