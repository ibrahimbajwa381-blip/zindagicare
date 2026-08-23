"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  MessageSquare,
  Phone,
  Search,
  Star,
  Stethoscope,
  Video,
  XCircle,
} from "lucide-react";
import { AppointmentTypes, SUNDAY_CONSULT_CONFIG, cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { siteConfig } from "@/config/site";
import { ConsultJoinAction } from "@/features/doctor/components/consult-join-action";
import { formatDateTime } from "@/features/doctor/components/doctor-workspace-panels";
import type {
  DoctorRequestOutcome,
  DoctorRequestRow,
} from "@/server/services/doctor-dashboard.service";

type CategoryKey =
  | "active"
  | "upcoming"
  | "in_progress"
  | "completed"
  | "missed"
  | "cancelled"
  | "all";

type Props = {
  requests: DoctorRequestRow[];
};

function formatType(type: string) {
  if (type === AppointmentTypes.ONLINE) return "Online consult";
  if (type === AppointmentTypes.URGENT_ONLINE) return "Urgent care";
  if (type === AppointmentTypes.CLINIC) return "Clinic visit";
  if (type === AppointmentTypes.SUNDAY_FREE) return "Sunday free";
  return type.replaceAll("_", " ");
}

function outcomeMeta(outcome: DoctorRequestOutcome) {
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

function matchesCategory(request: DoctorRequestRow, category: CategoryKey) {
  switch (category) {
    case "active":
      return (
        request.outcome === "upcoming" ||
        request.outcome === "in_progress" ||
        request.outcome === "pending"
      );
    case "upcoming":
      return request.outcome === "upcoming" || request.outcome === "pending";
    case "in_progress":
      return request.outcome === "in_progress";
    case "completed":
      return request.outcome === "completed";
    case "missed":
      return request.outcome === "missed";
    case "cancelled":
      return request.outcome === "cancelled";
    default:
      return true;
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

function joinWindowEnd(request: DoctorRequestRow) {
  if (request.type !== AppointmentTypes.SUNDAY_FREE) return request.scheduledEnd;
  const matchEnd =
    new Date(request.scheduledStart).getTime() +
    SUNDAY_CONSULT_CONFIG.matchWithinMinutes * 60_000;
  return new Date(
    Math.max(new Date(request.scheduledEnd).getTime(), matchEnd),
  ).toISOString();
}

function patientInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function DoctorConsultRequestsPanel({ requests }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryKey>("all");

  const counts = useMemo(() => {
    const next = {
      active: 0,
      upcoming: 0,
      in_progress: 0,
      completed: 0,
      missed: 0,
      cancelled: 0,
      all: requests.length,
    };

    for (const request of requests) {
      if (
        request.outcome === "upcoming" ||
        request.outcome === "in_progress" ||
        request.outcome === "pending"
      ) {
        next.active += 1;
      }
      if (request.outcome === "upcoming" || request.outcome === "pending") {
        next.upcoming += 1;
      }
      if (request.outcome === "in_progress") next.in_progress += 1;
      if (request.outcome === "completed") next.completed += 1;
      if (request.outcome === "missed") next.missed += 1;
      if (request.outcome === "cancelled") next.cancelled += 1;
    }

    return next;
  }, [requests]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const matches = requests.filter((request) => {
      if (!matchesCategory(request, category)) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        request.patient.name,
        request.patient.phone ?? "",
        request.patientNotes ?? "",
        request.review?.comment ?? "",
        formatType(request.type),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    return matches.sort((a, b) => {
      const aActive =
        a.outcome === "upcoming" ||
        a.outcome === "in_progress" ||
        a.outcome === "pending";
      const bActive =
        b.outcome === "upcoming" ||
        b.outcome === "in_progress" ||
        b.outcome === "pending";

      if (category === "active" || (aActive && bActive)) {
        return (
          new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()
        );
      }

      return (
        new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime()
      );
    });
  }, [requests, category, query]);

  if (requests.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <CalendarDays className="size-7" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            No consult history yet
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
            Online, urgent, Sunday free, and clinic appointments assigned to you will appear
            here by status — active, completed, missed, and cancelled.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Stethoscope className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                Active now
              </p>
              <p className="mt-0.5 text-2xl font-semibold text-slate-900">{counts.active}</p>
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
                {counts.completed}
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
              <p className="mt-0.5 text-2xl font-semibold text-slate-900">{counts.missed}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Cancelled
              </p>
              <p className="mt-0.5 text-2xl font-semibold text-slate-900">
                {counts.cancelled}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-sky-200/80 bg-sky-50/40 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <Video className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-sky-700">
                Total history
              </p>
              <p className="mt-0.5 text-2xl font-semibold text-slate-900">{counts.all}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Appointment request history
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Filter by status, search patients, and open join, messaging, or Rx actions.
                </p>
              </div>

              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search patient, notes, type..."
                  className="h-10 pl-9 sm:pl-9"
                  aria-label="Search consult requests"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["active", "Active", counts.active],
                  ["upcoming", "Upcoming", counts.upcoming],
                  ["in_progress", "In progress", counts.in_progress],
                  ["completed", "Completed", counts.completed],
                  ["missed", "Missed", counts.missed],
                  ["cancelled", "Cancelled", counts.cancelled],
                  ["all", "All history", counts.all],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                    category === key
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      category === key ? "bg-white/20 text-white" : "bg-white text-slate-500",
                    )}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No appointments in this category. Try another filter or search term.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((request) => {
              const outcome = outcomeMeta(request.outcome);
              const initials = patientInitials(request.patient.name) || "?";

              return (
                <li key={request.id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-sky-100 text-sm font-semibold text-violet-800"
                        aria-hidden
                      >
                        {initials}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-semibold text-slate-900">
                            {request.patient.name}
                          </h3>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                              outcome.className,
                            )}
                          >
                            {outcome.label}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {formatType(request.type)}
                          </span>
                        </div>

                        {request.patient.phone ? (
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                            <Phone className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                            {request.patient.phone}
                          </p>
                        ) : null}

                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3" aria-hidden />
                            {formatDateTime(request.scheduledStart)}
                            {" – "}
                            {new Intl.DateTimeFormat("en-PK", {
                              timeStyle: "short",
                              timeZone: "Asia/Karachi",
                            }).format(new Date(request.scheduledEnd))}
                          </span>
                          {typeof request.consultationFee === "number" ? (
                            <span>
                              Fee Rs. {request.consultationFee.toLocaleString("en-PK")}
                            </span>
                          ) : null}
                          {request.hasPrescription ? (
                            <span className="font-medium text-emerald-700">Rx issued</span>
                          ) : null}
                        </div>

                        {request.patientNotes ? (
                          <p className="mt-2 line-clamp-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                            <span className="font-medium text-slate-700">Notes: </span>
                            {request.patientNotes}
                          </p>
                        ) : null}

                        {request.review ? (
                          <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800/80">
                                Patient review
                              </p>
                              <StarRating rating={request.review.rating} />
                            </div>
                            {request.review.comment ? (
                              <p className="mt-1 line-clamp-2 text-sm text-slate-700">
                                “{request.review.comment}”
                              </p>
                            ) : (
                              <p className="mt-1 text-sm text-slate-500">
                                Rated without a written comment.
                              </p>
                            )}
                          </div>
                        ) : request.outcome === "completed" ? (
                          <p className="mt-2 text-xs text-slate-500">
                            Completed — awaiting patient review.
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-md lg:justify-end">
                      <ConsultJoinAction
                        appointmentId={request.id}
                        type={request.type}
                        outcome={request.outcome}
                        scheduledStart={request.scheduledStart}
                        scheduledEnd={joinWindowEnd(request)}
                      />
                      <Button size="sm" variant="outline" asChild className="gap-1">
                        <Link href={`/doctor/intake/${request.id}`}>
                          <ClipboardList className="h-3.5 w-3.5" />
                          Patient history
                        </Link>
                      </Button>
                      {request.patient.id ? (
                        <Button size="sm" variant="outline" asChild className="gap-1">
                          <Link
                            href={`${siteConfig.links.doctorMessages}?patient=${request.patient.id}`}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Message
                          </Link>
                        </Button>
                      ) : null}
                      {request.outcome === "completed" ||
                      request.outcome === "in_progress" ||
                      request.outcome === "upcoming" ||
                      request.outcome === "pending" ? (
                        <Button size="sm" variant="outline" asChild className="gap-1">
                          <Link href={`/doctor/prescriptions/new?appointmentId=${request.id}`}>
                            <FileText className="h-3.5 w-3.5" />
                            {request.hasPrescription ? "View / add Rx" : "Issue Rx"}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
