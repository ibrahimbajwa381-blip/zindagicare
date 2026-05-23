"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageSection } from "@/components/layout/page-section";
import { SundayBanner } from "@/features/marketing/components/sunday-banner";
import { surfaceCardInteractive, surfaceInset, surfaceMuted } from "@/lib/ui/surfaces";
import { SundayExplainer } from "./sunday-explainer";
import { formatNextSundayLong } from "@/lib/sunday/display";
import { sundayConsultCopy } from "../data/sunday-consult-copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { SlotPicker } from "./slot-picker";
import { CountdownTimer } from "./countdown-timer";
import { useSundayRealtime } from "../hooks/use-sunday-realtime";
import { useMounted } from "@/hooks/use-mounted";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { Star, Video } from "lucide-react";

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
  const { data: session, status } = useSession();
  const isDev = process.env.NODE_ENV === "development";
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorRow | null>(null);
  const [slots, setSlots] = useState<
    { slotId: string; startAt: string; endAt: string; status: string }[]
  >([]);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [holdToken, setHoldToken] = useState<string | null>(null);
  const [booking, setBooking] = useState<{
    appointmentId: string;
    scheduledStart: string;
    doctorName?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadDoctors = useCallback(async () => {
    const res = await fetch("/api/v1/sunday/doctors");
    const json = await res.json();
    if (json.success) {
      setDoctors(json.data ?? []);
      return (json.data ?? []) as DoctorRow[];
    }
    return [];
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
      const doc = json.data.doctorId as { userId?: { name?: string } };
      setBooking({
        appointmentId: json.data._id,
        scheduledStart: json.data.scheduledStart,
        doctorName: doc?.userId?.name,
      });
    }
  }, [session?.user]);

  useEffect(() => {
    loadDoctors();
    if (session?.user) loadMyBooking();
  }, [loadDoctors, loadMyBooking, session?.user]);

  const runSeed = useCallback(async () => {
    setSeeding(true);
    setError(null);
    setSeedMessage(null);
    try {
      const res = await fetch("/api/internal/seed-sunday", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(
          json.error?.message ?? json.error ?? "Could not seed demo doctors",
        );
      }
      const count = json.created?.length ?? 3;
      const list = await loadDoctors();
      setSeedMessage(
        list.length > 0
          ? `Loaded ${list.length} demo doctor${list.length === 1 ? "" : "s"} with Sunday slots.`
          : `Seeded ${count} doctors — refresh if the list is still empty.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  }, [loadDoctors]);

  useEffect(() => {
    if (!mounted || !isDev) return;
    let cancelled = false;
    (async () => {
      const list = await loadDoctors();
      if (cancelled || list.length > 0) return;
      await runSeed();
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted, isDev, loadDoctors, runSeed]);

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
        }),
      });
      const confirmJson = await confirmRes.json();
      if (!confirmJson.success) {
        throw new Error(confirmJson.error?.message ?? "Could not confirm booking");
      }

      setBooking({
        appointmentId: confirmJson.data.appointmentId,
        scheduledStart: confirmJson.data.scheduledStart,
        doctorName: selectedDoctor.name,
      });
      setSelectedSlotId(null);
      await loadDoctors();
      if (selectedDoctor) await loadSlots(selectedDoctor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  const seedDemo = () => runSeed();

  return (
    <>
      <SundayBanner />
      <PageSection id="how-it-works" variant="neutral" spacing="default" flipBlur>
        <div className="mb-10">
          <SundayExplainer showCta={false} />
        </div>
        {mounted && isDev && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Button
              variant="default"
              size="sm"
              onClick={seedDemo}
              disabled={seeding || loading}
            >
              {seeding ? "Seeding…" : "Seed demo doctors"}
            </Button>
            {seedMessage && (
              <p className="text-sm text-brand-dark">{seedMessage}</p>
            )}
          </div>
        )}

        {booking && (
          <Card className="mb-8 border-brand-light/40 bg-brand-muted/60 shadow-premium">
            <CardHeader>
              <CardTitle className="text-lg">Your Sunday booking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-700">
                {booking.doctorName} —{" "}
                {mounted
                  ? formatKarachiDateTime(booking.scheduledStart)
                  : "Loading…"}
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-xs text-slate-500">Starts in</p>
                  <CountdownTimer targetDate={booking.scheduledStart} />
                </div>
                <Button asChild>
                  <Link href={`/dashboard?sunday=${booking.appointmentId}`}>
                    <Video className="h-4 w-4" />
                    Join session
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
          Book your free slot
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Choose a doctor below for{" "}
          <strong className="font-medium text-slate-800">
            {formatNextSundayLong()}
          </strong>
          . {sundayConsultCopy.priceLabel} · {sundayConsultCopy.durationLabel} ·{" "}
          {sundayConsultCopy.modality}.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {doctors.map((doc) => (
              <button
                key={doc.doctorId}
                type="button"
                onClick={() => selectDoctor(doc)}
                className={`w-full rounded-xl border p-4 text-left backdrop-blur-sm transition-all ${
                  selectedDoctor?.doctorId === doc.doctorId
                    ? "border-brand bg-brand-muted/90 shadow-sm"
                    : `${surfaceInset} hover:border-brand-light/50 hover:bg-white hover:shadow-premium`
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {doc.avatarUrl ? (
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200">
                      <Image
                        src={doc.avatarUrl}
                        alt={doc.name}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </span>
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-600">
                      {doc.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                  )}
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
                  {sundayConsultCopy.durationLabel} video slots. Check back soon or browse{" "}
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
                  <SlotPicker
                    slots={slots}
                    selectedSlotId={selectedSlotId}
                    onSelect={setSelectedSlotId}
                    disabled={loading || !!booking}
                  />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <Button
                    variant="default"
                    className="w-full bg-brand text-white hover:bg-brand-dark"
                    disabled={!selectedSlotId || loading || !!booking}
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
      </PageSection>
    </>
  );
}

