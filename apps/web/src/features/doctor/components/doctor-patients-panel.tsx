"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  MessageSquare,
  Phone,
  Search,
  Stethoscope,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { siteConfig } from "@/config/site";
import { formatDateTime } from "@/features/doctor/components/doctor-workspace-panels";
import type { DoctorPatientRow } from "@/server/services/doctor-dashboard.service";
import { cn } from "@zindagi/shared";

type SortKey = "recent" | "name" | "appointments";

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

function isThisMonth(iso?: string) {
  if (!iso) return false;
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  );
}

function isRecentVisit(iso?: string) {
  if (!iso) return false;
  const date = new Date(iso);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return date >= thirtyDaysAgo;
}

export function DoctorPatientsPanel({ patients }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const stats = useMemo(() => {
    const totalAppointments = patients.reduce(
      (sum, patient) => sum + patient.appointmentCount,
      0,
    );
    const activeThisMonth = patients.filter((patient) =>
      isThisMonth(patient.lastVisitAt),
    ).length;
    const recentVisits = patients.filter((patient) =>
      isRecentVisit(patient.lastVisitAt),
    ).length;

    return {
      totalPatients: patients.length,
      totalAppointments,
      activeThisMonth,
      recentVisits,
    };
  }, [patients]);

  const filteredPatients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const matches = normalizedQuery
      ? patients.filter((patient) => {
          const haystack = [patient.name, patient.phone ?? ""]
            .join(" ")
            .toLowerCase();
          return haystack.includes(normalizedQuery);
        })
      : [...patients];

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
  }, [patients, query, sort]);

  if (patients.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
            <Users className="size-7" aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No patients yet</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
            Patients appear here after you complete paid online or clinic consultations
            on ZindagiCare.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                This month
              </p>
              <p className="mt-0.5 text-2xl font-semibold text-slate-900">
                {stats.activeThisMonth}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Last 30 days
              </p>
              <p className="mt-0.5 text-2xl font-semibold text-slate-900">
                {stats.recentVisits}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Patient directory</h2>
              <p className="mt-1 text-xs text-slate-500">
                Search by name or phone, then message patients directly from your workspace.
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
                  placeholder="Search patients..."
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
        </div>

        {filteredPatients.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No patients match your search. Try a different name or phone number.
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {filteredPatients.map((patient) => (
              <article
                key={patient.id}
                className="group flex flex-col rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/60 p-4 transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <PatientAvatar name={patient.name} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-slate-900">{patient.name}</h3>
                    {patient.phone ? (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                        <Phone className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                        <span className="truncate">{patient.phone}</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800">
                    <Stethoscope className="size-3" aria-hidden />
                    {patient.appointmentCount} visit
                    {patient.appointmentCount === 1 ? "" : "s"}
                  </span>
                  {patient.lastVisitAt ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      <CalendarDays className="size-3" aria-hidden />
                      {formatDateTime(patient.lastVisitAt)}
                    </span>
                  ) : null}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
