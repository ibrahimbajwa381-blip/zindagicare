"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle, Phone, Settings2, UserCheck, UserX, XCircle } from "lucide-react";
import { cn, VerificationStatuses } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dispatchAdminNavCountsRefresh } from "@/features/admin/lib/nav-counts-events";
import { errorMessage } from "@/features/admin/consult-providers/api";
import type { ConsultProviderKind } from "@/features/admin/consult-providers/config";
import {
  claimedSpecialties,
  formatCnicLast4,
  formatCurrency,
  formatDate,
  formatDateTime,
  whatsAppNumber,
} from "@/features/admin/consult-providers/format";
import { useConsultProviderAdmin } from "@/features/admin/consult-providers/hooks";
import type { AdminConsultProviderDetail } from "@/features/admin/consult-providers/types";
import {
  ClinicList,
  DocumentCard,
  InfoBlock,
  ProviderAvatar,
  ProviderStatusBadge,
  ReasonDialog,
  StatTile,
  WeeklyAvailabilityList,
} from "@/features/admin/consult-providers/components/shared";

type Props = {
  kind: ConsultProviderKind;
  provider: AdminConsultProviderDetail;
};

/** Application review: credentials, documents and the approve / reject decision. */
export function ConsultProviderApplicationReview({ kind, provider }: Props) {
  const router = useRouter();
  const { config, api } = useConsultProviderAdmin(kind);
  const { singular, singularLower } = config.labels;

  const status = provider.verificationStatus;
  const isPending = status === VerificationStatuses.PENDING;
  const isApproved = status === VerificationStatuses.APPROVED;
  const hasSubmitted = Boolean(provider.verificationSubmittedAt);
  const canDecide = hasSubmitted && !isApproved;

  const claimed = claimedSpecialties(provider);
  const [verified, setVerified] = useState<string[]>(
    isApproved && provider.specialties.length ? provider.specialties : claimed,
  );
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reasonDialog, setReasonDialog] = useState<"reject" | "revoke" | null>(null);

  const toggleSpecialty = (specialty: string) =>
    setVerified((current) =>
      current.includes(specialty)
        ? current.filter((s) => s !== specialty)
        : [...current, specialty],
    );

  const finish = () => {
    dispatchAdminNavCountsRefresh();
    router.push(config.routes.queue);
    router.refresh();
  };

  const approve = async () => {
    if (verified.length === 0) {
      setError("Verify at least one specialty before approving.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await api.decide(provider.id, "approve", { verifiedSpecialties: verified });
      finish();
    } catch (e) {
      setError(errorMessage(e, "Approval failed"));
      setBusy(false);
    }
  };

  const reject = async (rejectionReason: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await api.decide(provider.id, "reject", { rejectionReason });
      setReasonDialog(null);
      finish();
    } catch (e) {
      setError(errorMessage(e, "Rejection failed"));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <HeaderCard provider={provider} manageHref={config.routes.manageDetail(provider.id)} />

      {isPending && hasSubmitted && (
        <div className="rounded-2xl border border-brand/20 bg-brand/5 p-5 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Admin review workflow</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Check the registration number, qualification and uploaded documents below.</li>
            <li>
              Verify identity and credentials with the {singularLower}{" "}
              <strong>outside this platform</strong> (phone, video, or in person).
            </li>
            <li>Tick the specialties you have verified — only these are shown to patients.</li>
            <li>Approve or reject the application.</li>
          </ol>
        </div>
      )}

      {isPending && !hasSubmitted && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Waiting for the {singularLower} to submit documents</p>
          <p className="mt-1">
            This account is registered but the verification form has not been submitted yet.
          </p>
        </div>
      )}

      {status === VerificationStatuses.REJECTED && provider.rejectionReason && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Rejection reason</p>
          <p className="mt-1">{provider.rejectionReason}</p>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Professional details</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InfoBlock label="Registration / license no." value={provider.licenseNumber} />
          <InfoBlock label="Qualification" value={provider.degree} />
          <InfoBlock label="Institute" value={provider.institute} />
          <InfoBlock label="Graduation year" value={provider.graduationYear?.toString()} />
          <InfoBlock label="Experience" value={`${provider.experienceYears} years`} />
          <InfoBlock label="CNIC (last 4)" value={formatCnicLast4(provider.cnicLast4)} />
          <InfoBlock label="Consultation fee" value={formatCurrency(provider.consultationFee)} />
          <InfoBlock label="Languages" value={provider.languages.join(", ")} />
          <InfoBlock label="Member since" value={formatDate(provider.createdAt)} />
          {provider.qualifications.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-3">
              <InfoBlock
                label="Additional qualifications"
                value={provider.qualifications.join(", ")}
              />
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Specialties</h2>
        <p className="text-sm text-slate-600">
          {canDecide
            ? "Requested by the applicant. Untick anything you could not verify — patients only see verified specialties."
            : "Verified specialties are shown to patients."}
        </p>
        {claimed.length === 0 ? (
          <p className="text-sm text-amber-700">No specialties requested yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {claimed.map((specialty) => {
              const checked = verified.includes(specialty);
              return (
                <label
                  key={specialty}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                    checked
                      ? "border-brand/40 bg-brand/5 text-slate-900"
                      : "border-slate-200 bg-white text-slate-500",
                    canDecide ? "cursor-pointer" : "cursor-default",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!canDecide}
                    onChange={() => toggleSpecialty(specialty)}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  {specialty}
                  {specialty === provider.primarySpecialty && (
                    <span className="text-[11px] font-semibold uppercase text-brand">Primary</span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </section>

      {provider.bio && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Bio</h2>
          <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            {provider.bio}
          </p>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Practice locations</h2>
          <ClinicList clinics={provider.clinics} />
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Weekly availability</h2>
          <WeeklyAvailabilityList slots={provider.weeklyAvailability} />
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Verification documents</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DocumentCard label="Profile photo" url={provider.avatarUrl} image />
          {provider.documents.map((doc) => (
            <DocumentCard key={doc.key} label={doc.label} url={doc.url} />
          ))}
        </div>
        {provider.documents.length === 0 && (
          <p className="text-sm text-slate-500">No verification documents uploaded yet.</p>
        )}
      </section>

      {(isApproved || provider.completedConsults > 0) && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Performance</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile label="Completed consults" value={String(provider.completedConsults)} />
            <StatTile
              label="Rating"
              value={provider.ratingCount ? provider.ratingAvg.toFixed(1) : "—"}
              hint={`${provider.ratingCount} review${provider.ratingCount === 1 ? "" : "s"}`}
            />
            <StatTile label="Verified on" value={formatDate(provider.verifiedAt)} />
          </div>
        </section>
      )}

      {canDecide && (
        <div className="sticky bottom-4 z-10 space-y-4 rounded-2xl border border-brand/30 bg-white p-6 shadow-lg">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={reviewConfirmed}
              onChange={(e) => setReviewConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>
              I have reviewed this {singularLower}&apos;s credentials and documents and verified
              the specialties ticked above.
            </span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!reviewConfirmed || busy || verified.length === 0}
              onClick={() => void approve()}
            >
              <UserCheck className="h-4 w-4" />
              {busy ? "Processing…" : `Approve ${singularLower}`}
            </Button>
            {isPending && (
              <Button variant="outline" disabled={busy} onClick={() => setReasonDialog("reject")}>
                <UserX className="h-4 w-4" />
                Reject application
              </Button>
            )}
          </div>
        </div>
      )}

      {isApproved && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">
            This {singularLower} is approved and can be listed for video consultations.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 border-red-200 text-red-600 hover:bg-red-50"
            disabled={busy}
            onClick={() => setReasonDialog("revoke")}
          >
            <XCircle className="h-4 w-4" />
            Revoke approval
          </Button>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {reasonDialog && (
        <ReasonDialog
          title={reasonDialog === "revoke" ? "Revoke approval" : "Reject application"}
          description={`${provider.name} will be unlisted and see this reason on their ${singular} dashboard.`}
          confirmLabel={reasonDialog === "revoke" ? "Revoke approval" : "Reject"}
          initialValue={provider.rejectionReason ?? ""}
          busy={busy}
          onCancel={() => setReasonDialog(null)}
          onConfirm={(reason) => void reject(reason)}
        />
      )}
    </div>
  );
}

function HeaderCard({
  provider,
  manageHref,
}: {
  provider: AdminConsultProviderDetail;
  manageHref: string;
}) {
  const isPending = provider.verificationStatus === VerificationStatuses.PENDING;
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {provider.avatarUrl ? (
            <a
              href={provider.avatarUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open full-size photo"
              className="shrink-0"
            >
              <ProviderAvatar name={provider.name} avatarUrl={provider.avatarUrl} size="xl" />
            </a>
          ) : (
            <ProviderAvatar name={provider.name} size="xl" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">{provider.name}</h2>
              <ProviderStatusBadge status={provider.verificationStatus} />
              {isPending && !provider.verificationSubmittedAt && (
                <Badge variant="outline">Documents not submitted</Badge>
              )}
              {!provider.isActive && <Badge variant="outline">Inactive</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {provider.licenseNumber ?? "No registration on file"} · {provider.degree ?? "—"} ·{" "}
              {provider.experienceYears} yrs experience
            </p>
            {provider.verificationSubmittedAt && (
              <p className="mt-1 text-xs text-slate-500">
                Submitted {formatDateTime(provider.verificationSubmittedAt)}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Provider agreement:{" "}
              {provider.platformAgreementAcceptedAt ? (
                <span className="font-medium text-emerald-700">
                  Accepted {formatDate(provider.platformAgreementAcceptedAt)}
                </span>
              ) : (
                <span className="font-medium text-red-600">Not accepted</span>
              )}
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <ContactBlock icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
                {provider.phone && (
                  <>
                    <a
                      href={`tel:${provider.phone}`}
                      className="text-base font-semibold tabular-nums text-slate-900 hover:text-brand"
                    >
                      {provider.phone}
                    </a>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`tel:${provider.phone}`}>
                          <Phone className="h-4 w-4" />
                          Call
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`https://wa.me/${whatsAppNumber(provider.phone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </a>
                      </Button>
                    </div>
                  </>
                )}
              </ContactBlock>
              <ContactBlock icon={<Mail className="h-3.5 w-3.5" />} label="Email">
                {provider.email && (
                  <a
                    href={`mailto:${provider.email}`}
                    className="break-all text-base font-semibold text-slate-900 hover:text-brand"
                  >
                    {provider.email}
                  </a>
                )}
              </ContactBlock>
            </dl>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href={manageHref}>
            <Settings2 className="h-4 w-4" />
            Manage
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ContactBlock({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-1">
        {children || <span className="text-sm text-slate-500">Not provided</span>}
      </dd>
    </div>
  );
}
