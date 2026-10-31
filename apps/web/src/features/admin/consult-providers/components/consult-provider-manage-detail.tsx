"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, FileText, Trash2 } from "lucide-react";
import { VerificationStatuses } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useSafeRouter } from "@/lib/navigation/safe-router";
import { dispatchAdminNavCountsRefresh } from "@/features/admin/lib/nav-counts-events";
import { errorMessage } from "@/features/admin/consult-providers/api";
import type { ConsultProviderKind } from "@/features/admin/consult-providers/config";
import { formatCurrency, formatDate } from "@/features/admin/consult-providers/format";
import { useConsultProviderAdmin } from "@/features/admin/consult-providers/hooks";
import type { AdminConsultProviderDetail } from "@/features/admin/consult-providers/types";
import {
  changeVerificationStatus,
  RESTRICTED_STATUS,
  statusRequiresReason,
} from "@/features/admin/consult-providers/verification";
import { ConsultProviderProfileForm } from "@/features/admin/consult-providers/components/consult-provider-profile-form";
import {
  ClinicList,
  DeleteProviderDialog,
  NoticeBanner,
  ProviderAvatar,
  ProviderStatusBadge,
  ReasonDialog,
  StatTile,
  ToggleRow,
  VerificationStatusSelect,
  WeeklyAvailabilityList,
} from "@/features/admin/consult-providers/components/shared";

type Props = {
  kind: ConsultProviderKind;
  initialProvider: AdminConsultProviderDetail;
};

