"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DOCTOR_ACCOUNTABILITY_CONFIG, VerificationStatuses } from "@zindagi/shared";
import { AdminDoctorAvatar } from "@/features/admin/components/admin-doctor-avatar";
import { formatDayOfWeek } from "@/features/doctor/types";
import type { AdminDoctorRow } from "@/server/services/admin-doctor.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Ban,
  CalendarDays,
  CheckCircle2,
  Mail,
  Pencil,
  Phone,
  ShieldAlert,
  UserCheck,
  UserX,
} from "lucide-react";
import { cn } from "@zindagi/shared";

type Props = {
  initialDoctor: AdminDoctorRow;
};

function formatCurrency(amount: number) {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-800",
    restricted: "bg-orange-100 text-orange-800",
    rejected: "bg-red-100 text-red-800",
    pending: "bg-amber-100 text-amber-800",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        styles[status] ?? "bg-slate-100 text-slate-700",
      )}
    >
      {status}
    </span>
  );
}

export function AdminDoctorManageDetail({ initialDoctor }: Props) {
  const router = useRouter();
  const [doctor, setDoctor] = useState(initialDoctor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const updateDoctor = async (patch: Record<string, unknown>) => {
    setPending(true);
    setError(undefined);
    const res = await fetch(`/api/v1/admin/doctors/${doctor.id}/manage`, {
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
    setDoctor(json.data?.doctor ?? doctor);
    router.refresh();
  };

  const restrictWithConfirm = () => {
    if (
      !window.confirm(
        `Restrict ${doctor.name}? They will be unlisted and cannot accept new bookings until restored.`,
      )
    ) {
      return;
    }
    void updateDoctor({ verificationStatus: VerificationStatuses.RESTRICTED });
  };

  const rejectWithReason = () => {
    const reason = window.prompt("Rejection reason (shown to doctor):");
    if (!reason?.trim()) return;
    void updateDoctor({
      verificationStatus: VerificationStatuses.REJECTED,
      rejectionReason: reason.trim(),
    });
  };

  const { stats } = doctor;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
            <AdminDoctorAvatar name={doctor.name} avatarUrl={doctor.avatarUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl">{doctor.name}</CardTitle>
                <StatusBadge status={doctor.verificationStatus} />
                {!doctor.isActive && <Badge variant="outline">Account inactive</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                {doctor.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-slate-400" />
                    {doctor.email}
                  </span>
                )}
                {doctor.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-slate-400" />
                    {doctor.phone}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {doctor.specialties.map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoBlock label="PMDC" value={doctor.pmdcNumber ?? "—"} />
            <InfoBlock label="Consultation fee" value={formatCurrency(doctor.consultationFee)} />
            <InfoBlock
              label="Rating"
              value={
                doctor.ratingCount > 0
                  ? `${doctor.ratingAvg.toFixed(1)} (${doctor.ratingCount} reviews)`
                  : "No reviews yet"
              }
            />
            <InfoBlock label="Listing" value={doctor.isListed ? "Public" : "Hidden"} />
            <InfoBlock
              label="Services"
              value={[
                doctor.sundayConsultEnabled ? "Sunday consult" : null,
                doctor.homeVisitEnabled ? "Home visits" : null,
                doctor.isListed ? "Online consult" : null,
              ]
                .filter(Boolean)
                .join(", ") || "None enabled"}
            />
            <InfoBlock
              label="Home visit fee"
              value={doctor.homeVisitEnabled ? formatCurrency(doctor.homeVisitFee) : "—"}
            />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Account controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {doctor.verificationStatus !== VerificationStatuses.APPROVED && (
              <Button
                className="w-full justify-start"
                variant="outline"
                disabled={pending}
                onClick={() => updateDoctor({ verificationStatus: VerificationStatuses.APPROVED })}
              >
                <UserCheck className="h-4 w-4" />
                Restore approved
              </Button>
            )}
            {doctor.verificationStatus === VerificationStatuses.APPROVED && (
              <Button
                className="w-full justify-start"
                variant="outline"
                disabled={pending}
                onClick={restrictWithConfirm}
              >
                <ShieldAlert className="h-4 w-4" />
                Restrict doctor
              </Button>
            )}
            {doctor.verificationStatus === VerificationStatuses.PENDING && (
              <>
                <Button
                  className="w-full justify-start"
                  variant="default"
                  disabled={pending}
                  onClick={() => updateDoctor({ verificationStatus: VerificationStatuses.APPROVED })}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  disabled={pending}
                  onClick={rejectWithReason}
                >
                  <UserX className="h-4 w-4" />
                  Reject
                </Button>
              </>
            )}
            <Button
              className="w-full justify-start"
              variant="outline"
              disabled={pending}
              onClick={() => updateDoctor({ isListed: !doctor.isListed })}
            >
              {doctor.isListed ? "Unlist from directory" : "List publicly"}
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              disabled={pending}
              onClick={() => updateDoctor({ isActive: !doctor.isActive })}
            >
              <Ban className="h-4 w-4" />
              {doctor.isActive ? "Deactivate account" : "Activate account"}
            </Button>
            <Button className="w-full justify-start" variant="default" asChild>
              <Link href={`/admin/doctors/manage/${doctor.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit profile
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href={`/admin/doctors/review/${doctor.id}`}>View verification profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Working now"
          value={stats.isWorkingNow ? "In consult" : "Available"}
          highlight={stats.isWorkingNow}
        />
        <StatCard icon={CalendarDays} label="Today's appointments" value={stats.upcomingToday} />
        <StatCard
          icon={CheckCircle2}
          label="Completed (month)"
          value={stats.completedThisMonth}
        />
        <StatCard
          icon={CheckCircle2}
          label="Total earnings"
          value={formatCurrency(stats.totalEarnings)}
          sub={formatCurrency(stats.earningsThisMonth) + " this month"}
        />
      </div>

      <AccountabilityCard doctor={doctor} />

      <Card className="rounded-2xl border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Commission rates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Effective:{" "}
            <span className="font-semibold text-slate-900">
              {doctor.effectiveOnlineCommissionPercent}%
            </span>{" "}
            online ·{" "}
            <span className="font-semibold text-slate-900">
              {doctor.effectiveHomeVisitCommissionPercent}%
            </span>{" "}
            in-house
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <CommissionOverrideField
              label="Online & clinic override (%)"
              inputId="doctor-online-commission"
              defaultValue={doctor.onlineCommissionPercent}
              placeholder={String(doctor.effectiveOnlineCommissionPercent)}
              disabled={pending}
              onSave={(value) => updateDoctor({ onlineCommissionPercent: value })}
              onClear={() => updateDoctor({ onlineCommissionPercent: null })}
              hasOverride={doctor.onlineCommissionPercent != null}
            />
            <CommissionOverrideField
              label="In-house visit override (%)"
              inputId="doctor-home-commission"
              defaultValue={doctor.homeVisitCommissionPercent}
              placeholder={String(doctor.effectiveHomeVisitCommissionPercent)}
              disabled={pending}
              onSave={(value) => updateDoctor({ homeVisitCommissionPercent: value })}
              onClear={() => updateDoctor({ homeVisitCommissionPercent: null })}
              hasOverride={doctor.homeVisitCommissionPercent != null}
            />
          </div>
          <p className="text-xs text-slate-500">
            Leave blank to use platform defaults from{" "}
            <Link href="/admin/finances" className="font-medium text-brand hover:underline">
              Finances
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Service toggles</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending || doctor.verificationStatus === VerificationStatuses.RESTRICTED}
            onClick={() => updateDoctor({ sundayConsultEnabled: !doctor.sundayConsultEnabled })}
          >
            {doctor.sundayConsultEnabled ? "Disable Sunday consult" : "Enable Sunday consult"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={
              pending ||
              doctor.verificationStatus !== VerificationStatuses.APPROVED
            }
            onClick={() => updateDoctor({ homeVisitEnabled: !doctor.homeVisitEnabled })}
          >
            {doctor.homeVisitEnabled ? "Disable home visits" : "Enable home visits"}
          </Button>
        </CardContent>
        {doctor.weeklyAvailability.length > 0 && (
          <CardContent className="border-t border-slate-100 pt-4 text-sm text-slate-600">
            Weekly schedule:{" "}
            {doctor.weeklyAvailability
              .map(
                (a) =>
                  `${formatDayOfWeek(a.dayOfWeek)} ${a.startTimeLocal}–${a.endTimeLocal}`,
              )
              .join(", ")}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function formatDateTime(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AccountabilityCard({ doctor }: { doctor: AdminDoctorRow }) {
  const a = doctor.accountability;
  const monthMisses = a.currentMonthMisses;
  const warnThreshold = DOCTOR_ACCOUNTABILITY_CONFIG.warningThreshold;
  const removeThreshold = DOCTOR_ACCOUNTABILITY_CONFIG.removalThreshold;
  const removed = Boolean(a.autoRestrictedAt);
  const warned = !removed && monthMisses >= warnThreshold;

  const tone = removed
    ? "border-red-200 bg-red-50/60"
    : warned
      ? "border-orange-200 bg-orange-50/60"
      : "border-slate-200/80 bg-white";

  return (
    <Card className={cn("rounded-2xl shadow-sm", tone)}>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <ShieldAlert
          className={cn(
            "h-5 w-5",
            removed ? "text-red-600" : warned ? "text-orange-600" : "text-slate-400",
          )}
        />
        <CardTitle className="text-base">Attendance accountability</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600">
          Doctors are warned after{" "}
          <span className="font-semibold">{warnThreshold}</span> missed consultations
          in a calendar month and automatically removed (restricted) after{" "}
          <span className="font-semibold">{removeThreshold}</span>.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <InfoBlock label="Missed this month" value={`${monthMisses} / ${removeThreshold}`} />
          <InfoBlock label="Missed (all time)" value={String(a.totalMisses)} />
          <InfoBlock
            label="Status"
            value={removed ? "Auto-removed" : warned ? "Warned" : "Good standing"}
          />
        </div>
        {a.lastWarningAt && (
          <p className="text-xs text-slate-500">
            Last warning issued: {formatDateTime(a.lastWarningAt)}
          </p>
        )}
        {a.autoRestrictedAt && (
          <p className="text-xs font-medium text-red-600">
            Auto-restricted for missed consults on {formatDateTime(a.autoRestrictedAt)}.
            Use “Restore approved” above to reinstate.
          </p>
        )}
      </CardContent>
    </Card>
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
  highlight,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 shadow-sm",
        highlight
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-slate-200/80 bg-white",
      )}
    >
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <p className="text-sm font-medium">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function CommissionOverrideField({
  label,
  inputId,
  defaultValue,
  placeholder,
  disabled,
  onSave,
  onClear,
  hasOverride,
}: {
  label: string;
  inputId: string;
  defaultValue: number | null;
  placeholder: string;
  disabled?: boolean;
  onSave: (value: number) => void;
  onClear: () => void;
  hasOverride: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <label htmlFor={inputId} className="mb-2 block text-xs text-slate-500">
        {label}
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <input
          type="number"
          min={0}
          max={100}
          id={inputId}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          disabled={disabled}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            const input = document.getElementById(inputId) as HTMLInputElement | null;
            const raw = input?.value.trim();
            if (!raw) {
              onClear();
              return;
            }
            const value = Number(raw);
            if (Number.isNaN(value) || value < 0 || value > 100) return;
            onSave(value);
          }}
        >
          Save
        </Button>
        {hasOverride && (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={onClear}>
            Default
          </Button>
        )}
      </div>
    </div>
  );
}
