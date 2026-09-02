"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { doctorProfilePath } from "@/lib/doctors/profile-path";
import type { DoctorReferralPayload } from "@zindagi/validators";

type CopilotDoctorReferralListProps = {
  doctors: DoctorReferralPayload[];
  title: string;
  feeLabel: string;
  verifiedLabel: string;
  slotsLabel: string;
  viewProfileLabel: string;
};

export function CopilotDoctorReferralList({
  doctors,
  title,
  feeLabel,
  verifiedLabel,
  slotsLabel,
  viewProfileLabel,
}: CopilotDoctorReferralListProps) {
  if (!doctors.length) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-brand-muted/60 to-white px-3.5 py-2.5">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
      <ul className="divide-y divide-slate-100 p-2">
        {doctors.map((doctor) => {
          const avatarSrc = resolveDoctorPortrait(doctor.name, doctor.avatarUrl);
          const profileHref = doctorProfilePath(doctor.slug, doctor.doctorId);

          return (
            <li key={doctor.doctorId}>
              <Link
                href={profileHref}
                className="group flex items-start gap-3 rounded-xl p-2.5 transition-all hover:bg-brand-muted/25"
              >
                {avatarSrc ? (
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-2 ring-white shadow-sm">
                    <Image
                      src={avatarSrc}
                      alt={doctor.name}
                      fill
                      className="object-cover object-top"
                      sizes="48px"
                      unoptimized
                    />
                  </span>
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-muted to-brand-light/20 text-sm font-semibold text-brand-dark shadow-sm">
                    {doctor.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 group-hover:text-brand-dark">
                        {doctor.name}
                      </p>
                      <p className="text-sm text-slate-600">{doctor.specialties[0]}</p>
                    </div>
                    {(doctor.ratingCount ?? 0) > 0 ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                        {doctor.ratingAvg?.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    {doctor.pmdcVerified ? (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                        {verifiedLabel}
                      </span>
                    ) : null}
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
                      {feeLabel}: Rs. {doctor.consultationFee.toLocaleString()}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
                      {slotsLabel}: {doctor.availableSlots}
                    </span>
                  </div>
                  <p className="mt-2 inline-flex items-center gap-0.5 text-xs font-semibold text-brand-dark">
                    {viewProfileLabel}
                    <ChevronRight
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
