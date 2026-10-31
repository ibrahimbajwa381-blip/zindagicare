"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ExternalLink, FileText, Trash2, X } from "lucide-react";
import {
  cn,
  MAX_NURSING_SPECIALTIES,
  NURSING_HOME_VISIT_SPLIT as SPLIT,
  NURSING_SPECIALTIES_ALPHABETICAL,
  VerificationStatuses,
} from "@zindagi/shared";
import { useSafeRouter } from "@/lib/navigation/safe-router";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpecialtyMultiSelect } from "@/components/forms/specialty-multi-select";
import { NurseAvatar } from "@/features/nurse/components/nurse-avatar";
import {
  DeleteNurseDialog,
  NurseStatusBadge,
} from "@/features/admin/components/admin-nurses-management";
import { nurseProfilePath } from "@/lib/nurses/profile-path";
import type { AdminNurseDetailDto } from "@/features/admin/types/nurse-admin";
import { AdminNursePortfolioPanel } from "@/features/admin/components/admin-nurse-portfolio-panel";

const VISIT_STATUS_STYLES: Record<string, string> = {
  requested: "bg-slate-100 text-slate-700",
  assigned: "bg-sky-100 text-sky-800",
  en_route: "bg-indigo-100 text-indigo-800",
  arrived: "bg-violet-100 text-violet-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-700",
};

function formatCurrency(amount: number, currency = "PKR") {
  return `${currency} ${Math.round(amount).toLocaleString("en-PK")}`;
}

function humanize(value: string) {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
}

async function readError(res: Response, fallback: string) {
  try {
    const json = await res.json();
    return (json?.error?.message as string | undefined) ?? fallback;
  } catch {
    return fallback;
  }
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  title,
  description,
  enabled,
  disabled,
  onToggle,
  enableLabel,
  disableLabel,
}: {
  title: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
  enableLabel: string;
  disableLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-slate-900">
          {title}{" "}
          <span
            className={cn(
              "ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600",
            )}
          >
            {enabled ? "On" : "Off"}
          </span>
        </p>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={onToggle}
        className="shrink-0"
      >
        {enabled ? disableLabel : enableLabel}
      </Button>
    </div>
  );
}

type AdminNurseManageDetailProps = {
  initialProfile: AdminNurseDetailDto;
};

