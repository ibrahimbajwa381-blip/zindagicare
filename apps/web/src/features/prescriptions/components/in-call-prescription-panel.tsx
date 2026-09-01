"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingInline } from "@/components/ui/loading-screen";
import type { PrescriptionDetail } from "@/features/prescriptions/types";

type MedicationRow = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
};

type AppointmentContext = {
  appointmentId: string;
  patientName: string;
  canIssue: boolean;
  existingPrescription?: { id: string; downloadUrl: string };
};

type Props = {
  appointmentId: string;
  patientName?: string;
  onClose: () => void;
};

const EMPTY_MED: MedicationRow = {
  name: "",
  dosage: "",
  frequency: "",
  duration: "",
};

export function InCallPrescriptionPanel({
  appointmentId,
  patientName: patientNameProp,
  onClose,
}: Props) {
  const [context, setContext] = useState<AppointmentContext | null>(null);
  const [medications, setMedications] = useState<MedicationRow[]>([{ ...EMPTY_MED }]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PrescriptionDetail | null>(null);

  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    const res = await fetch(
      `/api/v1/doctor/prescriptions/context/${appointmentId}`,
    );
    const json = await res.json();
    if (json.success && json.data) {
      setContext(json.data as AppointmentContext);
    } else {
      setContext(null);
    }
    hasLoadedRef.current = true;
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
      setError(json.error?.message ?? "Could not issue prescription.");
    }
    setSubmitting(false);
  };

  const patientName = context?.patientName ?? patientNameProp ?? "Patient";
  const downloadUrl =
    result?.downloadUrl ?? context?.existingPrescription?.downloadUrl;
  const issued = Boolean(result || context?.existingPrescription);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-slate-900 shadow-xl">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">Write prescription</p>
          <p className="truncate text-xs text-slate-500">{patientName}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0"
          onClick={onClose}
          aria-label="Close prescription panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <LoadingInline message="Loading…" />
        ) : !context ? (
          <p className="text-sm text-red-700">Could not load appointment details.</p>
        ) : issued ? (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-900">Prescription issued</p>
            <p className="text-xs text-emerald-800">
              The patient can download it from their dashboard.
            </p>
            {downloadUrl && (
              <Button asChild size="sm" className="w-full gap-1.5">
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-3.5 w-3.5" />
                  View PDF
                </a>
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={onClose}>
              Back to call
            </Button>
          </div>
        ) : !context.canIssue ? (
          <p className="text-sm text-amber-900">
            Prescriptions can only be issued once the appointment is confirmed or in progress.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {medications.map((med, index) => (
              <div
                key={index}
                className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Medicine {index + 1}
                  </span>
                  {medications.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="inline-flex items-center gap-0.5 text-[11px] text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  )}
                </div>
                <Input
                  className="h-8 bg-white text-sm"
                  value={med.name}
                  onChange={(e) => updateMed(index, "name", e.target.value)}
                  placeholder="Medicine name"
                  required
                />
                <div className="grid grid-cols-3 gap-1.5">
                  <Input
                    className="h-8 bg-white text-xs"
                    value={med.dosage}
                    onChange={(e) => updateMed(index, "dosage", e.target.value)}
                    placeholder="Dose"
                    required
                  />
                  <Input
                    className="h-8 bg-white text-xs"
                    value={med.frequency}
                    onChange={(e) => updateMed(index, "frequency", e.target.value)}
                    placeholder="Freq."
                    required
                  />
                  <Input
                    className="h-8 bg-white text-xs"
                    value={med.duration}
                    onChange={(e) => updateMed(index, "duration", e.target.value)}
                    placeholder="Duration"
                    required
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              className="h-8 w-full gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add medicine
            </Button>

            <label className="block text-xs text-slate-600">
              Notes (optional)
              <textarea
                className="mt-1 min-h-[56px] w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Advice, follow-up…"
                maxLength={2000}
              />
            </label>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              loading={submitting}
              size="sm"
              className="w-full"
            >
              {submitting ? "Generating PDF…" : "Issue prescription"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
