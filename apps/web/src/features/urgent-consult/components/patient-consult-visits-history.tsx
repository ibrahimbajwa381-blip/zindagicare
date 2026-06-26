"use client";

import { useTranslations } from "@/i18n/locale-provider";
import { PatientCareHistorySection } from "@/features/patient/components/patient-care-history-section";

export function PatientUrgentCareHistory() {
  const t = useTranslations();
  const u = t.urgentCare.history;
  const d = t.dashboard.appointmentHistory;

  return (
    <div className="mt-10">
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold text-foreground">{u.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{u.description}</p>
      </div>

      <PatientCareHistorySection
        historyUrl="/api/v1/urgent/history"
        title={u.consultsTitle}
        empty={u.empty}
        missedLabel={d.missed}
        statusLabels={d.status}
        reviewCopy={d.review}
        viewPrescriptionLabel={t.prescriptions.viewPrescription}
        loadingMessage={u.loadingConsults}
      />
    </div>
  );
}
