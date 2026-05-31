"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { surfaceCard } from "@/lib/ui/surfaces";

type Stats = {
  pendingDoctorVerifications: number;
  activeDoctors: number;
  totalPatients: number;
  appointmentsToday: number;
  pendingHomeVisits: number;
  sundayBookingsThisWeek: number;
  systemHealth: {
    database: "ok" | "error";
    sundayConsultEnabled: boolean;
    maintenanceMode: boolean;
  };
};

export function AdminDashboardOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/admin/dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setStats(json.data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading dashboard…</p>;
  }

  if (!stats) {
    return <p className="text-sm text-red-600">Failed to load dashboard stats.</p>;
  }

  const cards = [
    {
      label: "Pending verifications",
      value: stats.pendingDoctorVerifications,
      href: "/admin/doctors",
    },
    { label: "Active doctors", value: stats.activeDoctors, href: "/admin/doctors/manage" },
    { label: "Patients", value: stats.totalPatients, href: "/admin/patients" },
    {
      label: "Appointments today",
      value: stats.appointmentsToday,
      href: "/admin/appointments",
    },
    {
      label: "Home care pending",
      value: stats.pendingHomeVisits,
      href: "/admin/home-visits",
    },
    {
      label: "Sunday bookings",
      value: stats.sundayBookingsThisWeek,
      href: "/admin/sunday-consult",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className={`${surfaceCard} h-full transition hover:shadow-md`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-slate-900">{c.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className={surfaceCard}>
        <CardHeader>
          <CardTitle className="text-base">System health</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <span
            className={
              stats.systemHealth.database === "ok"
                ? "text-emerald-700"
                : "text-red-600"
            }
          >
            Database: {stats.systemHealth.database}
          </span>
          <span>
            Sunday consult:{" "}
            {stats.systemHealth.sundayConsultEnabled ? "enabled" : "disabled"}
          </span>
          <span>
            Maintenance: {stats.systemHealth.maintenanceMode ? "active" : "off"}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
