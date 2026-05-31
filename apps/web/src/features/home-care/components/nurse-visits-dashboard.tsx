"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HomeVisitStatuses,
  HomeVisitServiceTypes,
} from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/i18n/locale-provider";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { VisitStatusStepper } from "./visit-status-stepper";
import type { HomeVisitDto } from "@/server/services/home-visit.service";
import { Upload } from "lucide-react";

const SERVICE_LABELS: Record<string, keyof ReturnType<typeof useTranslations>["homeCare"]["services"]> = {
  [HomeVisitServiceTypes.IV_DRIP]: "ivDrip",
  [HomeVisitServiceTypes.INJECTION]: "injection",
  [HomeVisitServiceTypes.WOUND_CARE]: "woundCare",
};

const NEXT_STATUS: Partial<Record<string, string>> = {
  [HomeVisitStatuses.ASSIGNED]: HomeVisitStatuses.EN_ROUTE,
  [HomeVisitStatuses.EN_ROUTE]: HomeVisitStatuses.ARRIVED,
  [HomeVisitStatuses.ARRIVED]: HomeVisitStatuses.COMPLETED,
};

const STATUS_BUTTON_LABEL: Record<string, keyof ReturnType<typeof useTranslations>["homeCare"]> = {
  [HomeVisitStatuses.ASSIGNED]: "markEnRoute",
  [HomeVisitStatuses.EN_ROUTE]: "markArrived",
  [HomeVisitStatuses.ARRIVED]: "markCompleted",
};

export function NurseVisitsDashboard() {
  const t = useTranslations();
  const h = t.homeCare;
  const [visits, setVisits] = useState<HomeVisitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/home-visits?scope=assigned");
    const json = await res.json();
    if (json.success) setVisits(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (visitId: string, status: string) => {
    setPending(visitId);
    try {
      const res = await fetch(`/api/v1/home-visits/${visitId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Update failed");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setPending(null);
    }
  };

  const uploadReport = async (visitId: string, file: File) => {
    setPending(visitId);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/v1/home-visits/${visitId}/report`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Upload failed");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPending(null);
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  if (visits.length === 0) {
    return (
      <Card className={surfaceCard}>
        <CardContent className="py-8 text-center text-sm text-slate-500">
          No assigned visits.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {visits.map((visit) => {
        const labelKey = SERVICE_LABELS[visit.serviceType];
        const serviceName = labelKey ? h.services[labelKey] : visit.serviceType;
        const nextStatus = NEXT_STATUS[visit.status];
        const buttonLabelKey = STATUS_BUTTON_LABEL[visit.status];

        return (
          <Card key={visit.id} className={surfaceCard}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{serviceName}</CardTitle>
              <p className="text-sm text-slate-500">
                {visit.patient?.name} · {formatKarachiDateTime(visit.scheduledAt)}
              </p>
              <p className="text-sm text-slate-600">{visit.address.line}</p>
              {visit.patientNotes && (
                <p className="text-sm italic text-slate-500">{visit.patientNotes}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <VisitStatusStepper status={visit.status} compact />

              <div className="flex flex-wrap gap-2">
                {nextStatus && buttonLabelKey && (
                  <Button
                    size="sm"
                    disabled={pending === visit.id}
                    onClick={() => updateStatus(visit.id, nextStatus)}
                  >
                    {h[buttonLabelKey]}
                  </Button>
                )}

                {visit.status !== HomeVisitStatuses.COMPLETED && (
                  <>
                    <input
                      ref={(el) => {
                        fileRefs.current[visit.id] = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadReport(visit.id, file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending === visit.id}
                      onClick={() => fileRefs.current[visit.id]?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      {pending === visit.id ? h.uploading : h.uploadReport}
                    </Button>
                  </>
                )}

                {visit.visitReport && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={visit.visitReport.url} target="_blank" rel="noopener noreferrer">
                      {h.viewReport}
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
