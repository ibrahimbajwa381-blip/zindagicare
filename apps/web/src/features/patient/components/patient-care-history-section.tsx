"use client";

import { useCallback, useEffect, useState } from "react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { PatientAppointmentHistorySection } from "@/features/patient/components/patient-appointment-history-section";
import type { PatientAppointmentHistoryItem } from "@/server/services/patient-appointments.service";

type ReviewCopy = {
  rateVisit: string;
  yourRating: string;
  ratingLabel: string;
  commentLabel: string;
  commentPlaceholder: string;
  submit: string;
  submitting: string;
  submitError: string;
  thankYou: string;
  optional: string;
  cancel: string;
};

type Props = {
  historyUrl?: string;
  title: string;
  empty: string;
  missedLabel: string;
  statusLabels: Record<string, string>;
  reviewCopy: ReviewCopy;
  viewPrescriptionLabel: string;
  loadingMessage: string;
  onReviewSubmitted?: () => void;
};

export function PatientCareHistorySection({
  historyUrl = "/api/v1/patient/appointments/history",
  title,
  empty,
  missedLabel,
  statusLabels,
  reviewCopy,
  viewPrescriptionLabel,
  loadingMessage,
  onReviewSubmitted,
}: Props) {
  const [items, setItems] = useState<PatientAppointmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(historyUrl);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      setItems(json.data as PatientAppointmentHistoryItem[]);
    } else {
      setItems([]);
    }
    setLoading(false);
  }, [historyUrl]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <LoadingScreen message={loadingMessage} />;
  }

  return (
    <PatientAppointmentHistorySection
      items={items}
      title={title}
      empty={empty}
      missedLabel={missedLabel}
      statusLabels={statusLabels}
      reviewCopy={reviewCopy}
      viewPrescriptionLabel={viewPrescriptionLabel}
      onReviewSubmitted={onReviewSubmitted ?? load}
    />
  );
}
