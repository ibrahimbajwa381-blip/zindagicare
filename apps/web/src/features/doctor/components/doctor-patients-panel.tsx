"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Phone,
  Search,
  Star,
  Stethoscope,
  Users,
  XCircle,
} from "lucide-react";
import { AppointmentTypes, cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { siteConfig } from "@/config/site";
import { formatDateTime } from "@/features/doctor/components/doctor-workspace-panels";
import type {
  DoctorPatientLastOutcome,
  DoctorPatientRow,
} from "@/server/services/doctor-dashboard.service";

type SortKey = "recent" | "name" | "appointments";
type FilterKey =
  | "all"
  | "completed"
  | "missed"
  | "upcoming"
  | "reviewed"
  | "unreviewed";

type Props = {
  patients: DoctorPatientRow[];
};

function patientInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function PatientAvatar({ name }: { name: string }) {
  const initials = patientInitials(name) || "?";

  return (
    <span
      className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-sky-200/80 text-sm font-semibold text-sky-800 ring-2 ring-white shadow-sm sm:size-14 sm:text-base"
      aria-hidden
    >
      {initials}
    </span>
  );
}

function visitTypeLabel(type?: string) {
  switch (type) {
    case AppointmentTypes.ONLINE:
      return "Online consult";
    case AppointmentTypes.URGENT_ONLINE:
      return "Urgent care";
    case AppointmentTypes.CLINIC:
      return "Clinic visit";
    case AppointmentTypes.SUNDAY_FREE:
      return "Sunday free";
    case AppointmentTypes.HOME_VISIT:
      return "Home visit";
    default:
      return "Consultation";
  }
}

function outcomeMeta(outcome: DoctorPatientLastOutcome) {
  switch (outcome) {
    case "completed":
      return {
        label: "Completed",
        className: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
      };
    case "missed":
      return {
        label: "Missed",
        className: "bg-rose-50 text-rose-800 ring-rose-200/80",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-slate-100 text-slate-700 ring-slate-200",
      };
    case "in_progress":
      return {
        label: "In progress",
        className: "bg-sky-50 text-sky-800 ring-sky-200/80",
      };
    case "pending":
      return {
        label: "Pending",
        className: "bg-amber-50 text-amber-800 ring-amber-200/80",
      };
    default:
      return {
        label: "Upcoming",
        className: "bg-violet-50 text-violet-800 ring-violet-200/80",
      };
  }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < rating;
        return (
          <Star
            key={index}
            className={cn(
              "size-3.5",
              filled ? "fill-amber-400 text-amber-400" : "text-slate-300",
            )}
            aria-hidden
          />
        );
      })}
    </span>
  );
}

