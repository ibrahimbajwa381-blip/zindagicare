"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageSection } from "@/components/layout/page-section";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { PatientOnlineBookingCard } from "@/features/consult/components/patient-online-booking-card";
import {
  AppointmentConfirmationModal,
  type AppointmentConfirmationDetails,
} from "@/features/consult/components/appointment-confirmation-modal";
import type { OnlinePatientBookingDto } from "@/features/consult/types";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";

export default function ConsultBookingSuccessPage() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("paymentId");
  const [booking, setBooking] = useState<OnlinePatientBookingDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationDetails, setConfirmationDetails] =
    useState<AppointmentConfirmationDetails | null>(null);

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
        const confirmed = json.data.booking as OnlinePatientBookingDto;
        setBooking(confirmed);
        setConfirmationDetails({
          doctorName: confirmed.doctor.name,
          doctorSpecialty: confirmed.doctor.specialty,
          scheduledStart: confirmed.scheduledStart,
          scheduledEnd: confirmed.scheduledEnd,
          consultationFee: confirmed.consultationFee,
          type: "online",
        });
        setConfirmationOpen(true);
        setLoading(false);
        return;
      }

      if (json.success && json.data?.status === "failed") {
        setError("Payment failed. Please try again.");
        setLoading(false);
        return;
      }

      if (attempts >= 12) {
        setError("Payment is still processing. Check your dashboard shortly.");
        setLoading(false);
        return;
      }

      setTimeout(poll, 1500);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  return (
    <>
      <AppointmentConfirmationModal
        open={confirmationOpen}
        onOpenChange={setConfirmationOpen}
        details={confirmationDetails}
      />
      <PageSection variant="soft" spacing="default" innerClassName="!py-12 sm:!py-16">
        <PageTitle
          title={loading ? "Confirming payment…" : error ? "Payment pending" : "Booking confirmed"}
          description={
            loading
              ? "Please wait while we confirm your JazzCash payment."
              : error
                ? error
                : "Your paid online consultation is confirmed."
          }
        />
      </PageSection>
      <PageSection variant="brand" spacing="lg">
        <div className={`mx-auto max-w-xl space-y-6 p-6 ${surfaceCardInteractive}`}>
          {loading && <p className="text-sm text-slate-500">Verifying payment…</p>}
          {booking && <PatientOnlineBookingCard booking={booking} variant="profile" />}
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-brand text-white hover:bg-brand-dark">
              <Link href={siteConfig.links.dashboard}>Go to dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={siteConfig.links.doctors}>Book another consult</Link>
            </Button>
          </div>
        </div>
      </PageSection>
    </>
  );
}
