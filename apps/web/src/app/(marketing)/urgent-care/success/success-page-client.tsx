"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { PatientUrgentBookingCard } from "@/features/urgent-consult/components/patient-urgent-booking-card";
import type { UrgentPatientBookingDto } from "@/features/urgent-consult/types";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { useTranslations } from "@/i18n/locale-provider";
import { Zap } from "lucide-react";

export default function UrgentSuccessPageClient() {
  const t = useTranslations();
  const u = t.urgentCare;
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("paymentId");
  const [booking, setBooking] = useState<UrgentPatientBookingDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setLoading(false);
      setError("Missing payment reference.");
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      const res = await fetch(`/api/v1/payments/${paymentId}/status`);
      const json = await res.json();

      if (cancelled) return;

      if (json.success && json.data?.status === "paid" && json.data.booking) {
        setBooking(json.data.booking as UrgentPatientBookingDto);
        setLoading(false);
        return;
      }

      if (json.success && json.data?.status === "failed") {
        setError(u.payment.failed);
        setLoading(false);
        return;
      }

      if (attempts >= 12) {
        setError(u.payment.processingLong);
        setLoading(false);
        return;
      }

      setTimeout(poll, 1500);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [paymentId, u.payment.failed, u.payment.processingLong]);

  return (
    <>
      <PageSection variant="soft" spacing="default" innerClassName="!py-12 sm:!py-16">
        <PageTitle
          title={
            loading
              ? u.payment.confirming
              : error
                ? u.payment.pending
                : u.payment.confirmed
          }
          description={
            loading
              ? u.payment.confirmingDesc
              : error
                ? error
                : u.payment.confirmedDesc
          }
        />
      </PageSection>
      <PageSection variant="brand" spacing="lg">
        <div className={`mx-auto max-w-xl space-y-6 p-6 ${surfaceCardInteractive}`}>
          {!loading && !error && booking && (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-brand-light/40 bg-brand-muted/60 px-4 py-3 text-sm font-medium text-brand-dark">
                <Zap className="h-4 w-4 shrink-0" />
                {u.payment.doctorAssigned}
              </div>
              <PatientUrgentBookingCard request={booking} variant="profile" />
            </>
          )}
          {loading && <p className="text-sm text-slate-500">{u.payment.verifying}</p>}
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-brand hover:bg-brand-dark">
              <Link href={siteConfig.links.dashboard}>{u.payment.goDashboard}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={siteConfig.links.urgentCare}>{u.payment.backToUrgent}</Link>
            </Button>
          </div>
        </div>
      </PageSection>
    </>
  );
}
