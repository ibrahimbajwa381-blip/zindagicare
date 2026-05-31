import Link from "next/link";
import {
  CalendarClock,
  ChevronRight,
  Home,
  Stethoscope,
  Sun,
  Users,
} from "lucide-react";
import { VerificationStatuses } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import type { DoctorProfileDto } from "@/features/doctor/types";
import type { DoctorDashboardSummary } from "@/server/services/doctor-dashboard.service";

type Props = {
  profile: DoctorProfileDto;
  summary: DoctorDashboardSummary;
};

const actions = [
  {
    href: "/doctor/patients",
    label: "My patients",
    description: "View patients you have consulted",
    icon: Users,
    countKey: "patients" as const,
    accent: "from-sky-500/20 to-sky-600/5",
  },
  {
    href: "/doctor/requests",
    label: "Consult requests",
    description: "Online & clinic appointments awaiting you",
    icon: CalendarClock,
    countKey: "pendingRequests" as const,
    accent: "from-violet-500/20 to-violet-600/5",
  },
  {
    href: "/doctor/sunday-consult",
    label: "Sunday free consult",
    description: "Patients booked for this Sunday",
    icon: Sun,
    countKey: "sundayQueue" as const,
    accent: "from-amber-500/25 to-orange-500/5",
  },
  {
    href: "/doctor/home-visits",
    label: "In-house visits",
    description: "Doctor home visit requests in your city",
    icon: Home,
    countKey: "homeVisitRequests" as const,
    accent: "from-emerald-500/20 to-teal-600/5",
  },
];

function profileInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function DoctorDashboardHero({ profile, summary }: Props) {
  const isApproved = profile.verificationStatus === VerificationStatuses.APPROVED;
  const isPending = profile.verificationStatus === VerificationStatuses.PENDING;
  const specialty = profile.specialties[0] ?? "Doctor";

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-light/30 shadow-premium">
      <div className="relative bg-gradient-to-br from-brand via-brand-dark to-accent px-5 pb-6 pt-6 text-white sm:px-8 sm:pb-8 sm:pt-8">
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 left-1/4 size-56 rounded-full bg-accent-light/20 blur-3xl"
          aria-hidden
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold ring-4 ring-white/20 backdrop-blur-sm sm:size-20 sm:text-2xl">
              {profileInitials(profile.user.name) || (
                <Stethoscope className="size-8" aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                Doctor workspace
              </p>
              <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                Dr. {profile.user.name}
              </h1>
              <p className="mt-1 text-sm text-white/85">{specialty}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {isApproved ? (
                  <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/15">
                    Profile live
                  </Badge>
                ) : isPending ? (
                  <Badge
                    variant="secondary"
                    className="border-white/20 bg-white/10 text-white"
                  >
                    Pending admin approval
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="border-white/20 bg-white/10 text-white"
                  >
                    Complete onboarding
                  </Badge>
                )}
                {profile.pmdcVerified && (
                  <Badge className="border-emerald-300/30 bg-emerald-500/20 text-white hover:bg-emerald-500/20">
                    PMDC verified
                  </Badge>
                )}
              </div>
              <p className="mt-3 max-w-xl text-sm text-white/80">
                {isApproved
                  ? "Manage your patients, consult requests, Sunday free slots, and in-house visit requests from one place."
                  : "Your workspace will unlock patient management once an admin approves your profile."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 bg-white/90 p-4 sm:grid-cols-2 sm:gap-4 sm:p-5 lg:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          const count = summary[action.countKey];
          const disabled = !isApproved;

          const cardContent = (
            <>
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${action.accent} text-brand-dark`}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {count > 0 && (
                  <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
                    {count}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <p className="font-semibold text-slate-900">{action.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {action.description}
                </p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand">
                Open
                <ChevronRight className="size-3.5" aria-hidden />
              </span>
            </>
          );

          if (disabled) {
            return (
              <div
                key={action.href}
                className="flex flex-col rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 opacity-70"
              >
                {cardContent}
              </div>
            );
          }

          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex flex-col rounded-xl border border-slate-200/80 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-brand-light/60 hover:shadow-md"
            >
              {cardContent}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
