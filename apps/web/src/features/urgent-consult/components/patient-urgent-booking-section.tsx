"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useTranslations } from "@/i18n/locale-provider";
import type { UrgentPatientRequestDto } from "../types";
import { PatientUrgentRequestCard } from "./patient-urgent-booking-card";

type Props = {
  initialRequest?: UrgentPatientRequestDto | null;
  variant?: "dashboard" | "profile";
};

export function PatientUrgentBookingSection({
  initialRequest = null,
  variant = "dashboard",
}: Props) {
  const t = useTranslations();
  const d = t.dashboard;
  const [request, setRequest] = useState<UrgentPatientRequestDto | null>(initialRequest);
  const [loading, setLoading] = useState(!initialRequest);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/urgent/my-booking");
    const json = await res.json();
    if (json.success && json.data) {
      setRequest(json.data as UrgentPatientRequestDto);
    } else {
      setRequest(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialRequest) {
      setRequest(initialRequest);
      setLoading(false);
      return;
    }
    load();
  }, [initialRequest, load]);

  if (variant === "profile") {
    if (loading) {
      return <LoadingScreen message={d.urgentBooking.loading} />;
    }
    if (!request) return null;
    return <PatientUrgentRequestCard request={request} variant="profile" />;
  }

  if (loading || !request) {
    return null;
  }

  return (
    <Card className="border-brand-light/40 bg-brand-muted/50 shadow-premium">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{d.urgentCare}</CardTitle>
      </CardHeader>
      <CardContent>
        <PatientUrgentRequestCard request={request} variant="dashboard" />
      </CardContent>
    </Card>
  );
}
