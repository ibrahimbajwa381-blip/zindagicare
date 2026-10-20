"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { PageSection } from "@/components/layout/page-section";
import { surfaceMuted } from "@/lib/ui/surfaces";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { siteConfig } from "@/config/site";
import { PatientOnlineBookingCard } from "@/features/consult/components/patient-online-booking-card";
import type { OnlinePatientBookingDto } from "@/features/consult/types";
import { DoctorCard } from "@/features/marketing/components/doctor-card";
import { DoctorSearchBar } from "@/features/marketing/components/doctor-search-bar";
import { SectionHeader } from "@/features/marketing/components/section-header";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { doctorProfilePath } from "@/lib/doctors/profile-path";
import { formatQualificationsList } from "@/lib/doctors/qualifications";
import { conditionDoctorPath, getConditionBySlug } from "@/lib/seo/conditions";
import { findSpecialtiesForKeyword } from "@/lib/seo/disease-specialty-map";
import { getSpecialtyBySlug, slugifySpecialty, specialtyDoctorPath } from "@/lib/seo/specialties";
import { useTranslations } from "@/i18n/locale-provider";
import { formatMessage } from "@/i18n/messages";

export type DoctorRow = {
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
  medicalDegree?: string;
  qualifications?: string[];
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

const INITIAL_VISIBLE_DOCTORS = 30;
const TOP_RATED_COUNT = 6;
const PER_SPECIALTY_COUNT = 6;

type DoctorsConsultClientProps = {
  initialSpecialty?: string;
  initialCity?: string;
  /**
   * Listing already loaded on the server for (`initialCity`, `initialSpecialty`).
   * When present the list renders in the HTML and the first client fetch is skipped.
   */
  initialDoctors?: DoctorRow[];
};

/** Same key the server used to load `initialDoctors`. */
function listingKey(city: string | undefined, specialty: string | undefined) {
  return `${city ?? ""}|${specialty ?? ""}`;
}

export function DoctorsConsultClient({
  initialSpecialty,
  initialCity,
  initialDoctors,
}: DoctorsConsultClientProps = {}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const copy = t.doctors.page;
  const [doctors, setDoctors] = useState<DoctorRow[]>(initialDoctors ?? []);
  const [loading, setLoading] = useState(initialDoctors === undefined);
  const [booking, setBooking] = useState<OnlinePatientBookingDto | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

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

  const hasSearchQuery = searchQuery.trim().length > 0;

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (initialCity) params.set("city", initialCity);
      // When free-text search is active we fetch the full city list and filter
      // client-side, since search can match name/hospital/disease as well as specialty.
      if (activeSpecialty && !hasSearchQuery) params.set("specialty", activeSpecialty);
      const res = await fetch(`/api/v1/consult/doctors?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setDoctors(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeSpecialty, hasSearchQuery, initialCity]);

  const loadMyBooking = useCallback(async () => {
    if (!session?.user) return;
    const res = await fetch("/api/v1/consult/my-booking");
    const json = await res.json();
    if (json.success && json.data) {
      setBooking(json.data as OnlinePatientBookingDto);
    }
  }, [session?.user]);

  // Listing the current state needs, mirroring the params `loadDoctors` sends.
  const fetchKey = listingKey(
    initialCity,
    activeSpecialty && !hasSearchQuery ? activeSpecialty : undefined,
  );
  const loadedKey = useRef<string | null>(
    initialDoctors ? listingKey(initialCity, initialSpecialty) : null,
  );

  useEffect(() => {
    if (loadedKey.current === fetchKey) return;
    loadedKey.current = fetchKey;
    loadDoctors();
  }, [fetchKey, loadDoctors]);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadMyBooking();
  }, [loadMyBooking, status]);

  const visibleDoctors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return doctors;

    const matchedSpecialties = new Set(findSpecialtiesForKeyword(query));
    const scoped = activeSpecialty
      ? doctors.filter((doc) => doc.specialties.includes(activeSpecialty))
      : doctors;

    return scoped.filter((doc) => {
      if (doc.name.toLowerCase().includes(query)) return true;
      if (doc.hospital?.toLowerCase().includes(query)) return true;
      if (doc.specialties.some((specialty) => specialty.toLowerCase().includes(query))) return true;
      if (doc.specialties.some((specialty) => matchedSpecialties.has(specialty))) return true;
      return false;
    });
  }, [activeSpecialty, doctors, searchQuery]);

  useEffect(() => {
    setShowAll(false);
  }, [visibleDoctors]);

  const displayedDoctors = showAll
    ? visibleDoctors
    : visibleDoctors.slice(0, INITIAL_VISIBLE_DOCTORS);
  const hasMoreDoctors = visibleDoctors.length > displayedDoctors.length;

  const isBrowsingAll = !activeSpecialty && !hasSearchQuery;

  const topRated = useMemo(
    () => (isBrowsingAll ? visibleDoctors.slice(0, TOP_RATED_COUNT) : []),
    [isBrowsingAll, visibleDoctors],
  );

  const bySpecialty = useMemo(() => {
    if (!isBrowsingAll) return [];
    const topRatedIds = new Set(topRated.map((doc) => doc.doctorId));
    const groups = new Map<string, DoctorRow[]>();
    for (const doc of visibleDoctors) {
      if (topRatedIds.has(doc.doctorId)) continue;
      const specialty = doc.specialties[0];
      if (!specialty) continue;
      const group = groups.get(specialty) ?? [];
      group.push(doc);
      groups.set(specialty, group);
    }
    return Array.from(groups.entries())
      .map(([specialty, docs]) => ({ specialty, docs }))
      .sort((a, b) => b.docs.length - a.docs.length);
  }, [isBrowsingAll, topRated, visibleDoctors]);

  const renderDoctorCard = useCallback(
    (doc: DoctorRow) => (
      <DoctorCard
        key={doc.doctorId}
        href={doctorProfilePath(doc.slug, doc.doctorId)}
        name={doc.name}
        specialty={doc.specialties.join(" · ")}
        hospital={doc.hospital ?? ""}
        rating={doc.ratingAvg}
        reviews={doc.ratingCount}
        fee={doc.consultationFee}
        pmdcVerified={doc.pmdcVerified}
        imageUrl={resolveDoctorPortrait(doc.name, doc.avatarUrl) ?? undefined}
        credentials={formatQualificationsList(doc.medicalDegree, doc.qualifications ?? [])}
        pmdcLabel={t.common.pmdc}
        isFull={doc.isFull}
        slotsOpenLabel={
          doc.isFull
            ? undefined
            : formatMessage(copy.slotsOpen, { count: String(doc.availableSlots) })
        }
        noSlotsLabel={copy.noSlots}
        bookLabel={copy.bookCta}
      />
    ),
    [copy.bookCta, copy.noSlots, copy.slotsOpen, t.common.pmdc],
  );

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

      <div className="mt-6 sm:mt-8">
        <DoctorSearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      <div className="mt-8 sm:mt-12">
        {loading ? (
          <DoctorsListSkeleton label={copy.loading} />
        ) : visibleDoctors.length > 0 && isBrowsingAll ? (
          <div className="space-y-10 sm:space-y-14">
            {topRated.length > 0 && (
              <div>
                <h3 className="mb-4 font-display text-lg font-semibold text-slate-900 sm:mb-6 sm:text-xl">
                  Top rated doctors
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                  {topRated.map(renderDoctorCard)}
                </div>
              </div>
            )}

            {bySpecialty.map(({ specialty, docs }) => (
              <div key={specialty}>
                <div className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
                  <h3 className="font-display text-lg font-semibold text-slate-900 sm:text-xl">
                    {specialty}
                  </h3>
                  <Link
                    href={specialtyDoctorPath(slugifySpecialty(specialty))}
                    className="shrink-0 text-sm font-medium text-brand-dark underline-offset-2 hover:underline"
                  >
                    {t.common.viewAll}
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                  {docs.slice(0, PER_SPECIALTY_COUNT).map(renderDoctorCard)}
                </div>
              </div>
            ))}
          </div>
        ) : visibleDoctors.length > 0 ? (
          <>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {displayedDoctors.map(renderDoctorCard)}
          </div>
          {hasMoreDoctors && (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" onClick={() => setShowAll(true)}>
                {t.common.viewAll}
              </Button>
            </div>
          )}
          </>
        ) : hasSearchQuery ? (
          <div className={`rounded-2xl border border-dashed p-8 text-center sm:p-10 ${surfaceMuted}`}>
            <p className="font-display text-lg font-semibold text-slate-800">
              No doctors found for &ldquo;{searchQuery.trim()}&rdquo;
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
              Try a different name, specialty, or condition — or clear the search to browse all doctors.
            </p>
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
