"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageSection } from "@/components/layout/page-section";
import { surfaceCardInteractive, surfaceInset, surfaceMuted } from "@/lib/ui/surfaces";
import { SundayExplainer } from "./sunday-explainer";
import { formatNextSundayLong } from "@/lib/sunday/display";
import { useLocale, useTranslations } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { SlotPicker } from "./slot-picker";
import { useSundayRealtime } from "../hooks/use-sunday-realtime";
import { useMounted } from "@/hooks/use-mounted";
import { Star } from "lucide-react";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { PatientSundayBookingCard } from "./patient-sunday-booking-card";
import type { SundayPatientBookingDto } from "../types";
import {
  AppointmentConfirmationModal,
  type AppointmentConfirmationDetails,
} from "@/features/consult/components/appointment-confirmation-modal";

function DoctorAvatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl?: string;
  size?: "md" | "lg";
}) {
  const src = resolveDoctorPortrait(name, avatarUrl);
  const box = size === "lg" ? "h-16 w-16 rounded-2xl" : "h-12 w-12 rounded-xl";
  const text = size === "lg" ? "text-base" : "text-sm";

  if (src) {
    return (
      <span className={`relative shrink-0 overflow-hidden ring-1 ring-slate-200 ${box}`}>
        <Image src={src} alt={name} fill className="object-cover object-top" sizes={size === "lg" ? "64px" : "48px"} />
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-slate-100 font-semibold text-slate-600 ${box} ${text}`}
    >
      {name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)}
    </span>
  );
}

type DoctorRow = {
  doctorId: string;
  name: string;
  avatarUrl?: string;
  specialties: string[];
  ratingAvg: number;
  ratingCount: number;
  pmdcVerified: boolean;
  sundayDateKey: string;
  instanceId?: string;
  availableSlots: number;
  totalSlots: number;
  isFull: boolean;
};

export function SundayConsultClient() {
  const mounted = useMounted();
  const { sunday: sundayCopy, dashboard: dashboardCopy } = useTranslations();
  const { locale } = useLocale();
  const { data: session, status } = useSession();
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorRow | null>(null);
  const [slots, setSlots] = useState<
    { slotId: string; startAt: string; endAt: string; status: string }[]
  >([]);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [holdToken, setHoldToken] = useState<string | null>(null);
  const [booking, setBooking] = useState<SundayPatientBookingDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationDetails, setConfirmationDetails] =
    useState<AppointmentConfirmationDetails | null>(null);

  const loadDoctors = useCallback(async () => {
    const res = await fetch("/api/v1/sunday/doctors");
    const json = await res.json();
    if (json.success) {
      setDoctors(json.data ?? []);
    }
  }, []);

  const loadSlots = useCallback(async (doctor: DoctorRow) => {
    const res = await fetch(
      `/api/v1/sunday/slots?doctorId=${doctor.doctorId}&date=${doctor.sundayDateKey}`,
    );
    const json = await res.json();
    if (json.success) {
      setSlots(json.data.slots);
      setInstanceId(json.data.instanceId);
    }
  }, []);

  const loadMyBooking = useCallback(async () => {
    if (!session?.user) return;
    const res = await fetch("/api/v1/sunday/my-booking");
    const json = await res.json();
    if (json.success && json.data) {
      setBooking(json.data as SundayPatientBookingDto);
    }
  }, [session?.user]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadMyBooking();
  }, [loadMyBooking, status]);

  useEffect(() => {
    if (booking) {
      setSelectedDoctor(null);
      setSelectedSlotId(null);
      setHoldToken(null);
    }
  }, [booking]);

  useSundayRealtime(
    selectedDoctor?.doctorId ?? null,
    selectedDoctor?.sundayDateKey ?? null,
    () => {
      if (selectedDoctor) loadSlots(selectedDoctor);
      loadDoctors();
    },
  );

  const selectDoctor = async (doctor: DoctorRow) => {
    setSelectedDoctor(doctor);
    setSelectedSlotId(null);
    setHoldToken(null);
    setError(null);
    await loadSlots(doctor);
  };

  const reserveAndConfirm = async () => {
    if (!selectedDoctor || !selectedSlotId || !instanceId) return;
    if (status !== "authenticated") {
      window.location.href = `/login?callbackUrl=/sunday-consult`;
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const reserveRes = await fetch("/api/v1/sunday/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: selectedDoctor.doctorId,
          instanceId,
          slotId: selectedSlotId,
        }),
      });
      const reserveJson = await reserveRes.json();
      if (!reserveJson.success) {
        throw new Error(reserveJson.error?.message ?? "Could not reserve slot");
      }

      const token = reserveJson.data.holdToken;
      setHoldToken(token);

      const confirmRes = await fetch("/api/v1/sunday/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: selectedDoctor.doctorId,
          instanceId,
          slotId: selectedSlotId,
          holdToken: token,
          locale,
        }),
      });
      const confirmJson = await confirmRes.json();
      if (!confirmJson.success) {
        throw new Error(confirmJson.error?.message ?? "Could not confirm booking");
      }

      const confirmed = confirmJson.data as {
        appointmentId: string;
        scheduledStart: string;
        scheduledEnd: string;
      };

      setConfirmationDetails({
        doctorName: selectedDoctor.name,
        doctorSpecialty: selectedDoctor.specialties[0],
        scheduledStart: confirmed.scheduledStart,
        scheduledEnd: confirmed.scheduledEnd,
        type: "sunday",
        appointmentId: confirmed.appointmentId,
      });
      setConfirmationOpen(true);

      await loadMyBooking();
      setSelectedSlotId(null);
      await loadDoctors();
      if (selectedDoctor) await loadSlots(selectedDoctor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AppointmentConfirmationModal
        open={confirmationOpen}
        onOpenChange={setConfirmationOpen}
        details={confirmationDetails}
      />
      <PageSection id="how-it-works" variant="neutral" spacing="default" flipBlur>
        <div className="mb-8 sm:mb-10">
          <SundayExplainer showCta={false} hideIntro />
        </div>
        {booking && (
          <Card className="mb-8 border-brand-light/40 bg-brand-muted/60 shadow-premium">
            <CardHeader>
              <CardTitle className="text-lg">{dashboardCopy.sundayBooking.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <PatientSundayBookingCard booking={booking} variant="dashboard" />
            </CardContent>
          </Card>
        )}

        {booking ? (
          <div className={`rounded-2xl border border-brand-light/40 bg-brand-muted/50 p-6 sm:p-8 ${surfaceMuted}`}>
            <h1 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
              {sundayCopy.alreadyBookedTitle}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
              {sundayCopy.alreadyBookedMessage}
            </p>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">{sundayCopy.alreadyBookedHint}</p>
          </div>
        ) : (
          <>
            <h1 className="font-display text-xl font-semibold text-foreground sm:text-3xl">
              Book your free slot
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
              Choose a doctor below for{" "}
              <strong className="font-medium text-slate-800">
                {formatNextSundayLong()}
              </strong>
              . {sundayCopy.priceLabel} · {sundayCopy.durationLabel} · {sundayCopy.modality}.
            </p>
            <p className="mt-1 max-w-2xl text-xs text-slate-500">{sundayCopy.oneSlotDesc}</p>

            <div className="mt-6 grid gap-6 sm:mt-8 lg:grid-cols-2 lg:gap-4">
              <div className="space-y-3">
                {doctors.map((doc) => (
                  <button
                    key={doc.doctorId}
                    type="button"
                    onClick={() => selectDoctor(doc)}
                    className={`w-full rounded-xl border p-4 text-left backdrop-blur-sm transition-all active:scale-[0.99] ${
                      selectedDoctor?.doctorId === doc.doctorId
                        ? "border-brand bg-brand-muted/90 shadow-sm"
                        : `${surfaceInset} hover:border-brand-light/50 hover:bg-white hover:shadow-premium`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <DoctorAvatar name={doc.name} avatarUrl={doc.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{doc.name}</p>
                        <p className="text-sm text-slate-500">{doc.specialties[0]}</p>
                        <p className="mt-1 flex items-center gap-1 text-sm">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {doc.ratingAvg} ({doc.ratingCount})
                        </p>
                      </div>
                      <div className="text-right">
                        {doc.pmdcVerified && <Badge variant="secondary">PMDC</Badge>}
                        <p className="mt-2 text-xs text-slate-500">
                          {doc.isFull ? "Full" : `${doc.availableSlots} slots left`}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
                {!doctors.length && (
                  <div className={`border-dashed p-6 text-sm text-slate-600 ${surfaceMuted}`}>
                    <p className="font-medium text-slate-800">No Sunday doctors listed yet</p>
                    <p className="mt-2">
                      Doctors who enable Sunday Free Consult will appear here with open{" "}
                      {sundayCopy.durationLabel} video slots. Check back soon or browse{" "}
                      <Link href={siteConfig.links.doctors} className="text-brand hover:underline">
                        all doctors
                      </Link>
                      .
                    </p>
                  </div>
                )}
              </div>

              <Card className={surfaceCardInteractive}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {selectedDoctor ? `Book with ${selectedDoctor.name}` : "Select a doctor"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedDoctor && (
                    <>
                      <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                        <DoctorAvatar
                          name={selectedDoctor.name}
                          avatarUrl={selectedDoctor.avatarUrl}
                          size="lg"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{selectedDoctor.name}</p>
                          <p className="text-sm text-slate-500">{selectedDoctor.specialties[0]}</p>
                          <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            {selectedDoctor.ratingAvg} ({selectedDoctor.ratingCount})
                          </p>
                        </div>
                      </div>
                      <SlotPicker
                        slots={slots}
                        selectedSlotId={selectedSlotId}
                        onSelect={setSelectedSlotId}
                        disabled={loading}
                      />
                      {error && <p className="text-sm text-red-600">{error}</p>}
                      <Button
                        variant="default"
                        className="w-full bg-brand text-white hover:bg-brand-dark"
                        disabled={!selectedSlotId || loading}
                        onClick={reserveAndConfirm}
                      >
                        {!mounted
                          ? "Loading…"
                          : status === "authenticated"
                            ? loading
                              ? "Booking…"
                              : "Confirm free booking"
                            : "Log in to book"}
                      </Button>
                    </>
                  )}
                  {mounted && status === "unauthenticated" && (
                    <p className="text-center text-sm text-slate-500">
                      <Link href={siteConfig.links.register} className="text-brand">
                        Create account
                      </Link>{" "}
                      for free Sunday consults.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </PageSection>
    </>
  );
}