export function DoctorPatientsPanel({ patients }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [filter, setFilter] = useState<FilterKey>("all");

  const stats = useMemo(() => {
    const totalAppointments = patients.reduce(
      (sum, patient) => sum + patient.appointmentCount,
      0,
    );
    const completed = patients.reduce(
      (sum, patient) => sum + patient.completedCount,
      0,
    );
    const missed = patients.reduce((sum, patient) => sum + patient.missedCount, 0);
    const reviewed = patients.filter((patient) => patient.review).length;

    return {
      totalPatients: patients.length,
      totalAppointments,
      completed,
      missed,
      reviewed,
    };
  }, [patients]);

  const filteredPatients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    let matches = normalizedQuery
      ? patients.filter((patient) => {
          const haystack = [
            patient.name,
            patient.phone ?? "",
            patient.review?.comment ?? "",
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalizedQuery);
        })
      : [...patients];

    matches = matches.filter((patient) => {
      switch (filter) {
        case "completed":
          return patient.completedCount > 0 || patient.lastOutcome === "completed";
        case "missed":
          return patient.missedCount > 0 || patient.lastOutcome === "missed";
        case "upcoming":
          return patient.upcomingCount > 0 || patient.lastOutcome === "upcoming";
        case "reviewed":
          return !!patient.review;
        case "unreviewed":
          return patient.completedCount > 0 && !patient.review;
        default:
          return true;
      }
    });

    matches.sort((a, b) => {
      if (sort === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sort === "appointments") {
        return b.appointmentCount - a.appointmentCount;
      }
      const aTime = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : 0;
      const bTime = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : 0;
      return bTime - aTime;
    });

    return matches;
  }, [patients, query, sort, filter]);

  if (patients.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
            <Users className="size-7" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No patients yet</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
            Patients appear here after paid online or clinic consultations on ZindagiCare.
            You’ll see visit outcomes, reviews, and messaging in one place.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 to-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <Users className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-sky-700">
                Total patients
              </p>
              <p className="mt-0.5 text-2xl font-semibold text-slate-900">
                {stats.totalPatients}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                Completed
              </p>
              <p className="mt-0.5 text-2xl font-semibold text-slate-900">
                {stats.completed}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/40 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <XCircle className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-rose-700">
                Missed
              </p>
              <p className="mt-0.5 text-2xl font-semibold text-slate-900">{stats.missed}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Star className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                Reviews
              </p>
              <p className="mt-0.5 text-2xl font-semibold text-slate-900">
                {stats.reviewed}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <Stethoscope className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Consultations
              </p>
              <p className="mt-0.5 text-2xl font-semibold text-slate-900">
                {stats.totalAppointments}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Patient directory</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Outcomes, reviews, prescriptions, and messaging for each patient.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search patients or reviews..."
                    className="h-10 pl-9"
                    aria-label="Search patients"
                  />
                </div>

                <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {(
                    [
                      ["recent", "Recent"],
                      ["name", "Name"],
                      ["appointments", "Visits"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSort(key)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                        sort === key
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["completed", "Completed"],
                  ["missed", "Missed"],
                  ["upcoming", "Upcoming"],
                  ["reviewed", "Reviewed"],
                  ["unreviewed", "Awaiting review"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    filter === key
                      ? "bg-sky-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredPatients.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No patients match this filter. Try another status or search term.
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {filteredPatients.map((patient) => {
              const outcome = outcomeMeta(patient.lastOutcome);
              return (
                <article
                  key={patient.id}
                  className="group flex flex-col rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/60 p-4 transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <PatientAvatar name={patient.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate font-semibold text-slate-900">
                          {patient.name}
                        </h3>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                            outcome.className,
                          )}
                        >
                          {outcome.label}
                        </span>
                      </div>
                      {patient.phone ? (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                          <Phone className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                          <span className="truncate">{patient.phone}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800">
                        <Stethoscope className="size-3" aria-hidden />
                        {patient.appointmentCount} visit
                        {patient.appointmentCount === 1 ? "" : "s"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {visitTypeLabel(patient.lastVisitType)}
                      </span>
                      {patient.lastVisitAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          <CalendarDays className="size-3" aria-hidden />
                          {formatDateTime(patient.lastVisitAt)}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs leading-relaxed text-slate-500">
                      <span className="font-medium text-emerald-700">
                        {patient.completedCount} completed
                      </span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className="font-medium text-rose-700">
                        {patient.missedCount} missed
                      </span>
                      {patient.cancelledCount > 0 ? (
                        <>
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span className="font-medium text-slate-600">
                            {patient.cancelledCount} cancelled
                          </span>
                        </>
                      ) : null}
                      {patient.upcomingCount > 0 ? (
                        <>
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span className="font-medium text-violet-700">
                            {patient.upcomingCount} upcoming
                          </span>
                        </>
                      ) : null}
                    </p>

                    {patient.prescriptionCount > 0 ? (
                      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <ClipboardList className="size-3.5 text-slate-400" aria-hidden />
                        {patient.prescriptionCount} prescription
                        {patient.prescriptionCount === 1 ? "" : "s"} issued
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 flex-1 rounded-xl border border-slate-100 bg-white/80 p-3">
                    {patient.review ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Latest review
                          </p>
                          <StarRating rating={patient.review.rating} />
                        </div>
                        {patient.review.comment ? (
                          <p className="line-clamp-3 text-sm leading-relaxed text-slate-700">
                            “{patient.review.comment}”
                          </p>
                        ) : (
                          <p className="text-sm text-slate-500">Rated without a written comment.</p>
                        )}
                        <p className="text-[11px] text-slate-400">
                          {formatDateTime(patient.review.createdAt)}
                        </p>
                      </div>
                    ) : patient.completedCount > 0 ? (
                      <p className="text-sm text-slate-500">
                        Completed consults, but this patient hasn’t left a review yet.
                      </p>
                    ) : patient.lastOutcome === "missed" ? (
                      <p className="text-sm text-rose-700/90">
                        Latest consult was missed — no review expected until a completed visit.
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500">
                        No review yet. Reviews appear after a completed paid consultation.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <Button asChild size="sm" className="w-full gap-1.5">
                      <Link href={`${siteConfig.links.doctorMessages}?patient=${patient.id}`}>
                        <MessageSquare className="size-3.5" aria-hidden />
                        Message patient
                      </Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
