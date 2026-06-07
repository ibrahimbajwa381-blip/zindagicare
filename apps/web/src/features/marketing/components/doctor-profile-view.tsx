import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  GraduationCap,
  Languages,
  MapPin,
  Star,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DoctorProfileBookingPanel } from "@/features/consult/components/doctor-profile-booking-panel";
import type {
  DoctorReviewDto,
  PublicDoctorProfile,
} from "@/features/marketing/types/doctor-public";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { doctorProfilePath } from "@/lib/doctors/profile-path";
import { surfaceCard, surfaceCardInteractive } from "@/lib/ui/surfaces";
import { cn } from "@zindagi/shared";

type Copy = {
  backToDoctors: string;
  about: string;
  education: string;
  practicesAt: string;
  languages: string;
  experience: string;
  yearsExperience: string;
  reviews: string;
  reviewsEmpty: string;
  pmdcVerified: string;
  videoConsult: string;
  perConsultation: string;
};

type Props = {
  doctor: PublicDoctorProfile;
  reviews: DoctorReviewDto[];
  reviewTotal: number;
  copy: Copy;
};

function formatReviewDate(iso: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeZone: "Asia/Karachi",
  }).format(new Date(iso));
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-200",
          )}
        />
      ))}
    </span>
  );
}

export function DoctorProfileView({ doctor, reviews, reviewTotal, copy }: Props) {
  const avatarSrc = resolveDoctorPortrait(doctor.name, doctor.avatarUrl);
  const callbackUrl = doctorProfilePath(doctor.slug, doctor.doctorId);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="space-y-6">
        <Link
          href="/doctors"
          className="inline-flex text-sm font-medium text-brand hover:text-brand-dark"
        >
          ← {copy.backToDoctors}
        </Link>

        <div className={`overflow-hidden ${surfaceCardInteractive}`}>
          <div className="bg-gradient-to-br from-brand-muted/80 via-white to-accent-muted/40 p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              {avatarSrc ? (
                <span className="relative h-28 w-28 shrink-0 overflow-hidden rounded-3xl ring-4 ring-white shadow-md">
                  <Image
                    src={avatarSrc}
                    alt={doctor.name}
                    fill
                    className="object-cover object-top"
                    sizes="112px"
                    priority
                  />
                </span>
              ) : (
                <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-3xl bg-white text-2xl font-semibold text-brand-dark ring-4 ring-white shadow-md">
                  {doctor.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start gap-2">
                  <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
                    {doctor.name}
                  </h1>
                  {doctor.pmdcVerified && (
                    <Badge
                      variant="secondary"
                      className="gap-1 border-brand-light/50 bg-white/80 text-brand-muted-foreground"
                    >
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {copy.pmdcVerified}
                    </Badge>
                  )}
                </div>

                <p className="mt-1 text-base text-brand/90">
                  {doctor.specialties.join(" · ")}
                </p>

                {doctor.hospitals[0] && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                    <Building2 className="h-4 w-4 shrink-0 text-brand" />
                    {doctor.hospitals[0].name}, {doctor.hospitals[0].city}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {doctor.ratingAvg.toFixed(1)}
                    <span className="font-normal text-slate-500">
                      ({doctor.ratingCount} {copy.reviews.toLowerCase()})
                    </span>
                  </span>
                  {doctor.experienceYears > 0 && (
                    <span className="text-sm text-slate-600">
                      {doctor.experienceYears}+ {copy.yearsExperience}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-brand-dark">
                    Rs. {doctor.consultationFee.toLocaleString()} {copy.perConsultation}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {doctor.bio && (
          <section className={`p-6 ${surfaceCard}`}>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Stethoscope className="h-5 w-5 text-brand" />
              {copy.about}
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              {doctor.bio}
            </p>
          </section>
        )}

        {(doctor.medicalDegree || doctor.medicalCollege) && (
          <section className={`p-6 ${surfaceCard}`}>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <GraduationCap className="h-5 w-5 text-brand" />
              {copy.education}
            </h2>
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              {doctor.medicalDegree && <li>{doctor.medicalDegree}</li>}
              {doctor.medicalCollege && (
                <li>
                  {doctor.medicalCollege}
                  {doctor.graduationYear ? ` · ${doctor.graduationYear}` : ""}
                </li>
              )}
            </ul>
          </section>
        )}

        {doctor.hospitals.length > 0 && (
          <section className={`p-6 ${surfaceCard}`}>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <MapPin className="h-5 w-5 text-brand" />
              {copy.practicesAt}
            </h2>
            <ul className="mt-3 space-y-3">
              {doctor.hospitals.map((hospital) => (
                <li
                  key={`${hospital.name}-${hospital.city}`}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm"
                >
                  <p className="font-medium text-slate-900">{hospital.name}</p>
                  <p className="text-slate-500">
                    {hospital.city}
                    {hospital.address ? ` · ${hospital.address}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {doctor.languages.length > 0 && (
          <section className={`p-6 ${surfaceCard}`}>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Languages className="h-5 w-5 text-brand" />
              {copy.languages}
            </h2>
            <p className="mt-3 text-sm text-slate-600">{doctor.languages.join(", ")}</p>
          </section>
        )}

        <section className={`p-6 ${surfaceCard}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">{copy.reviews}</h2>
            {reviewTotal > 0 && (
              <span className="text-sm text-slate-500">{reviewTotal} total</span>
            )}
          </div>

          {reviews.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{copy.reviewsEmpty}</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {reviews.map((review) => (
                <li
                  key={review.id}
                  className="rounded-xl border border-slate-100 bg-white/80 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{review.patientName}</p>
                      <p className="text-xs text-slate-400">
                        {formatReviewDate(review.createdAt)}
                      </p>
                    </div>
                    <RatingStars rating={review.rating} />
                  </div>
                  {review.comment && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{review.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div>
        <DoctorProfileBookingPanel doctor={doctor} callbackUrl={callbackUrl} />
      </div>
    </div>
  );
}
