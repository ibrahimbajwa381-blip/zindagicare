"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "@/i18n/locale-provider";
import type { SundayPatientBookingDto } from "../types";
import { PatientSundayBookingCard } from "./patient-sunday-booking-card";

type Props = {
  initialBooking?: SundayPatientBookingDto | null;
  variant?: "dashboard" | "profile";
};

export function PatientSundayBookingSection({
  initialBooking = null,
  variant = "dashboard",
}: Props) {
  const t = useTranslations();
  const d = t.dashboard;
  const [booking, setBooking] = useState<SundayPatientBookingDto | null>(initialBooking);
  const [loading, setLoading] = useState(!initialBooking);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/sunday/my-booking");
    const json = await res.json();
    if (json.success && json.data) {
      setBooking(json.data as SundayPatientBookingDto);
    } else {
      setBooking(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialBooking) {
      setBooking(initialBooking);
      setLoading(false);
      return;
    }
    load();
  }, [initialBooking, load]);

  if (variant === "profile") {
    if (loading) {
      return <p className="text-sm text-slate-500">{d.sundayBooking.loading}</p>;
    }
    if (!booking) return null;
    return <PatientSundayBookingCard booking={booking} variant="profile" />;
  }

  if (loading || !booking) {
    return null;
  }

  return (
    <Card className="border-brand-light/40 bg-brand-muted/50 shadow-premium">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{d.sundayConsult}</CardTitle>
      </CardHeader>
      <CardContent>
        <PatientSundayBookingCard booking={booking} variant="dashboard" />
      </CardContent>
    </Card>
  );
}
