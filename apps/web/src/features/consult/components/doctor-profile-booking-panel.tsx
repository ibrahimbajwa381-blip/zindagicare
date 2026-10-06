"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsultReviewPaymentModal } from "@/features/consult/components/consult-review-payment-modal";
import { JazzCashRedirectForm } from "@/features/consult/components/jazzcash-redirect-form";
import {
  usePaymentProviders,
} from "@/features/consult/hooks/use-payment-providers";
import type { PaymentProviderInput } from "@zindagi/validators";
import type { CheckoutResult } from "@/features/consult/types";
import type { PublicDoctorProfile } from "@/features/marketing/types/doctor-public";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { SlotPicker } from "@/features/sunday-consult/components/slot-picker";
import { siteConfig } from "@/config/site";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { getConsultSlotDateKey } from "@/lib/consult/slot-utils";
import { formatKarachiDate } from "@/lib/format/datetime";
import { useMounted } from "@/hooks/use-mounted";
import { useLocale } from "@/i18n/locale-provider";

type Props = {
  doctor: PublicDoctorProfile;
  callbackUrl: string;
};

function DoctorAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const src = resolveDoctorPortrait(name, avatarUrl);
  if (src) {
    return (
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-1 ring-slate-200">
        <Image src={src} alt={name} fill className="object-cover object-top" sizes="56px" unoptimized />
      </span>
    );
  }
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-600">
      {name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)}
    </span>
  );
}

