"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Banknote, Percent, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { AdminDoctorAvatar } from "@/features/admin/components/admin-doctor-avatar";
import { surfaceCard } from "@/lib/ui/surfaces";
import type { AdminFinancesOverview } from "@/server/services/admin-finances.service";

function formatCurrency(amount: number) {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

export function AdminFinancesPanel() {
  const [data, setData] = useState<AdminFinancesOverview | null>(null);
  const [onlinePercent, setOnlinePercent] = useState(70);
  const [homeVisitPercent, setHomeVisitPercent] = useState(70);
  const [nursePercent, setNursePercent] = useState(70);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    const res = await fetch("/api/v1/admin/finances");
    const json = await res.json();
    if (json.success) {
      const overview = json.data as AdminFinancesOverview;
      setData(overview);
      setOnlinePercent(overview.platform.defaultDoctorOnlineCommissionPercent);
      setHomeVisitPercent(overview.platform.defaultDoctorHomeVisitCommissionPercent);
      setNursePercent(overview.platform.defaultNurseCommissionPercent);
    } else {
      setError(json?.error?.message ?? "Could not load finances settings");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savePlatform = async () => {
    setPending(true);
    setError(undefined);
    setSaved(false);
    const res = await fetch("/api/v1/admin/finances", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultDoctorOnlineCommissionPercent: onlinePercent,
        defaultDoctorHomeVisitCommissionPercent: homeVisitPercent,
        defaultNurseCommissionPercent: nursePercent,
      }),
    });
    const json = await res.json();
    setPending(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "Failed to save commission settings");
      return;
    }
    setSaved(true);
    await load();
  };

  if (loading || !data) {
    return <LoadingScreen message="Loading finances…" />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Platform commission settings saved.
        </div>
      )}

      <Card className={surfaceCard}>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Percent className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Platform commission defaults</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              These rates apply to all doctors and nurses unless an individual override is set
              on their profile.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <CommissionField
              label="Online & clinic consults"
              hint="Video, clinic, and urgent paid consultations"
              value={onlinePercent}
              onChange={setOnlinePercent}
              disabled={pending}
            />
            <CommissionField
              label="In-house doctor visits"
              hint="Doctor home visit services"
              value={homeVisitPercent}
              onChange={setHomeVisitPercent}
              disabled={pending}
            />
            <CommissionField
              label="Nurse home care"
              hint="Nurse visits, IV drip, injection, wound care"
              value={nursePercent}
              onChange={setNursePercent}
              disabled={pending}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={savePlatform} disabled={pending}>
              {pending ? "Saving…" : "Save platform defaults"}
            </Button>
            {data.platform.updatedAt && (
              <p className="text-xs text-slate-400">
                Last updated{" "}
                {new Date(data.platform.updatedAt).toLocaleString("en-PK", {
                  timeZone: "Asia/Karachi",
                })}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className={surfaceCard}>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Doctor commission overrides</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Approved doctors with earnings and commission rates. Leave blank on a doctor
              profile to use platform defaults above.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {data.doctors.length === 0 ? (
            <p className="text-sm text-slate-500">No approved doctors yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-medium">Doctor</th>
                    <th className="px-3 py-2 font-medium">Total earned</th>
                    <th className="px-3 py-2 font-medium">This month</th>
                    <th className="px-3 py-2 font-medium">Online %</th>
                    <th className="px-3 py-2 font-medium">In-house %</th>
                    <th className="px-3 py-2 font-medium">Effective</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {data.doctors.map((doctor) => (
                    <tr key={doctor.id} className="border-b border-slate-100">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <AdminDoctorAvatar
                            name={doctor.name}
                            avatarUrl={doctor.avatarUrl}
                            size="sm"
                          />
                          <span className="font-medium text-slate-900">{doctor.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        {formatCurrency(doctor.totalEarnings)}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {formatCurrency(doctor.earningsThisMonth)}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {formatOverride(doctor.onlineCommissionPercent)}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {formatOverride(doctor.homeVisitCommissionPercent)}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {doctor.effectiveOnlineCommissionPercent}% online ·{" "}
                        {doctor.effectiveHomeVisitCommissionPercent}% in-house
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/admin/finances/${doctor.id}`}
                          className="text-sm font-medium text-brand hover:underline"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={`${surfaceCard} border-dashed`}>
        <CardContent className="flex items-start gap-3 py-5">
          <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <p className="text-sm text-slate-600">
            Doctor earnings on the platform are calculated as a percentage of the patient payment.
            For example, a 70% online rate on a PKR 2,500 consult credits PKR 1,750 to the doctor.
            In-house and online rates can differ per doctor or platform-wide.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CommissionField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <label className="block text-sm font-medium text-slate-900">{label}</label>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      <div className="mt-3 flex items-center gap-2">
        <Input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24"
          disabled={disabled}
        />
        <span className="text-sm text-slate-500">% to doctor</span>
      </div>
    </div>
  );
}

function formatOverride(value: number | null) {
  if (value == null) return "Platform default";
  return `${value}%`;
}
