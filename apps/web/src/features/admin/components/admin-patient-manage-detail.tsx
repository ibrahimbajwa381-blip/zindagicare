"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminPatientDetail } from "@/server/services/admin-patient.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatKarachiDateTime } from "@/lib/format/datetime";
import { cn, withDoctorTitle } from "@zindagi/shared";
import {
  Activity,
  Ban,
  CalendarDays,
  HeartPulse,
  Home,
  Mail,
  Phone,
  ShieldCheck,
  ShieldOff,
  UserX,
} from "lucide-react";

type Props = {
  initialPatient: AdminPatientDetail;
};

function formatCurrency(amount: number) {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

function AccountStatusBadge({
  isActive,
  isBanned,
  sundayBanned,
}: {
  isActive: boolean;
  isBanned: boolean;
  sundayBanned: boolean;
}) {
  if (!isActive) {
    return <Badge variant="outline">Inactive</Badge>;
  }
  if (isBanned) {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Banned</Badge>;
  }
  if (sundayBanned) {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        Sunday restricted
      </Badge>
    );
  }
  return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>;
}

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  clinic: "Clinic",
  online: "Online consult",
  sunday_free: "Sunday free",
  home_visit: "Home visit",
};

const HOME_SERVICE_LABELS: Record<string, string> = {
  doctor_visit: "Doctor visit",
  nurse: "Nursing care",
  iv_drip: "IV drip",
  injection: "Injection",
  wound_care: "Wound care",
  sample_collection: "Sample collection",
  emergency: "Emergency",
};

export function AdminPatientManageDetail({ initialPatient }: Props) {
  const router = useRouter();
  const [patient, setPatient] = useState(initialPatient);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const updatePatient = async (patch: Record<string, unknown>) => {
    setPending(true);
    setError(undefined);
    const res = await fetch(`/api/v1/admin/patients/${patient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "Update failed");
      return;
    }
    setPatient(json.data?.patient ?? patient);
    router.refresh();
  };

  const banWithConfirm = () => {
    const daysStr = window.prompt("Ban for how many days?", "7");
    if (!daysStr) return;
    const days = Number.parseInt(daysStr, 10);
    if (!Number.isFinite(days) || days < 1) return;
    void updatePatient({ banDays: days });
  };

  const { stats, profile } = patient;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">{patient.name}</CardTitle>
              <AccountStatusBadge
                isActive={patient.isActive}
                isBanned={patient.isBanned}
                sundayBanned={patient.sundayBanned}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
              {patient.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-slate-400" />
                  {patient.email}
                  {patient.emailVerified && (
                    <Badge variant="outline" className="text-[10px]">
                      Verified
                    </Badge>
                  )}
                </span>
              )}
              {patient.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-slate-400" />
                  {patient.phone}
                  {patient.phoneVerified && (
                    <Badge variant="outline" className="text-[10px]">
                      Verified
                    </Badge>
                  )}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoBlock label="City" value={patient.city ?? profile?.defaultCity ?? "—"} />
            <InfoBlock
              label="Member since"
              value={new Date(patient.memberSince).toLocaleDateString("en-PK", {
                dateStyle: "medium",
              })}
            />
            <InfoBlock label="Language" value={patient.locale === "ur" ? "Urdu" : "English"} />
            <InfoBlock label="Date of birth" value={profile?.dateOfBirth ?? "—"} />
            <InfoBlock label="Gender" value={profile?.gender ?? "—"} />
            <InfoBlock label="Blood group" value={profile?.bloodGroup ?? "—"} />
            <InfoBlock
              label="Allergies"
              value={profile?.allergies?.length ? profile.allergies.join(", ") : "None recorded"}
            />
            <InfoBlock
              label="Chronic conditions"
              value={
                profile?.chronicConditions?.length
                  ? profile.chronicConditions.join(", ")
                  : "None recorded"
              }
            />
            <InfoBlock
              label="Emergency contact"
              value={
                profile?.emergencyContact?.name
                  ? `${profile.emergencyContact.name}${profile.emergencyContact.phone ? ` · ${profile.emergencyContact.phone}` : ""}${profile.emergencyContact.relation ? ` (${profile.emergencyContact.relation})` : ""}`
                  : "—"
              }
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Account controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              className="w-full justify-start"
              variant="outline"
              disabled={pending}
              onClick={() => updatePatient({ isActive: !patient.isActive })}
            >
              <UserX className="h-4 w-4" />
              {patient.isActive ? "Deactivate account" : "Activate account"}
            </Button>
            {patient.isBanned ? (
              <Button
                className="w-full justify-start"
                variant="outline"
                disabled={pending}
                onClick={() => updatePatient({ unban: true })}
              >
                <ShieldCheck className="h-4 w-4" />
                Remove platform ban
              </Button>
            ) : (
              <Button
                className="w-full justify-start"
                variant="outline"
                disabled={pending}
                onClick={banWithConfirm}
              >
                <Ban className="h-4 w-4" />
                Ban from platform
              </Button>
            )}
            {patient.sundayBanned && (
              <Button
                className="w-full justify-start"
                variant="outline"
                disabled={pending}
                onClick={() => updatePatient({ clearSundayBan: true })}
              >
                <ShieldOff className="h-4 w-4" />
                Clear Sunday ban
              </Button>
            )}
            {patient.noShowCount > 0 && (
              <Button
                className="w-full justify-start"
                variant="outline"
                disabled={pending}
                onClick={() => updatePatient({ resetNoShowCount: true })}
              >
                Reset no-show count ({patient.noShowCount})
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarDays} label="Total appointments" value={stats.totalAppointments} />
        <StatCard icon={Activity} label="Upcoming" value={stats.upcomingAppointments} />
        <StatCard icon={Home} label="Home visits" value={stats.homeVisitsTotal} />
        <StatCard
          icon={HeartPulse}
          label="Total spend"
          value={formatCurrency(stats.totalSpend)}
          sub={`${formatCurrency(stats.spendThisMonth)} this month`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Recent appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {patient.recentAppointments.length === 0 ? (
              <p className="text-sm text-slate-500">No appointments yet.</p>
            ) : (
              <ul className="space-y-2">
                {patient.recentAppointments.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {APPOINTMENT_TYPE_LABELS[a.type] ?? a.type.replace(/_/g, " ")}
                      </span>
                      <Badge variant="outline">{a.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="mt-1 text-slate-500">
                      {formatKarachiDateTime(a.scheduledStart)}
                      {a.doctorName ? ` · ${withDoctorTitle(a.doctorName)}` : ""}
                      {a.isOnline ? " · Video" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Home care visits</CardTitle>
          </CardHeader>
          <CardContent>
            {patient.recentHomeVisits.length === 0 ? (
              <p className="text-sm text-slate-500">No home visits yet.</p>
            ) : (
              <ul className="space-y-2">
                {patient.recentHomeVisits.map((visit) => (
                  <li
                    key={visit.id}
                    className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {HOME_SERVICE_LABELS[visit.serviceType] ?? visit.serviceType}
                      </span>
                      <Badge variant="outline">{visit.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="mt-1 text-slate-500">
                      {formatKarachiDateTime(visit.scheduledAt)} ·{" "}
                      {formatCurrency(visit.pricing.total)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {visit.address.line}, {visit.address.city}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
