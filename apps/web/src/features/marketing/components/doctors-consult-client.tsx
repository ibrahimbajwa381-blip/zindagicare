"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageSection } from "@/components/layout/page-section";
import { surfaceMuted } from "@/lib/ui/surfaces";
import { Skeleton } from "@/components/ui/skeleton";
import { siteConfig } from "@/config/site";
import { PatientOnlineBookingCard } from "@/features/consult/components/patient-online-booking-card";
import type { OnlinePatientBookingDto } from "@/features/consult/types";
import { DoctorCard } from "@/features/marketing/components/doctor-card";
import { SectionHeader } from "@/features/marketing/components/section-header";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { doctorProfilePath } from "@/lib/doctors/profile-path";
import { conditionDoctorPath, getConditionBySlug } from "@/lib/seo/conditions";
import { getSpecialtyBySlug, specialtyDoctorPath } from "@/lib/seo/specialties";
import { useTranslations } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/messages";

type DoctorRow = {
  doctorId: string;
  slug?: string;
  name: string;
  avatarUrl?: string;
  specialties: string[];
  ratingAvg: number;
  ratingCount: number;
  pmdcVerified: boolean;
  consultationFee: number;
  hospital?: string;
  availableSlots: number;
  isFull: boolean;
};

function DoctorsListSkeleton({ label }: { label: string }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-36 max-w-full" />
              <Skeleton className="h-3 w-28 max-w-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

type DoctorsConsultClientProps = {
  initialSpecialty?: string;
  initialCity?: string;
};

export function DoctorsConsultClient({
  initialSpecialty,
  initialCity = "Lahore",
}: DoctorsConsultClientProps = {}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const copy = t.doctors.page;
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<OnlinePatientBookingDto | null>(null);

  const specialtySlug = searchParams.get("specialty");
  const conditionSlug = searchParams.get("condition");

  const activeSpecialty = useMemo(() => {
    if (initialSpecialty) return initialSpecialty;
    if (specialtySlug?.trim()) {
      return getSpecialtyBySlug(specialtySlug)?.label;
    }
    if (conditionSlug?.trim()) {
      return getConditionBySlug(conditionSlug)?.specialty;
    }
    return undefined;
  }, [conditionSlug, initialSpecialty, specialtySlug]);

  useEffect(() => {
    if (initialSpecialty) return;
    if (conditionSlug?.trim()) {
      const condition = getConditionBySlug(conditionSlug);
      if (condition) {
        router.replace(conditionDoctorPath(condition.slug));
      }
      return;
    }
    if (!specialtySlug?.trim()) return;
    const specialty = getSpecialtyBySlug(specialtySlug);
    if (specialty) {
      router.replace(specialtyDoctorPath(specialty.slug));
    }
  }, [conditionSlug, initialSpecialty, router, specialtySlug]);

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ city: initialCity });
      if (activeSpecialty) params.set("specialty", activeSpecialty);
      const res = await fetch(`/api/v1/consult/doctors?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setDoctors(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeSpecialty, initialCity]);

  const loadMyBooking = useCallback(async () => {
    if (!session?.user) return;
    const res = await fetch("/api/v1/consult/my-booking");
    const json = await res.json();
    if (json.success && json.data) {
      setBooking(json.data as OnlinePatientBookingDto);
    }
  }, [session?.user]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadMyBooking();
  }, [loadMyBooking, status]);

  return (
    <PageSection id="browse-doctors" variant="brand" spacing="lg" flipBlur>
      {booking && (
        <div className="mb-10">
          <PatientOnlineBookingCard booking={booking} variant="profile" />
        </div>
      )}

      <SectionHeader
        eyebrow={t.doctors.eyebrow}
        title={copy.listTitle}
        description={copy.listDescription}
        align="center"
        className="mx-auto"
      />

      <div className="mt-8 sm:mt-12">
        {loading ? (
          <DoctorsListSkeleton label={copy.loading} />
        ) : doctors.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {doctors.map((doc) => (
              <DoctorCard
                key={doc.doctorId}
                href={doctorProfilePath(doc.slug, doc.doctorId)}
                name={doc.name}
                specialty={doc.specialties[0] ?? ""}
                hospital={doc.hospital ?? ""}
                rating={doc.ratingAvg}
                reviews={doc.ratingCount}
                fee={doc.consultationFee}
                pmdcVerified={doc.pmdcVerified}
                imageUrl={resolveDoctorPortrait(doc.name, doc.avatarUrl) ?? undefined}
                pmdcLabel={t.common.pmdc}
                isFull={doc.isFull}
                slotsOpenLabel={
                  doc.isFull
                    ? undefined
                    : formatMessage(copy.slotsOpen, {
                        count: String(doc.availableSlots),
                      })
                }
                noSlotsLabel={copy.noSlots}
                bookLabel={copy.bookCta}
              />
            ))}
          </div>
        ) : (
          <div className={`rounded-2xl border border-dashed p-8 text-center sm:p-10 ${surfaceMuted}`}>
            <p className="font-display text-lg font-semibold text-slate-800">{copy.emptyTitle}</p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
              {copy.emptyBeforeLink}{" "}
              <Link
                href={siteConfig.links.sundayConsult}
                className="font-medium text-brand-dark underline-offset-2 hover:underline"
              >
                {copy.emptyLink}
              </Link>{" "}
              {copy.emptyAfterLink}
            </p>
          </div>
        )}
      </div>
    </PageSection>
  );
}
