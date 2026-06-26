import Link from "next/link";
import { ChevronRight, Pencil } from "lucide-react";
import { VerificationStatuses } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DoctorAvatar } from "@/features/doctor/components/doctor-avatar";
import { DoctorEarningsSummaryCard } from "@/features/doctor/components/doctor-earnings-panel";
import { DOCTOR_OVERVIEW_ACTIONS } from "@/features/doctor/data/doctor-workspace-nav";
import { formatDayOfWeek, type DoctorProfileDto } from "@/features/doctor/types";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { formatQualificationsList } from "@/lib/doctors/qualifications";
import type { DoctorDashboardSummary } from "@/server/services/doctor-dashboard.service";

type Props = {
  profile: DoctorProfileDto;
  summary: DoctorDashboardSummary;
};

const accentByHref: Record<string, string> = {
  "/doctor/messages": "text-brand bg-brand/10 border-brand/20",
  "/doctor/patients": "text-sky-600 bg-sky-50 border-sky-100",
  "/doctor/requests": "text-violet-600 bg-violet-50 border-violet-100",
  "/doctor/urgent-calls": "text-rose-600 bg-rose-50 border-rose-100",
  "/doctor/sunday-consult": "text-amber-600 bg-amber-50 border-amber-100",
  "/doctor/home-visits": "text-emerald-600 bg-emerald-50 border-emerald-100",
};

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function DoctorProfileOverview({ profile, summary }: Props) {
  const isApproved = profile.verificationStatus === VerificationStatuses.APPROVED;
  const isPending = profile.verificationStatus === VerificationStatuses.PENDING;
  const specialty = profile.specialties.join(", ") || "General physician";
  const credentials = formatQualificationsList(
    profile.medicalDegree,
    profile.qualifications,
  );
  const avatarSrc = resolveDoctorPortrait(profile.user.name, profile.user.avatarUrl);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <DoctorAvatar name={profile.user.name} avatarUrl={avatarSrc} size="xl" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                Doctor profile
              </p>
              <h1 className="font-display mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
                Dr. {profile.user.name}
              </h1>
              <p className="mt-1 text-sm text-slate-600">{specialty}</p>
              <p className="mt-1 text-sm text-slate-500">
                PMDC {profile.pmdcNumber ?? "—"} · {profile.user.email ?? profile.user.phone}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {isApproved && <Badge>Profile live</Badge>}
                {isPending && <Badge variant="secondary">Pending admin approval</Badge>}
                {profile.pmdcVerified && (
                  <Badge variant="outline" className="border-emerald-200 text-emerald-800">
                    PMDC verified
                  </Badge>
                )}
                {credentials.map((credential) => (
                  <Badge key={credential} variant="outline">
                    {credential}
                  </Badge>
                ))}
                {profile.sundayConsult.enabled && (
                  <Badge variant="secondary">Sunday consult</Badge>
                )}
              </div>
              {isApproved && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/doctor/profile/edit">
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit profile
                    </Link>
                  </Button>
                </div>
              )}
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
                {isApproved
                  ? "Manage consultations, track earnings, and handle home visits from your workspace."
                  : "Your full workspace unlocks once an admin reviews and approves your application."}
              </p>
            </div>
          </div>

          {isApproved && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Patients", value: summary.patients },
                { label: "Requests", value: summary.pendingRequests },
                { label: "Sunday queue", value: summary.sundayQueue },
                { label: "Home visits", value: summary.homeVisitRequests },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <dt className="text-xs font-medium text-slate-500">{stat.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold text-slate-900">{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {isApproved && (
        <>
          <DoctorEarningsSummaryCard
            totalEarnings={summary.totalEarnings}
            earningsThisMonth={summary.earningsThisMonth}
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {DOCTOR_OVERVIEW_ACTIONS.map((action) => {
              const Icon = action.icon;
              const summaryKey =
                action.badgeKey === "homeVisits"
                  ? "homeVisitRequests"
                  : action.badgeKey === "messages"
                    ? null
                    : action.badgeKey;
              const count =
                summaryKey && summaryKey in summary
                  ? summary[summaryKey as keyof DoctorDashboardSummary]
                  : null;
              const accent = accentByHref[action.href] ?? "text-brand bg-brand/10 border-brand/20";
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${accent}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    {typeof count === "number" && count > 0 && (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
                        {count}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 font-semibold text-slate-900">{action.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{action.description}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand opacity-0 transition group-hover:opacity-100">
                    Open
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <div className="space-y-6">
          {profile.bio && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                About
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">{profile.bio}</p>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Professional details
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { label: "Specialization", value: profile.specialties.join(", ") || "—" },
                { label: "Primary degree", value: profile.medicalDegree ?? "—" },
                {
                  label: "Other qualifications",
                  value: profile.qualifications.length
                    ? profile.qualifications.join(", ")
                    : "—",
                },
                { label: "College", value: profile.medicalCollege ?? "—" },
                { label: "Experience", value: `${profile.experienceYears} years` },
                { label: "Consultation fee", value: `PKR ${profile.consultationFee}` },
                { label: "Languages", value: profile.languages.join(", ") },
              ].map((row) => (
                <div key={row.label} className="rounded-lg bg-slate-50 px-3 py-2">
                  <dt className="text-xs text-slate-500">{row.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {profile.hospitals.length > 0 && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Practice locations
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {profile.hospitals.map((h) => (
                  <li key={`${h.name}-${h.city}`} className="rounded-lg bg-slate-50 px-3 py-2">
                    <span className="font-medium text-slate-900">{h.name}</span>
                    <span className="text-slate-600"> · {h.city}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {profile.weeklyAvailability.length > 0 && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Weekly schedule
              </h2>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                {profile.weeklyAvailability.map((slot) => (
                  <li key={`${slot.dayOfWeek}-${slot.startTimeLocal}`}>
                    {formatDayOfWeek(slot.dayOfWeek)} ·{" "}
                    {formatTime12h(slot.startTimeLocal)} –{" "}
                    {formatTime12h(slot.endTimeLocal)}
                  </li>
                ))}
              </ul>
            </section>
          )}
      </div>
    </div>
  );
}
