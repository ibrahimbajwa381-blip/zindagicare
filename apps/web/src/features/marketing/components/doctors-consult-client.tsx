"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Star } from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { surfaceInset, surfaceMuted } from "@/lib/ui/surfaces";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { siteConfig } from "@/config/site";
import { PatientOnlineBookingCard } from "@/features/consult/components/patient-online-booking-card";
import type { OnlinePatientBookingDto } from "@/features/consult/types";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { doctorProfilePath } from "@/lib/doctors/profile-path";
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

function DoctorAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const src = resolveDoctorPortrait(name, avatarUrl);

  if (src) {
    return (
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200">
        <Image
          src={src}
          alt={name}
          fill
          className="object-cover object-top"
          sizes="48px"
        />
      </span>
    );
  }

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-600">
      {name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)}
    </span>
  );
}

function DoctorsListSkeleton({ label }: { label: string }) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className={`rounded-xl border p-4 ${surfaceInset}`}>
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-36 max-w-full" />
              <Skeleton className="h-3 w-28 max-w-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DoctorsConsultClient() {
  const { data: session, status } = useSession();
  const t = useTranslations();
  const copy = t.doctors.page;
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<OnlinePatientBookingDto | null>(null);

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/consult/doctors");
      const json = await res.json();
      if (json.success) {
        setDoctors(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

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
    <PageSection variant="brand" spacing="lg" flipBlur>
      {booking && (
        <div className="mb-8">
          <PatientOnlineBookingCard booking={booking} variant="profile" />
        </div>
      )}

      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-foreground sm:text-xl">
          {copy.listTitle}
        </h2>
        {loading ? (
          <DoctorsListSkeleton label={copy.loading} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {doctors.map((doc) => (
            <Link
              key={doc.doctorId}
              href={doctorProfilePath(doc.slug, doc.doctorId)}
              className={`block w-full rounded-xl border p-4 text-left backdrop-blur-sm transition-all active:scale-[0.99] ${surfaceInset} hover:border-brand-light/50 hover:bg-white hover:shadow-premium`}
            >
              <div className="flex items-start justify-between gap-3">
                <DoctorAvatar name={doc.name} avatarUrl={doc.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{doc.name}</p>
                  <p className="text-sm text-slate-500">{doc.specialties[0]}</p>
                  {doc.hospital && (
                    <p className="mt-0.5 text-xs text-slate-500">{doc.hospital}</p>
                  )}
                  <p className="mt-1 flex items-center gap-1 text-sm">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {doc.ratingAvg} ({doc.ratingCount})
                  </p>
                </div>
                <div className="text-right">
                  {doc.pmdcVerified && <Badge variant="secondary">PMDC</Badge>}
                  <p className="mt-2 text-xs font-medium text-brand-dark">
                    Rs. {doc.consultationFee.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {doc.isFull
                      ? copy.noSlots
                      : formatMessage(copy.slotsOpen, {
                          count: String(doc.availableSlots),
                        })}
                  </p>
                </div>
              </div>
            </Link>
              ))}
            </div>
            {!doctors.length && (
              <div className={`border-dashed p-6 text-sm text-slate-600 ${surfaceMuted}`}>
                <p className="font-medium text-slate-800">{copy.emptyTitle}</p>
                <p className="mt-2 leading-relaxed">
                  {copy.emptyBeforeLink}{" "}
                  <Link href={siteConfig.links.sundayConsult} className="font-medium text-brand hover:underline">
                    {copy.emptyLink}
                  </Link>{" "}
                  {copy.emptyAfterLink}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </PageSection>
  );
}
