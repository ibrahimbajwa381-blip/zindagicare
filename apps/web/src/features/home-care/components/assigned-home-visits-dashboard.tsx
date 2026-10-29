"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HomeVisitStatuses,
  VISIT_SUMMARY_MAX_LENGTH,
  VISIT_SUMMARY_MIN_LENGTH,
} from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useTranslations } from "@/i18n/locale-provider";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { VisitStatusStepper } from "./visit-status-stepper";
import { VisitChatLink } from "./visit-chat-link";
import type { HomeVisitDto } from "@/server/services/home-visit.service";
import { Upload } from "lucide-react";

const NEXT_STATUS: Partial<Record<string, string>> = {
  [HomeVisitStatuses.ASSIGNED]: HomeVisitStatuses.EN_ROUTE,
  [HomeVisitStatuses.EN_ROUTE]: HomeVisitStatuses.ARRIVED,
  [HomeVisitStatuses.ARRIVED]: HomeVisitStatuses.COMPLETED,
};

type StatusButtonKey = "markEnRoute" | "markArrived" | "markCompleted";

const STATUS_BUTTON_LABEL: Partial<Record<string, StatusButtonKey>> = {
  [HomeVisitStatuses.ASSIGNED]: "markEnRoute",
  [HomeVisitStatuses.EN_ROUTE]: "markArrived",
  [HomeVisitStatuses.ARRIVED]: "markCompleted",
};

export type AssignedHomeVisitsServiceLabels = Record<
  string,
  keyof ReturnType<typeof useTranslations>["homeCare"]["services"]
>;

/**
 * Shared implementation behind the nurse and physiotherapist "my assigned visits"
 * dashboards — identical load/update/upload logic and layout, differing only in
 * which service types they render a label for.
 */
export function AssignedHomeVisitsDashboard({
  serviceLabels,
  messagesHref,
  requireVisitSummary = false,
}: {
  serviceLabels: AssignedHomeVisitsServiceLabels;
  /** This portal's messages page; visits link to the patient chat there. */
  messagesHref: string;
  /** Completing a visit first asks for a written session report (sent with the status change). */
  requireVisitSummary?: boolean;
}) {
  const t = useTranslations();
  const h = t.homeCare;
  const [visits, setVisits] = useState<HomeVisitDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [summaryDrafts, setSummaryDrafts] = useState<Record<string, string>>({});
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

  const updateStatus = async (visitId: string, status: string, visitSummary?: string) => {
    setPending(visitId);
    try {
      const res = await fetch(`/api/v1/home-visits/${visitId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, visitSummary }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? "Update failed");
      if (visitSummary !== undefined) {
        setCompletingId(null);
        setSummaryDrafts((d) => {
          const next = { ...d };
          delete next[visitId];
          return next;
        });
      }
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

  if (loading) return <LoadingScreen message="Loading visits…" />;

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
        const labelKey = serviceLabels[visit.serviceType];
        const serviceName = labelKey ? h.services[labelKey] : visit.serviceType;
        const nextStatus = NEXT_STATUS[visit.status];
        const buttonLabelKey = STATUS_BUTTON_LABEL[visit.status];
        const needsSummary =
          requireVisitSummary && nextStatus === HomeVisitStatuses.COMPLETED;
        const summaryDraft = summaryDrafts[visit.id] ?? "";
        const summaryLength = summaryDraft.trim().length;

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

              {needsSummary && completingId === visit.id && (
                <div className="space-y-2 rounded-lg border border-brand/20 bg-brand-muted/20 p-3">
                  <label htmlFor={`summary-${visit.id}`} className="block text-sm font-medium text-slate-900">
                    {h.visitSummary.label}
                  </label>
                  <p className="text-xs text-slate-600">{h.visitSummary.hint}</p>
                  <textarea
                    id={`summary-${visit.id}`}
                    rows={5}
                    maxLength={VISIT_SUMMARY_MAX_LENGTH}
                    value={summaryDraft}
                    onChange={(e) =>
                      setSummaryDrafts((d) => ({ ...d, [visit.id]: e.target.value }))
                    }
                    placeholder={h.visitSummary.placeholder}
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    {summaryLength < VISIT_SUMMARY_MIN_LENGTH
                      ? h.visitSummary.minLength.replace("{count}", String(VISIT_SUMMARY_MIN_LENGTH))
                      : `${summaryLength}/${VISIT_SUMMARY_MAX_LENGTH}`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={pending === visit.id || summaryLength < VISIT_SUMMARY_MIN_LENGTH}
                      onClick={() =>
                        updateStatus(visit.id, HomeVisitStatuses.COMPLETED, summaryDraft.trim())
                      }
                    >
                      {h.visitSummary.submit}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending === visit.id}
                      onClick={() => setCompletingId(null)}
                    >
                      {h.review.cancel}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {nextStatus && buttonLabelKey && !(needsSummary && completingId === visit.id) && (
                  <Button
                    size="sm"
                    disabled={pending === visit.id}
                    onClick={() =>
                      needsSummary
                        ? setCompletingId(visit.id)
                        : updateStatus(visit.id, nextStatus)
                    }
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

                {visit.canMessage && visit.patient?.id && (
                  <VisitChatLink
                    audience="patient"
                    href={`${messagesHref}?patient=${encodeURIComponent(visit.patient.id)}`}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