export function DoctorProfileBookingPanel({ doctor, callbackUrl }: Props) {
  const mounted = useMounted();
  const { locale } = useLocale();
  const { data: session, status } = useSession();
  const needsPhone = status === "authenticated" && session?.user?.hasPhone === false;
  const [phone, setPhone] = useState("");
  const [slots, setSlots] = useState<
    { slotId: string; startAt: string; endAt: string; status: string }[]
  >([]);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [patientNotes, setPatientNotes] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const { defaultProvider } = usePaymentProviders();
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderInput>(defaultProvider);
  const [gatewayRedirect, setGatewayRedirect] = useState<CheckoutResult["gatewayRedirect"] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(true);

  useEffect(() => {
    setPaymentProvider(defaultProvider);
  }, [defaultProvider]);

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/v1/consult/slots?doctorId=${doctor.doctorId}`);
      const json = await res.json();
      if (json.success) {
        setSlots(json.data.slots ?? []);
      }
    } finally {
      setSlotsLoading(false);
    }
  }, [doctor.doctorId]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const dateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const slot of slots) {
      keys.add(getConsultSlotDateKey(slot.slotId));
    }
    return [...keys].sort();
  }, [slots]);

  useEffect(() => {
    if (dateKeys.length && !selectedDateKey) {
      setSelectedDateKey(dateKeys[0] ?? null);
    }
  }, [dateKeys, selectedDateKey]);

  const slotsForSelectedDate = useMemo(
    () =>
      slots.filter(
        (s) => getConsultSlotDateKey(s.slotId) === (selectedDateKey ?? ""),
      ),
    [slots, selectedDateKey],
  );

  const selectedSlot = slots.find((s) => s.slotId === selectedSlotId);

  const proceedToReview = () => {
    if (!selectedSlotId) return;
    if (status !== "authenticated") {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      return;
    }
    setReviewOpen(true);
    setError(null);
  };

  const startCheckout = async () => {
    if (!selectedSlotId) return;
    if (needsPhone && !phone.trim()) {
      setError("Please add your mobile number to continue");
      return;
    }
    setLoading(true);
    setError(null);
    setGatewayRedirect(null);

    try {
      const res = await fetch("/api/v1/consult/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: doctor.doctorId,
          slotId: selectedSlotId,
          patientNotes: patientNotes.trim() || undefined,
          locale,
          paymentProvider,
          phone: needsPhone ? phone.trim() : undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "Could not start checkout");
      }

      const checkout = json.data as CheckoutResult;

      const payUrl =
        checkout.manualTransfer?.payUrl ?? checkout.testPayment?.completeUrl;
      if (payUrl) {
        window.location.href = payUrl;
        return;
      }

      const redirect = checkout.gatewayRedirect ?? checkout.jazzcash;
      if (redirect) {
        setGatewayRedirect(redirect);
      } else {
        throw new Error("Payment unavailable");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {gatewayRedirect && (
        <JazzCashRedirectForm
          actionUrl={gatewayRedirect.actionUrl}
          fields={gatewayRedirect.fields}
        />
      )}

      <ConsultReviewPaymentModal
        open={reviewOpen}
        onOpenChange={(open) => {
          setReviewOpen(open);
          if (!open) setError(null);
        }}
        doctorName={doctor.name}
        doctorSpecialty={doctor.specialties[0]}
        doctorAvatarUrl={doctor.avatarUrl}
        consultationFee={doctor.consultationFee}
        slotStartAt={selectedSlot?.startAt}
        slotFormatted={mounted}
        patientNotes={patientNotes}
        onPatientNotesChange={setPatientNotes}
        needsPhone={needsPhone}
        phone={phone}
        onPhoneChange={setPhone}
        loading={loading}
        error={error}
        paymentProvider={paymentProvider}
        onPaymentProviderChange={setPaymentProvider}
        onPay={startCheckout}
      />

      <Card className={`lg:sticky lg:top-[var(--profile-sticky-top,9rem)] lg:transition-[top] lg:duration-300 lg:ease-in-out ${surfaceCardInteractive}`}>
        <CardHeader>
          <CardTitle className="text-base">Book video consultation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <DoctorAvatar name={doctor.name} avatarUrl={doctor.avatarUrl} />
                <div className="min-w-0">
                  <p className="font-semibold">{doctor.name}</p>
                  <p className="text-sm text-slate-500">{doctor.specialties[0]}</p>
                  <p className="mt-1 flex items-center gap-1 text-sm">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {doctor.ratingAvg} ({doctor.ratingCount})
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-brand-light/30 bg-brand-muted/40 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Consultation fee
                </p>
                <p className="font-display text-2xl font-semibold text-brand-dark">
                  Rs. {doctor.consultationFee.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {doctor.isFull
                    ? "No open slots — check back soon"
                    : `${doctor.availableSlots} slots available in the next 2 weeks`}
                </p>
              </div>

              {dateKeys.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {dateKeys.map((key) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={selectedDateKey === key ? "default" : "outline"}
                      className={
                        selectedDateKey === key ? "bg-brand text-white hover:bg-brand-dark" : ""
                      }
                      onClick={() => {
                        setSelectedDateKey(key);
                        setSelectedSlotId(null);
                      }}
                    >
                      {mounted ? formatKarachiDate(`${key}T12:00:00`) : key}
                    </Button>
                  ))}
                </div>
              )}

              <SlotPicker
                slots={slotsForSelectedDate}
                selectedSlotId={selectedSlotId}
                onSelect={setSelectedSlotId}
                disabled={loading || doctor.isFull}
                loading={slotsLoading}
                emptyMessage="No open slots in the next two weeks."
              />

              <Button
                variant="default"
                className="w-full bg-brand text-white hover:bg-brand-dark"
                disabled={!selectedSlotId || loading || doctor.isFull}
                onClick={proceedToReview}
              >
                {!mounted
                  ? "Loading…"
                  : status === "authenticated"
                    ? "Continue to payment"
                    : "Log in to book"}
              </Button>

              {mounted && status === "unauthenticated" && (
                <p className="text-center text-sm text-slate-500">
                  <Link href={siteConfig.links.register} className="text-brand">
                    Create account
                  </Link>{" "}
                  to book paid online consultations.
                </p>
              )}
        </CardContent>
      </Card>
    </>
  );
}
