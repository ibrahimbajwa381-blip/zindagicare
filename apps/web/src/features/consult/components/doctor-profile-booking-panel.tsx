"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JazzCashRedirectForm } from "@/features/consult/components/jazzcash-redirect-form";
import type { CheckoutResult } from "@/features/consult/types";
import type { PublicDoctorProfile } from "@/features/marketing/types/doctor-public";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { SlotPicker } from "@/features/sunday-consult/components/slot-picker";
import { siteConfig } from "@/config/site";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import { formatKarachiDate } from "@/lib/format/datetime";
import { useMounted } from "@/hooks/use-mounted";

type Step = "choose" | "review" | "pay";

type Props = {
  doctor: PublicDoctorProfile;
  callbackUrl: string;
};

function DoctorAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const src = resolveDoctorPortrait(name, avatarUrl);
  if (src) {
    return (
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-1 ring-slate-200">
        <Image src={src} alt={name} fill className="object-cover object-top" sizes="56px" />
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
  const { status } = useSession();
  const [slots, setSlots] = useState<
    { slotId: string; startAt: string; endAt: string; status: string }[]
  >([]);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [patientNotes, setPatientNotes] = useState("");
  const [step, setStep] = useState<Step>("choose");
  const [jazzcashRedirect, setJazzcashRedirect] = useState<CheckoutResult["jazzcash"] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSlots = useCallback(async () => {
    const res = await fetch(`/api/v1/consult/slots?doctorId=${doctor.doctorId}`);
    const json = await res.json();
    if (json.success) {
      setSlots(json.data.slots ?? []);
    }
  }, [doctor.doctorId]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const dateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const slot of slots) {
      keys.add(slot.startAt.slice(0, 10));
    }
    return [...keys].sort();
  }, [slots]);

  useEffect(() => {
    if (dateKeys.length && !selectedDateKey) {
      setSelectedDateKey(dateKeys[0] ?? null);
    }
  }, [dateKeys, selectedDateKey]);

  const slotsForSelectedDate = useMemo(
    () => slots.filter((s) => s.startAt.startsWith(selectedDateKey ?? "")),
    [slots, selectedDateKey],
  );

  const selectedSlot = slots.find((s) => s.slotId === selectedSlotId);

  const proceedToReview = () => {
    if (!selectedSlotId) return;
    if (status !== "authenticated") {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
      return;
    }
    setStep("review");
    setError(null);
  };

  const startCheckout = async () => {
    if (!selectedSlotId) return;
    setLoading(true);
    setError(null);
    setJazzcashRedirect(null);

    try {
      const res = await fetch("/api/v1/consult/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: doctor.doctorId,
          slotId: selectedSlotId,
          patientNotes: patientNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? "Could not start checkout");
      }

      const checkout = json.data as CheckoutResult;
      setStep("pay");

      if (checkout.testMode && checkout.testPayment?.completeUrl) {
        window.location.href = checkout.testPayment.completeUrl;
        return;
      }

      if (checkout.jazzcash) {
        setJazzcashRedirect(checkout.jazzcash);
      } else {
        throw new Error("Payment unavailable");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setStep("review");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {jazzcashRedirect && (
        <JazzCashRedirectForm
          actionUrl={jazzcashRedirect.actionUrl}
          fields={jazzcashRedirect.fields}
        />
      )}

      <Card className={`sticky top-24 ${surfaceCardInteractive}`}>
        <CardHeader>
          <CardTitle className="text-base">
            {step === "review" ? "Review & pay" : "Book video consultation"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "choose" && (
            <>
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
                emptyMessage="No open slots in the next two weeks."
              />

              {error && <p className="text-sm text-red-600">{error}</p>}

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
            </>
          )}

          {step === "review" && (
            <>
              <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Doctor</span>
                  <span className="font-medium">{doctor.name}</span>
                </div>
                {selectedSlot && mounted && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date & time</span>
                    <span className="font-medium text-right">
                      {formatKarachiDate(selectedSlot.startAt)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-3">
                  <span className="font-medium">Consultation fee</span>
                  <span className="font-semibold text-brand-dark">
                    Rs. {doctor.consultationFee.toLocaleString()}
                  </span>
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Symptoms or notes (optional)</span>
                <textarea
                  value={patientNotes}
                  onChange={(e) => setPatientNotes(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="Briefly describe your concern…"
                />
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={loading}
                  onClick={() => setStep("choose")}
                >
                  Back
                </Button>
                <Button
                  variant="default"
                  className="flex-1 bg-brand text-white hover:bg-brand-dark"
                  disabled={loading}
                  onClick={startCheckout}
                >
                  {loading ? "Starting…" : `Pay Rs. ${doctor.consultationFee.toLocaleString()}`}
                </Button>
              </div>
            </>
          )}

          {step === "pay" && loading && (
            <p className="text-center text-sm text-slate-500">Opening payment…</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
