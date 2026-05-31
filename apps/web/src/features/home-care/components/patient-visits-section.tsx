"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HomeVisitServiceTypes } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/i18n/locale-provider";
import { surfaceCard } from "@/lib/ui/surfaces";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { VisitStatusStepper } from "./visit-status-stepper";
import type { HomeVisitDto } from "@/server/services/home-visit.service";

const SERVICE_LABELS: Record<string, keyof ReturnType<typeof useTranslations>["homeCare"]["services"]> = {
  [HomeVisitServiceTypes.IV_DRIP]: "ivDrip",
  [HomeVisitServiceTypes.INJECTION]: "injection",
  [HomeVisitServiceTypes.WOUND_CARE]: "woundCare",
};

export function PatientVisitsSection() {
  const t = useTranslations();
  const h = t.homeCare;
  const [visits, setVisits] = useState<HomeVisitDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/home-visits?scope=mine");
    const json = await res.json();
    if (json.success) setVisits(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (visits.length === 0) {
    return (
      <Card className={surfaceCard}>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-slate-500">{h.noVisits}</p>
          <Button asChild className="mt-4">
            <Link href="/home-care/request">{h.bookVisit}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {visits.map((visit) => {
        const labelKey = SERVICE_LABELS[visit.serviceType];
        const serviceName = labelKey ? h.services[labelKey] : visit.serviceType;
        return (
          <Card key={visit.id} className={surfaceCard}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle className="text-base">{serviceName}</CardTitle>
                <span className="text-sm font-medium text-brand-dark">
                  Rs. {visit.pricing.total.toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {formatKarachiDateTime(visit.scheduledAt)}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <VisitStatusStepper status={visit.status} compact />
              <p className="text-sm text-slate-600">{visit.address.line}</p>
              {visit.assignedStaff ? (
                <p className="text-sm">
                  <span className="text-slate-500">{h.assignedNurse}: </span>
                  <span className="font-medium">{visit.assignedStaff.name}</span>
                </p>
              ) : (
                <p className="text-sm text-amber-700">{h.pendingAssignment}</p>
              )}
              {visit.visitReport && (
                <Button variant="outline" size="sm" asChild>
                  <a href={visit.visitReport.url} target="_blank" rel="noopener noreferrer">
                    {h.viewReport}
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