export function AdminNurseManageDetail({
  initialProfile,
}: AdminNurseManageDetailProps) {
  const router = useSafeRouter();
  const [profile, setProfile] = useState(initialProfile);
  // Earnings and commission are stripped from managers' responses.
  const showFinance = profile.stats.totalEarnings !== undefined;
  // Bumped after each successful refresh so the edit form re-seeds from saved data.
  const [formVersion, setFormVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [commissionInput, setCommissionInput] = useState(
    initialProfile.commissionOverride == null ? "" : String(initialProfile.commissionOverride),
  );
  const [showDelete, setShowDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const id = profile.id;
  const isApproved = profile.verificationStatus === VerificationStatuses.APPROVED;

  const refresh = async () => {
    const res = await fetch(`/api/v1/admin/nurses/${id}`, { cache: "no-store" });
    if (!res.ok) throw new Error(await readError(res, "Failed to reload nurse"));
    const json = await res.json();
    const next = json.data as AdminNurseDetailDto;
    setProfile(next);
    setCommissionInput(next.commissionOverride == null ? "" : String(next.commissionOverride));
    setFormVersion((v) => v + 1);
  };

  /** PATCH then reload the full profile. Returns true on success. */
  const update = async (
    key: string,
    patch: Record<string, unknown>,
    successMessage: string,
  ): Promise<boolean> => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/admin/nurses/${id}/manage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        setError(await readError(res, "Update failed"));
        return false;
      }
      await refresh();
      setNotice(successMessage);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const handleStatusChange = (next: string) => {
    if (next === profile.verificationStatus) return;
    if (next === VerificationStatuses.REJECTED) {
      const reason = window.prompt(`Reason for rejecting ${profile.user.name}:`);
      if (!reason?.trim()) return;
      if (reason.trim().length < 3) {
        setError("Rejection reason must be at least 3 characters.");
        return;
      }
      void update(
        "status",
        { verificationStatus: VerificationStatuses.REJECTED, rejectionReason: reason.trim() },
        "Nurse rejected.",
      );
      return;
    }
    void update("status", { verificationStatus: next }, "Nurse approved.");
  };

  const saveCommission = () => {
    const raw = commissionInput.trim();
    if (raw === "") {
      void update("commission", { commissionPercent: null }, "Commission reset to platform default.");
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError("Commission must be a number between 0 and 100.");
      return;
    }
    void update("commission", { commissionPercent: value }, "Commission updated.");
  };

  const confirmDelete = async () => {
    if (busy === "delete") return;
    if (deleteInput.trim().toLowerCase() !== profile.user.name.trim().toLowerCase()) {
      setDeleteError("Name didn't match — please type it exactly as shown.");
      return;
    }
    setBusy("delete");
    try {
      const res = await fetch(`/api/v1/admin/nurses/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/admin/nurses/manage");
        router.refresh();
        return;
      }
      setDeleteError(await readError(res, "Failed to delete nurse"));
    } catch {
      setDeleteError("Failed to delete nurse — check your connection.");
    } finally {
      setBusy(null);
    }
  };

  const publicPath =
    isApproved && profile.user.isActive && profile.slug
      ? nurseProfilePath(profile.slug)
      : null;

  return (
    <div className="space-y-6">
      {(error || notice) && (
        <div
          className={cn(
            "flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm",
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800",
          )}
          role={error ? "alert" : "status"}
        >
          <p>{error ?? notice}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setNotice(null);
            }}
            className="opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="flex flex-col gap-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <NurseAvatar name={profile.user.name} avatarUrl={profile.user.avatarUrl} size="lg" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-slate-900">{profile.user.name}</p>
              <NurseStatusBadge status={profile.verificationStatus} />
              {!profile.user.isActive && (
                <Badge variant="outline" className="text-[11px]">
                  Inactive
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {[profile.user.email, profile.user.phone].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="text-xs text-slate-400">
              {[profile.serviceArea.area, profile.serviceArea.city].filter(Boolean).join(", ")} ·
              Member since{" "}
              {new Date(profile.user.memberSince).toLocaleDateString("en-PK", {
                dateStyle: "medium",
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/nurses/review/${id}`}>
              <FileText className="h-4 w-4" />
              Documents &amp; notes
            </Link>
          </Button>
          {publicPath && (
            <Button variant="outline" size="sm" asChild>
              <Link href={publicPath} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Public profile
              </Link>
            </Button>
          )}
        </div>
      </div>

      {profile.verificationStatus === VerificationStatuses.REJECTED && profile.rejectionReason && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Rejection reason: {profile.rejectionReason}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active visits" value={String(profile.stats.activeVisits)} />
        <StatTile
          label="Completed visits"
          value={String(profile.stats.completedTotal)}
          hint={`${profile.stats.completedThisMonth} this month`}
        />
        {showFinance && (
          <>
            <StatTile
              label="Total earnings"
              value={formatCurrency(profile.stats.totalEarnings)}
              hint={
                profile.commissionOverride == null
                  ? `Keeps ${SPLIT.nursePercent}% of visit fees (platform keeps ${SPLIT.platformPercent}%)`
                  : `Keeps ${profile.commissionPercent}% of visit fees`
              }
            />
            <StatTile
              label="Earnings this month"
              value={formatCurrency(profile.stats.earningsThisMonth)}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Account controls */}
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Account controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-slate-900">Verification status</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  Only approved nurses are listed and receive visits.
                </p>
              </div>
              <div className="relative inline-flex shrink-0 items-center">
                <select
                  value={profile.verificationStatus}
                  disabled={busy !== null}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  aria-label="Verification status"
                  className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
                >
                  {profile.verificationStatus === VerificationStatuses.PENDING && (
                    <option value={VerificationStatuses.PENDING} disabled>
                      Pending
                    </option>
                  )}
                  <option value={VerificationStatuses.APPROVED}>Approved</option>
                  <option value={VerificationStatuses.REJECTED}>Rejected</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-slate-400" />
              </div>
            </div>

            <ToggleRow
              title="On duty"
              description="Available to be assigned new home visits."
              enabled={profile.isAvailable}
              disabled={busy !== null}
              onToggle={() =>
                void update(
                  "available",
                  { isAvailable: !profile.isAvailable },
                  profile.isAvailable ? "Marked off duty." : "Marked on duty.",
                )
              }
              enableLabel="Mark on duty"
              disableLabel="Mark off duty"
            />
            <ToggleRow
              title="Home visits"
              description={
                isApproved
                  ? "Patients can book this nurse for home sessions."
                  : "Approve the nurse before enabling home visits."
              }
              enabled={profile.homeVisitEnabled}
              disabled={busy !== null || (!isApproved && !profile.homeVisitEnabled)}
              onToggle={() =>
                void update(
                  "homeVisit",
                  { homeVisitEnabled: !profile.homeVisitEnabled },
                  profile.homeVisitEnabled ? "Home visits disabled." : "Home visits enabled.",
                )
              }
              enableLabel="Enable"
              disableLabel="Disable"
            />
            <ToggleRow
              title="Account active"
              description="Inactive accounts are hidden from patients and cannot be booked."
              enabled={profile.user.isActive}
              disabled={busy !== null}
              onToggle={() => {
                if (
                  profile.user.isActive &&
                  !window.confirm(
                    `Deactivate ${profile.user.name}? They will be hidden from patients and cannot be booked.`,
                  )
                ) {
                  return;
                }
                void update(
                  "active",
                  { isActive: !profile.user.isActive },
                  profile.user.isActive ? "Account deactivated." : "Account activated.",
                );
              }}
              enableLabel="Activate"
              disableLabel="Deactivate"
            />

            {showFinance && (
            <div className="border-b border-slate-100 py-4">
              <Label htmlFor="commission">Revenue share kept by nurse (%)</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="commission"
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  placeholder={
                    profile.commissionOverride == null
                      ? `Standard split (${SPLIT.nursePercent}%)`
                      : "Standard split"
                  }
                  value={commissionInput}
                  onChange={(e) => setCommissionInput(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={saveCommission}
                >
                  Save
                </Button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Leave empty to use the standard split: the nurse keeps{" "}
                {SPLIT.nursePercent}% of each visit fee and ZindagiCare keeps{" "}
                {SPLIT.platformPercent}%.
              </p>
            </div>
            )}

            <div className="pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => {
                  setDeleteInput("");
                  setDeleteError(null);
                  setShowDelete(true);
                }}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete permanently
              </Button>
            </div>
          </CardContent>
        </Card>

        <ProfileEditForm
          key={formVersion}
          profile={profile}
          busy={busy !== null}
          onSubmit={(patch) => update("profile", patch, "Profile saved.")}
          onError={setError}
        />
      </div>

      {/* Public portfolio (nurse-managed, read-only here) */}
      <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Public portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminNursePortfolioPanel
            portfolio={profile.portfolio}
            avatarUrl={profile.user.avatarUrl}
            publicPath={
              isApproved && profile.slug
                ? nurseProfilePath(profile.slug, profile.user.id)
                : null
            }
          />
        </CardContent>
      </Card>

      {/* Visit history */}
      <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Recent visits</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {profile.visitHistory.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-slate-500">No visits assigned yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Scheduled</th>
                    <th className="px-5 py-3">Service</th>
                    <th className="px-5 py-3">Patient</th>
                    <th className="hidden px-5 py-3 md:table-cell">Address</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profile.visitHistory.map((visit) => (
                    <tr key={visit.id}>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-700">
                        {formatDate(visit.scheduledAt)}
                      </td>
                      <td className="px-5 py-3 text-slate-700">{humanize(visit.serviceType)}</td>
                      <td className="px-5 py-3">
                        <p className="text-slate-900">{visit.patient.name}</p>
                        {visit.patient.phone && (
                          <p className="text-xs text-slate-500">{visit.patient.phone}</p>
                        )}
                      </td>
                      <td className="hidden max-w-xs truncate px-5 py-3 text-slate-600 md:table-cell">
                        {[visit.address.line, visit.address.city].filter(Boolean).join(", ")}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            VISIT_STATUS_STYLES[visit.status] ?? "bg-slate-100 text-slate-700",
                          )}
                        >
                          {humanize(visit.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-slate-900">
                        {formatCurrency(visit.pricing.total, visit.pricing.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showDelete && (
        <DeleteNurseDialog
          name={profile.user.name}
          value={deleteInput}
          error={deleteError}
          busy={busy === "delete"}
          onChange={(v) => {
            setDeleteInput(v);
            if (deleteError) setDeleteError(null);
          }}
          onCancel={() => setShowDelete(false)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}

function ProfileEditForm({
  profile,
  busy,
  onSubmit,
  onError,
}: {
  profile: AdminNurseDetailDto;
  busy: boolean;
  onSubmit: (patch: Record<string, unknown>) => Promise<boolean>;
  onError: (message: string) => void;
}) {
  const initial = {
    name: profile.user.name,
    phone: profile.user.phone ?? "",
    city: profile.serviceArea.city,
    area: profile.serviceArea.area ?? "",
    radiusKm: String(profile.serviceArea.radiusKm),
    licenseNumber: profile.licenseNumber ?? "",
    qualification: profile.qualification ?? "",
    experienceYears: profile.experienceYears == null ? "" : String(profile.experienceYears),
    languages: profile.languages.join(", "),
    bio: profile.bio ?? "",
  };
  const initialSpecialties = profile.specialties ?? [];

  const [form, setForm] = useState(initial);
  const [specialties, setSpecialties] = useState<string[]>(initialSpecialties);

  const set = (key: keyof typeof initial) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  /** Build a patch of changed fields only, so untouched legacy data never fails validation. */
  const buildPatch = (): Record<string, unknown> | string => {
    const patch: Record<string, unknown> = {};
    const trimmed = (key: keyof typeof initial) => form[key].trim();
    const changed = (key: keyof typeof initial) => trimmed(key) !== initial[key].trim();

    if (changed("name")) {
      if (trimmed("name").length < 2) return "Name must be at least 2 characters.";
      patch.name = trimmed("name");
    }
    if (changed("phone")) {
      if (!trimmed("phone")) return "Phone number can't be removed — enter a valid number.";
      patch.phone = trimmed("phone");
    }
    if (changed("city")) {
      if (trimmed("city").length < 2) return "City is required.";
      patch.city = trimmed("city");
    }
    if (changed("area")) patch.area = trimmed("area");
    if (changed("radiusKm")) {
      const radius = Number(trimmed("radiusKm"));
      if (!Number.isFinite(radius) || radius < 1 || radius > 50) {
        return "Service radius must be between 1 and 50 km.";
      }
      patch.radiusKm = radius;
    }
    if (changed("licenseNumber")) {
      if (trimmed("licenseNumber").length < 3) return "License number must be at least 3 characters.";
      patch.licenseNumber = trimmed("licenseNumber");
    }
    if (changed("qualification")) patch.qualification = trimmed("qualification");
    if (changed("experienceYears")) {
      if (!trimmed("experienceYears")) return "Experience can't be cleared — enter 0 or more.";
      const years = Number(trimmed("experienceYears"));
      if (!Number.isFinite(years) || years < 0 || years > 60) {
        return "Experience must be between 0 and 60 years.";
      }
      patch.experienceYears = years;
    }
    if (changed("languages")) {
      const languages = form.languages
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
      if (languages.length > 8) return "Up to 8 languages.";
      patch.languages = languages;
    }
    if (changed("bio")) patch.bio = trimmed("bio");
    if (specialties.join("|") !== initialSpecialties.join("|")) {
      patch.specialties = specialties;
    }
    return patch;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patch = buildPatch();
    if (typeof patch === "string") {
      onError(patch);
      return;
    }
    if (Object.keys(patch).length === 0) {
      onError("No changes to save.");
      return;
    }
    await onSubmit(patch);
  };

  return (
    <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Edit profile</CardTitle>
        <p className="text-sm text-slate-500">
          Correct mistakes on this nurse&apos;s contact details, credentials, and public
          profile.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="edit-name">Full name</Label>
            <Input id="edit-name" value={form.name} onChange={set("name")} required />
          </div>
          <div>
            <Label htmlFor="edit-phone">Mobile number</Label>
            <Input id="edit-phone" type="tel" value={form.phone} onChange={set("phone")} />
          </div>
          <div>
            <Label htmlFor="edit-license">License / registration no.</Label>
            <Input
              id="edit-license"
              value={form.licenseNumber}
              onChange={set("licenseNumber")}
              maxLength={40}
            />
          </div>
          <div>
            <Label htmlFor="edit-qualification">Qualification</Label>
            <Input
              id="edit-qualification"
              value={form.qualification}
              onChange={set("qualification")}
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="edit-experience">Experience (years)</Label>
            <Input
              id="edit-experience"
              type="number"
              min={0}
              max={60}
              value={form.experienceYears}
              onChange={set("experienceYears")}
            />
          </div>
          <div>
            <Label htmlFor="edit-languages">Languages (comma-separated)</Label>
            <Input id="edit-languages" value={form.languages} onChange={set("languages")} />
          </div>
          <div>
            <Label htmlFor="edit-city">City</Label>
            <Input id="edit-city" value={form.city} onChange={set("city")} required />
          </div>
          <div>
            <Label htmlFor="edit-area">Area / neighborhood</Label>
            <Input id="edit-area" value={form.area} onChange={set("area")} maxLength={120} />
          </div>
          <div>
            <Label htmlFor="edit-radius">Service radius (km)</Label>
            <Input
              id="edit-radius"
              type="number"
              min={1}
              max={50}
              value={form.radiusKm}
              onChange={set("radiusKm")}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="edit-specialties">Specialties</Label>
            <SpecialtyMultiSelect
              id="edit-specialties"
              values={specialties}
              onChange={setSpecialties}
              max={MAX_NURSING_SPECIALTIES}
              options={NURSING_SPECIALTIES_ALPHABETICAL}
              placeholder="Add nursing specialties"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="edit-bio">Bio</Label>
            <textarea
              id="edit-bio"
              value={form.bio}
              onChange={set("bio")}
              maxLength={2000}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy}>
              Save changes
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setForm(initial);
                setSpecialties(initialSpecialties);
              }}
            >
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