/** Account controls, commission and profile corrections for one provider. */
export function ConsultProviderManageDetail({ kind, initialProvider }: Props) {
  const router = useSafeRouter();
  const { config, api } = useConsultProviderAdmin(kind);
  const { singularLower } = config.labels;

  const [provider, setProvider] = useState(initialProvider);
  // Commission is stripped from managers' responses (null still means "platform default").
  const showFinance = provider.onlineCommissionPercent !== undefined;
  // Bumped after each save so the edit form re-seeds from saved data.
  const [formVersion, setFormVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [commissionInput, setCommissionInput] = useState(
    initialProvider.onlineCommissionPercent?.toString() ?? "",
  );
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isApproved = provider.verificationStatus === VerificationStatuses.APPROVED;

  const applyProvider = (next: AdminConsultProviderDetail) => {
    setProvider(next);
    setCommissionInput(next.onlineCommissionPercent?.toString() ?? "");
    setFormVersion((v) => v + 1);
  };

  /** Runs an action, then shows a success notice or the error. Returns true on success. */
  const run = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
      return true;
    } catch (e) {
      setError(errorMessage(e, "Update failed"));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const update = (key: string, patch: Record<string, unknown>, success: string) =>
    run(key, async () => applyProvider(await api.update(provider.id, patch)), success);

  const applyStatus = (next: string, reason?: string) =>
    run(
      "status",
      async () => {
        await changeVerificationStatus(api, provider, next, reason);
        applyProvider(await api.detail(provider.id));
        setPendingStatus(null);
        dispatchAdminNavCountsRefresh();
      },
      `Status changed to ${next}.`,
    );

  const handleStatusSelect = (next: string) => {
    if (next === provider.verificationStatus) return;
    if (statusRequiresReason(next)) {
      setPendingStatus(next);
      return;
    }
    void applyStatus(next);
  };

  const saveCommission = () => {
    const raw = commissionInput.trim();
    if (raw === "") {
      void update(
        "commission",
        { onlineCommissionPercent: null },
        "Commission reset to platform default.",
      );
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setError("Commission must be a number between 0 and 100.");
      return;
    }
    void update("commission", { onlineCommissionPercent: value }, "Commission updated.");
  };

  const confirmDelete = async () => {
    setBusy("delete");
    setDeleteError(null);
    try {
      await api.remove(provider.id);
      dispatchAdminNavCountsRefresh();
      router.push(config.routes.manage);
      router.refresh();
    } catch (e) {
      setDeleteError(errorMessage(e, `Failed to remove ${singularLower}`));
      setBusy(null);
    }
  };

  const publicPath =
    isApproved && provider.isActive && provider.slug
      ? config.publicProfilePath(provider.slug)
      : null;

  return (
    <div className="space-y-6">
      <NoticeBanner
        error={error}
        notice={notice}
        onDismiss={() => {
          setError(null);
          setNotice(null);
        }}
      />

      <div className="flex flex-col gap-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ProviderAvatar name={provider.name} avatarUrl={provider.avatarUrl} size="lg" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-slate-900">{provider.name}</p>
              <ProviderStatusBadge status={provider.verificationStatus} />
              {!provider.isActive && (
                <Badge variant="outline" className="text-[11px]">
                  Inactive
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {[provider.email, provider.phone].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="text-xs text-slate-400">
              {[provider.city, `Member since ${formatDate(provider.createdAt)}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={config.routes.review(provider.id)}>
              <FileText className="h-4 w-4" />
              Application &amp; documents
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

      {!isApproved && provider.rejectionReason && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Reason: {provider.rejectionReason}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Completed consults" value={String(provider.completedConsults)} />
        <StatTile
          label="Rating"
          value={provider.ratingCount ? provider.ratingAvg.toFixed(1) : "—"}
          hint={`${provider.ratingCount} review${provider.ratingCount === 1 ? "" : "s"}`}
        />
        <StatTile label="Consultation fee" value={formatCurrency(provider.consultationFee)} />
        {showFinance && (
          <StatTile
            label="Commission"
            value={
              provider.onlineCommissionPercent == null
                ? "Default"
                : `${provider.onlineCommissionPercent}%`
            }
            hint="Share of each consult fee the provider keeps"
          />
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Account controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-slate-900">Verification status</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  Only approved {config.labels.pluralLower} can be listed and booked.
                </p>
              </div>
              <VerificationStatusSelect
                value={provider.verificationStatus}
                disabled={busy !== null}
                ariaLabel="Verification status"
                onChange={handleStatusSelect}
              />
            </div>
            <ToggleRow
              title="Listed in directory"
              description={
                isApproved
                  ? "Patients can find this profile in search and on the public directory."
                  : `Approve the ${singularLower} before listing them.`
              }
              enabled={provider.isListed}
              disabled={busy !== null || (!isApproved && !provider.isListed)}
              onToggle={() =>
                void update(
                  "listed",
                  { isListed: !provider.isListed },
                  provider.isListed ? "Hidden from directory." : "Listed in directory.",
                )
              }
              enableLabel="List"
              disableLabel="Hide"
            />
            <ToggleRow
              title="Video consults"
              description="Patients can book paid video consultations."
              enabled={provider.videoConsultEnabled}
              disabled={busy !== null || (!isApproved && !provider.videoConsultEnabled)}
              onToggle={() =>
                void update(
                  "video",
                  { videoConsultEnabled: !provider.videoConsultEnabled },
                  provider.videoConsultEnabled
                    ? "Video consults disabled."
                    : "Video consults enabled.",
                )
              }
              enableLabel="Enable"
              disableLabel="Disable"
            />
            <ToggleRow
              title="Account active"
              description="Inactive accounts are hidden from patients and cannot be booked."
              enabled={provider.isActive}
              disabled={busy !== null}
              onToggle={() => {
                if (
                  provider.isActive &&
                  !window.confirm(
                    `Deactivate ${provider.name}? They will be hidden from patients and cannot be booked.`,
                  )
                ) {
                  return;
                }
                void update(
                  "active",
                  { isActive: !provider.isActive },
                  provider.isActive ? "Account deactivated." : "Account activated.",
                );
              }}
              enableLabel="Activate"
              disableLabel="Deactivate"
            />

            {showFinance && (
            <div className="border-b border-slate-100 py-4">
              <Label htmlFor={`${config.kind}-commission`}>
                Share of consult fee kept by {singularLower} (%)
              </Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id={`${config.kind}-commission`}
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  placeholder="Platform default"
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
                Leave empty to use the platform default rate.
              </p>
            </div>
            )}

            <div className="pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => {
                  setDeleteError(null);
                  setShowDelete(true);
                }}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Remove {singularLower}
              </Button>
            </div>
          </CardContent>
        </Card>

        <ConsultProviderProfileForm
          key={formVersion}
          config={config}
          provider={provider}
          busy={busy !== null}
          onSubmit={(patch) => update("profile", patch, "Profile saved.")}
          onError={setError}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Practice locations</CardTitle>
            <p className="text-sm text-slate-500">
              Managed by the {singularLower} from their profile.
            </p>
          </CardHeader>
          <CardContent>
            <ClinicList clinics={provider.clinics} />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Weekly availability</CardTitle>
            <p className="text-sm text-slate-500">Consult hours patients can book.</p>
          </CardHeader>
          <CardContent>
            <WeeklyAvailabilityList slots={provider.weeklyAvailability} />
          </CardContent>
        </Card>
      </div>

      {pendingStatus && (
        <ReasonDialog
          title={
            pendingStatus === RESTRICTED_STATUS
              ? `Restrict ${singularLower}`
              : `Reject ${singularLower}`
          }
          description={`${provider.name} will be unlisted and shown this reason.`}
          confirmLabel={pendingStatus === RESTRICTED_STATUS ? "Restrict" : "Reject"}
          initialValue={provider.rejectionReason ?? ""}
          busy={busy === "status"}
          onCancel={() => setPendingStatus(null)}
          onConfirm={(reason) => void applyStatus(pendingStatus, reason)}
        />
      )}

      {showDelete && (
        <DeleteProviderDialog
          name={provider.name}
          providerLabel={singularLower}
          busy={busy === "delete"}
          error={deleteError}
          onCancel={() => setShowDelete(false)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}
