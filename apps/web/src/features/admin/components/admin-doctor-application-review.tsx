"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { VerificationStatuses } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminDoctorAvatar } from "@/features/admin/components/admin-doctor-avatar";
import { dispatchAdminNavCountsRefresh } from "@/features/admin/lib/nav-counts-events";
import { formatDayOfWeek, type DoctorProfileDto } from "@/features/doctor/types";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import {
  ExternalLink,
  FileText,
  Mail,
  Phone,
  UserCheck,
  UserX,
} from "lucide-react";

type Props = {
  profile: DoctorProfileDto;
};

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

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
              className="max-h-40 w-full rounded-lg border border-slate-100 object-contain bg-slate-50"
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

export function AdminDoctorApplicationReview({ profile }: Props) {
  const router = useRouter();
  const [interviewConfirmed, setInterviewConfirmed] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string>();

  const isPending = profile.verificationStatus === VerificationStatuses.PENDING;
  const isApproved = profile.verificationStatus === VerificationStatuses.APPROVED;
  const isRejected = profile.verificationStatus === VerificationStatuses.REJECTED;

  async function decide(action: "approve" | "reject") {
    if (action === "approve" && !interviewConfirmed) return;

    let rejectionReason: string | undefined;
    if (action === "reject") {
      rejectionReason =
        window.prompt("Rejection reason (shown to the doctor):") ?? undefined;
      if (!rejectionReason?.trim()) return;
    } else if (
      !window.confirm(
        `Approve ${profile.user.name}? Their profile will go live publicly.`,
      )
    ) {
      return;
    }

    setActionPending(true);
    setActionError(undefined);

    const res = await fetch("/api/v1/admin/doctors/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctorProfileId: profile.id,
        action,
        rejectionReason,
      }),
    });
    const json = await res.json();
    setActionPending(false);

    if (!res.ok || !json.success) {
      const msg = json?.error?.message ?? "Action failed";
      setActionError(msg);
      return;
    }

    dispatchAdminNavCountsRefresh();
    router.push("/admin/doctors");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <AdminDoctorAvatar
            name={profile.user.name}
            avatarUrl={resolveDoctorPortrait(profile.user.name, profile.user.avatarUrl)}
            size="xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">{profile.user.name}</h2>
              {isPending && <Badge variant="secondary">Pending review</Badge>}
              {isApproved && <Badge>Approved · Live</Badge>}
              {isRejected && <Badge variant="outline">Rejected</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              PMDC {profile.pmdcNumber ?? "—"} · {profile.specialties.join(", ")}
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
        </div>
      </div>

      {isPending && (
        <div className="rounded-2xl border border-brand/20 bg-brand/5 p-5 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Admin review workflow</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Review the full profile and uploaded documents below.</li>
            <li>
              Conduct the verification interview with the doctor{" "}
              <strong>outside this platform</strong> (phone, video call, or in person).
            </li>
            <li>
              After the interview, return here and approve or reject the application.
            </li>
          </ol>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Professional details</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InfoBlock label="Specialization category" value={profile.specialties.join(", ")} />
          <InfoBlock label="Primary degree" value={profile.medicalDegree ?? "—"} />
          <InfoBlock
            label="Additional qualifications"
            value={profile.qualifications.length ? profile.qualifications.join(", ") : "—"}
          />
          <InfoBlock label="Medical college" value={profile.medicalCollege ?? "—"} />
          <InfoBlock label="Graduation year" value={String(profile.graduationYear ?? "—")} />
          <InfoBlock label="Experience" value={`${profile.experienceYears} years`} />
          <InfoBlock label="Consultation fee" value={`PKR ${profile.consultationFee}`} />
          <InfoBlock label="CNIC (last 4)" value={profile.cnicLast4 ? `*****-${profile.cnicLast4}` : "—"} />
          <InfoBlock label="Languages" value={profile.languages.join(", ")} />
          <InfoBlock
            label="Member since"
            value={new Date(profile.user.memberSince).toLocaleDateString("en-PK")}
          />
        </div>
      </section>

      {profile.bio && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Bio</h2>
          <p className="rounded-xl border border-slate-200/80 bg-white/60 p-4 text-sm text-slate-700">
            {profile.bio}
          </p>
        </section>
      )}

      {profile.hospitals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Practice locations</h2>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            {profile.hospitals.map((h) => (
              <li key={`${h.name}-${h.city}`} className="p-4 text-sm">
                <p className="font-medium text-slate-900">{h.name}</p>
                <p className="text-slate-600">
                  {h.city}
                  {h.address ? ` · ${h.address}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.weeklyAvailability.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Weekly availability</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {profile.weeklyAvailability.map((slot) => (
              <div
                key={`${slot.dayOfWeek}-${slot.startTimeLocal}`}
                className="rounded-lg border border-slate-200/80 bg-white/60 px-4 py-3 text-sm"
              >
                <span className="font-medium text-slate-900">
                  {formatDayOfWeek(slot.dayOfWeek)}
                </span>
                <span className="text-slate-600">
                  {" "}
                  · {formatTime12h(slot.startTimeLocal)} –{" "}
                  {formatTime12h(slot.endTimeLocal)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {profile.sundayConsult.enabled && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Sunday free consult</h2>
          <p className="text-sm text-slate-600">
            {formatTime12h(profile.sundayConsult.startTimeLocal!)} –{" "}
            {formatTime12h(profile.sundayConsult.endTimeLocal!)} ·{" "}
            {profile.sundayConsult.slotDurationMins} min slots
            {profile.sundayConsult.maxSlots
              ? ` · max ${profile.sundayConsult.maxSlots} slots`
              : ""}
          </p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Verification documents</h2>
        <p className="text-sm text-slate-600">
          Open each document to verify PMDC registration, CNIC, and medical degree before
          approving.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <DocumentCard label="PMDC certificate" url={profile.documents.pmdcCertificate} />
          <DocumentCard label="Degree certificate" url={profile.documents.degreeCertificate} />
          <DocumentCard label="CNIC (front)" url={profile.documents.cnicFront} />
          <DocumentCard label="CNIC (back)" url={profile.documents.cnicBack} />
        </div>
      </section>

      {isRejected && profile.rejectionReason && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">Rejection reason</p>
          <p className="mt-1">{profile.rejectionReason}</p>
        </div>
      )}

      {isPending && (
        <div className="sticky bottom-4 z-10 space-y-4 rounded-2xl border border-brand/30 bg-white p-6 shadow-lg">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={interviewConfirmed}
                onChange={(e) => setInterviewConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span>
                I have reviewed this doctor&apos;s profile and documents, and completed
                the verification interview <strong>outside this platform</strong>. I am
                ready to approve or reject this application.
              </span>
            </label>

            {actionError && <p className="text-sm text-red-600">{actionError}</p>}

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={!interviewConfirmed || actionPending}
                onClick={() => decide("approve")}
              >
                <UserCheck className="h-4 w-4" />
                {actionPending ? "Processing…" : "Approve & publish profile"}
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
            <p className="text-xs text-slate-500">
              Approving lists the doctor publicly, enables home visits, and activates
              Sunday consult slots if configured. Interviews are not recorded on
              ZindagiCare — only your final decision is saved.
            </p>
          </div>
      )}

      {isApproved && (
        <p className="text-sm text-slate-500">
          This doctor is already approved and live on the platform.
        </p>
      )}
    </div>
  );
}
