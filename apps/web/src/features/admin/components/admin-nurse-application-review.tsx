"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VerificationStatuses } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dispatchAdminNavCountsRefresh } from "@/features/admin/lib/nav-counts-events";
import type { AdminNurseDetailDto } from "@/features/admin/types/nurse-admin";
import {
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  Save,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";

type Props = {
  profile: AdminNurseDetailDto;
};

const SERVICE_LABELS: Record<string, string> = {
  nurse: "Nursing care",
  iv_drip: "IV drip",
  injection: "Injection",
  wound_care: "Wound care",
  sample_collection: "Sample collection",
  emergency: "Emergency",
  doctor_visit: "Doctor visit",
};

const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  assigned: "Assigned",
  en_route: "En route",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
};

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value || "—"}</p>
    </div>
  );
}

function DocumentCard({ label, url }: { label: string; url?: string }) {
  const isImage = url && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      {!url ? (
        <p className="mt-2 text-xs text-slate-500">Not uploaded</p>
      ) : (
        <div className="mt-3 space-y-3">
          {isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={label}
              className="max-h-40 w-full rounded-lg border border-slate-100 bg-slate-50 object-contain"
            />
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            <FileText className="h-4 w-4" />
            Open document
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

function formatCurrency(amount: number, currency = "PKR") {
  return `${currency} ${amount.toLocaleString("en-PK")}`;
}

export function AdminNurseApplicationReview({ profile }: Props) {
  const router = useRouter();
  const [interviewConfirmed, setInterviewConfirmed] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const [notes, setNotes] = useState(profile.adminNotes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesError, setNotesError] = useState<string>();

  const isPending = profile.verificationStatus === VerificationStatuses.PENDING;
  const isApproved = profile.verificationStatus === VerificationStatuses.APPROVED;
  const isRejected = profile.verificationStatus === VerificationStatuses.REJECTED;
  const hasSubmitted = Boolean(profile.verificationSubmittedAt);

  async function saveNotes() {
    setNotesSaving(true);
    setNotesError(undefined);
    setNotesSaved(false);

    try {
      const res = await fetch(`/api/v1/admin/nurses/${profile.id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Failed to save notes");
      }
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
    } catch (e) {
      setNotesError(e instanceof Error ? e.message : "Failed to save notes");
    } finally {
      setNotesSaving(false);
    }
  }

  async function decide(action: "approve" | "reject") {
    if (action === "approve" && isPending && hasSubmitted && !interviewConfirmed) return;

    let rejectionReason: string | undefined;
    if (action === "reject") {
      rejectionReason =
        window.prompt(
          `Reason for ${action === "reject" && isApproved ? "revoking approval of" : "rejecting"} ${profile.user.name}'s application:`,
          profile.rejectionReason ?? "",
        ) ?? undefined;
      if (rejectionReason === undefined) return;
      rejectionReason = rejectionReason.trim() || undefined;
      if (!isApproved && !rejectionReason) return;
    } else if (
      !window.confirm(
        `Approve ${profile.user.name}? They will be able to receive in-house visit assignments.`,
      )
    ) {
      return;
    }

    setActionPending(true);
    setActionError(undefined);

    const res = await fetch("/api/v1/admin/nurses/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staffProfileId: profile.id,
        action,
        rejectionReason,
      }),
    });
    const json = await res.json();
    setActionPending(false);

    if (!res.ok || !json.success) {
      setActionError(json?.error?.message ?? "Action failed");
      return;
    }

    dispatchAdminNavCountsRefresh();
    router.push("/admin/nurses");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">{profile.user.name}</h2>
              {isPending && hasSubmitted && (
                <Badge variant="secondary">Pending review</Badge>
              )}
              {isPending && !hasSubmitted && (
                <Badge variant="outline">Documents not submitted</Badge>
              )}
              {isApproved && <Badge>Approved</Badge>}
              {isRejected && <Badge variant="outline">Rejected</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {profile.licenseNumber ?? "No license on file"} ·{" "}
              {profile.qualification ?? "—"}
              {profile.experienceYears !== undefined
                ? ` · ${profile.experienceYears} yrs experience`
                : ""}
            </p>
            {profile.verificationSubmittedAt && (
              <p className="mt-1 text-xs text-slate-500">
                Submitted{" "}
                {new Date(profile.verificationSubmittedAt).toLocaleString("en-PK", {
                  dateStyle: "full",
                  timeStyle: "short",
                })}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.user.phone && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${profile.user.phone}`}>
                    <Phone className="h-4 w-4" />
                    {profile.user.phone}
                  </a>
                </Button>
              )}
              {profile.user.email && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`mailto:${profile.user.email}`}>
                    <Mail className="h-4 w-4" />
                    {profile.user.email}
                  </a>
                </Button>
              )}
            </div>
          </div>

          {isApproved && (
            <div className="flex shrink-0 flex-col items-end gap-1 text-right text-sm">
              <span
                className={
                  profile.isAvailable
                    ? "font-medium text-emerald-700"
                    : "font-medium text-slate-500"
                }
              >
                {profile.isAvailable ? "Available for visits" : "Currently unavailable"}
              </span>
              {profile.employeeCode && (
                <span className="text-xs text-slate-500">ID {profile.employeeCode}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {isPending && hasSubmitted && (
        <div className="rounded-2xl border border-brand/20 bg-brand/5 p-5 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Admin review workflow</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Review credentials and documents below.</li>
            <li>
              Conduct the verification interview with the nurse{" "}
              <strong>outside this platform</strong> (phone, video, or in person).
            </li>
            <li>Record your interview notes in the section below.</li>
            <li>Approve or reject the application when ready.</li>
          </ol>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Admin notes</h2>
        <p className="text-sm text-slate-600">
          Private notes for your team — interview observations, follow-ups, or internal
          comments. Not visible to the nurse.
        </p>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            maxLength={5000}
            placeholder="e.g. Interviewed on 13 Jun — verified PNC license verbally, 5 yrs ICU experience at Services Hospital…"
            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-light/30"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={notesSaving}
              onClick={() => void saveNotes()}
            >
              <Save className="h-4 w-4" />
              {notesSaving ? "Saving…" : "Save notes"}
            </Button>
            {notesSaved && (
              <span className="text-sm font-medium text-emerald-700">Notes saved</span>
            )}
            {notesError && <span className="text-sm text-red-600">{notesError}</span>}
            <span className="ml-auto text-xs text-slate-400">{notes.length}/5000</span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Professional details</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InfoBlock label="License / PNC" value={profile.licenseNumber ?? "—"} />
          <InfoBlock label="Qualification" value={profile.qualification ?? "—"} />
          <InfoBlock
            label="Experience"
            value={
              profile.experienceYears !== undefined
                ? `${profile.experienceYears} years`
                : "—"
            }
          />
          <InfoBlock
            label="CNIC (last 4)"
            value={profile.cnicLast4 ? `•••••-•••••${profile.cnicLast4}` : "—"}
          />
          <InfoBlock
            label="Member since"
            value={new Date(profile.user.memberSince).toLocaleDateString("en-PK")}
          />
          <InfoBlock
            label="In-house visits"
            value={profile.homeVisitEnabled ? "Enabled" : "Not enabled"}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Service area</h2>
        <div className="flex items-start gap-2 rounded-xl border border-slate-200/80 bg-white p-4 text-sm text-slate-700">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <div>
            <p className="font-medium text-slate-900">
              {profile.serviceArea.city}
              {profile.serviceArea.area ? ` · ${profile.serviceArea.area}` : ""}
            </p>
            <p className="mt-0.5 text-slate-500">
              {profile.serviceArea.radiusKm} km matching radius
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Verification documents</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profile.documents.length > 0 ? (
            profile.documents.map((doc) => (
              <DocumentCard key={doc.label} label={doc.label} url={doc.url} />
            ))
          ) : (
            <p className="text-sm text-slate-500">No documents uploaded yet.</p>
          )}
        </div>
      </section>

      {(isApproved || profile.stats.completedTotal > 0) && (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Performance & earnings</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Total earnings</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {formatCurrency(profile.stats.totalEarnings)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">This month</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {formatCurrency(profile.stats.earningsThisMonth)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Completed visits</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {profile.stats.completedTotal}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {profile.stats.completedThisMonth} this month
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Active visits</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {profile.stats.activeVisits}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Home visit history</h2>
            {profile.visitHistory.length === 0 ? (
              <p className="rounded-xl border border-slate-200/80 bg-white p-6 text-sm text-slate-500">
                No home visits assigned yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Patient</th>
                        <th className="px-5 py-3">Service</th>
                        <th className="px-5 py-3">Location</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {profile.visitHistory.map((visit) => (
                        <tr key={visit.id} className="hover:bg-slate-50/60">
                          <td className="px-5 py-3 text-slate-700">
                            {new Date(visit.scheduledAt).toLocaleDateString("en-PK", {
                              dateStyle: "medium",
                            })}
                          </td>
                          <td className="px-5 py-3">
                            <p className="font-medium text-slate-900">{visit.patient.name}</p>
                            {visit.patient.phone && (
                              <p className="text-xs text-slate-500">{visit.patient.phone}</p>
                            )}
                          </td>
                          <td className="px-5 py-3 text-slate-700">
                            {SERVICE_LABELS[visit.serviceType] ?? visit.serviceType}
                          </td>
                          <td className="max-w-[12rem] truncate px-5 py-3 text-slate-600">
                            {visit.address.line}, {visit.address.city}
                          </td>
                          <td className="px-5 py-3">
                            <Badge
                              variant={
                                visit.status === "completed"
                                  ? "secondary"
                                  : visit.status === "cancelled"
                                    ? "outline"
                                    : "default"
                              }
                              className="text-xs"
                            >
                              {STATUS_LABELS[visit.status] ?? visit.status}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-slate-900">
                            {formatCurrency(
                              visit.pricing.total,
                              visit.pricing.currency,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {isRejected && profile.rejectionReason && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Rejection reason</p>
          <p className="mt-1">{profile.rejectionReason}</p>
        </div>
      )}

      {isPending && hasSubmitted && (
        <div className="sticky bottom-4 z-10 space-y-4 rounded-2xl border border-brand/30 bg-white p-6 shadow-lg">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={interviewConfirmed}
              onChange={(e) => setInterviewConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span>
              I have reviewed this nurse&apos;s profile and documents, completed the
              verification interview, and recorded any notes. I am ready to approve or
              reject this application.
            </span>
          </label>

          {actionError && <p className="text-sm text-red-600">{actionError}</p>}

          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!interviewConfirmed || actionPending}
              onClick={() => decide("approve")}
            >
              <UserCheck className="h-4 w-4" />
              {actionPending ? "Processing…" : "Approve nurse"}
            </Button>
            <Button
              variant="outline"
              disabled={actionPending}
              onClick={() => decide("reject")}
            >
              <UserX className="h-4 w-4" />
              Reject application
            </Button>
          </div>
        </div>
      )}

      {isApproved && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">
            This nurse is approved and can receive in-house visit assignments.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 border-red-200 text-red-600 hover:bg-red-50"
            disabled={actionPending}
            onClick={() => decide("reject")}
          >
            <XCircle className="h-4 w-4" />
            Revoke approval
          </Button>
          {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
        </div>
      )}

      {isPending && !hasSubmitted && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Waiting for nurse to submit documents</p>
          <p className="mt-1">
            This nurse has registered but has not yet submitted their verification form.
          </p>
        </div>
      )}
    </div>
  );
}
