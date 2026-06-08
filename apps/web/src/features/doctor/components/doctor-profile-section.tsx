"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { VerificationStatuses } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDayOfWeek,
  type DoctorProfileDto,
} from "@/features/doctor/types";
import { surfaceCard } from "@/lib/ui/surfaces";

type Props = {
  profile: DoctorProfileDto;
  showResubmitLink?: boolean;
};

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function StatusBanner({
  profile,
  showResubmitLink,
}: {
  profile: DoctorProfileDto;
  showResubmitLink: boolean;
}) {
  if (profile.verificationStatus === VerificationStatuses.APPROVED) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-medium">Your profile is live</p>
        <p className="mt-1">
          Patients can find you under{" "}
          <strong>{profile.specialties.join(", ")}</strong>
          {profile.sundayConsult.enabled
            ? " and book free Sunday consultation slots."
            : " for consultations."}
        </p>
      </div>
    );
  }

  if (profile.verificationStatus === VerificationStatuses.PENDING) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Profile pending admin approval</p>
        <p className="mt-1">
          Your application has been submitted. An admin will review your credentials
          and documents. Your profile will go live once approved — you cannot edit
          details while under review.
        </p>
        {profile.verificationSubmittedAt && (
          <p className="mt-2 text-xs text-amber-800">
            Submitted{" "}
            {new Date(profile.verificationSubmittedAt).toLocaleString("en-PK", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        )}
      </div>
    );
  }

  if (profile.verificationStatus === VerificationStatuses.REJECTED) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-medium">Application rejected</p>
        <p className="mt-1">
          {profile.rejectionReason ??
            "Your application was not approved. Please update your details and resubmit."}
        </p>
        {showResubmitLink && (
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link href="/doctor/verification">Update & resubmit</Link>
          </Button>
        )}
      </div>
    );
  }

  return null;
}

export function DoctorProfileSection({ profile, showResubmitLink = true }: Props) {
  const { update } = useSession();

  async function refreshSession() {
    if (profile.verificationStatus === VerificationStatuses.APPROVED) {
      await update({
        doctorVerificationStatus: VerificationStatuses.APPROVED,
        onboardingCompleted: true,
      });
    }
  }

  return (
    <div className="space-y-6">
      <StatusBanner profile={profile} showResubmitLink={showResubmitLink} />

      {profile.verificationStatus === VerificationStatuses.APPROVED && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={refreshSession}>
            Refresh session status
          </Button>
        </div>
      )}

      <Card className={surfaceCard}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{profile.user.name}</CardTitle>
              <p className="text-sm text-slate-600">
                {profile.medicalDegree} · PMDC {profile.pmdcNumber}
              </p>
            </div>
            <VerificationBadge status={profile.verificationStatus} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <ProfileGrid profile={profile} />

          {profile.sundayConsult.enabled && (
            <section>
              <h3 className="mb-2 font-semibold text-slate-900">
                Sunday free consultation
              </h3>
              <p className="text-slate-600">
                {formatTime12h(profile.sundayConsult.startTimeLocal!)} –{" "}
                {formatTime12h(profile.sundayConsult.endTimeLocal!)} ·{" "}
                {profile.sundayConsult.slotDurationMins} min slots
                {profile.verificationStatus === VerificationStatuses.APPROVED
                  ? " (live on Sunday consult page)"
                  : " (will go live after approval)"}
              </p>
            </section>
          )}

          {profile.verificationStatus === VerificationStatuses.APPROVED &&
            profile.slug && (
              <section>
                <h3 className="mb-2 font-semibold text-slate-900">Public listing</h3>
                <div className="text-slate-600">
                  <span>Listed under </span>
                  {profile.specialties.map((s) => (
                    <Badge key={s} variant="secondary" className="mr-1">
                      {s}
                    </Badge>
                  ))}
                </div>
              </section>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

export function DoctorProfileDetail({
  profile,
  showDocuments = false,
}: {
  profile: DoctorProfileDto;
  showDocuments?: boolean;
}) {
  return (
    <div className="space-y-4 text-sm">
      <ProfileGrid profile={profile} showCnic />

      {profile.sundayConsult.enabled && (
        <section>
          <h4 className="font-semibold text-slate-900">Sunday free consultation</h4>
          <p className="text-slate-600">
            {formatTime12h(profile.sundayConsult.startTimeLocal!)} –{" "}
            {formatTime12h(profile.sundayConsult.endTimeLocal!)} ·{" "}
            {profile.sundayConsult.slotDurationMins} min slots (
            {profile.sundayConsult.maxSlots ?? "—"} max)
          </p>
        </section>
      )}

      {showDocuments && (
        <section>
          <h4 className="mb-2 font-semibold text-slate-900">Documents</h4>
          <ul className="space-y-1">
            <DocumentLink label="PMDC certificate" url={profile.documents.pmdcCertificate} />
            <DocumentLink label="CNIC front" url={profile.documents.cnicFront} />
            <DocumentLink label="CNIC back" url={profile.documents.cnicBack} />
            <DocumentLink
              label="Degree certificate"
              url={profile.documents.degreeCertificate}
            />
          </ul>
        </section>
      )}
    </div>
  );
}

function ProfileGrid({
  profile,
  showCnic = false,
}: {
  profile: DoctorProfileDto;
  showCnic?: boolean;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <InfoItem label="Specialty" value={profile.specialties.join(", ")} />
        <InfoItem label="Experience" value={`${profile.experienceYears} years`} />
        <InfoItem label="Medical college" value={profile.medicalCollege ?? "—"} />
        <InfoItem label="Graduation" value={String(profile.graduationYear ?? "—")} />
        <InfoItem label="Consultation fee" value={`PKR ${profile.consultationFee}`} />
        {showCnic && profile.cnicLast4 && (
          <InfoItem label="CNIC" value={`*****-${profile.cnicLast4}`} />
        )}
        <InfoItem label="Email" value={profile.user.email ?? "—"} />
        <InfoItem label="Phone" value={profile.user.phone ?? "—"} />
      </div>

      {profile.bio && (
        <section>
          <h3 className="mb-1 font-semibold text-slate-900">Bio</h3>
          <p className="text-slate-600">{profile.bio}</p>
        </section>
      )}

      {profile.hospitals.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold text-slate-900">Practice locations</h3>
          <ul className="space-y-1 text-slate-600">
            {profile.hospitals.map((h) => (
              <li key={`${h.name}-${h.city}`}>
                {h.name}, {h.city}
                {h.address ? ` — ${h.address}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile.weeklyAvailability.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold text-slate-900">Weekly availability</h3>
          <ul className="space-y-1 text-slate-600">
            {profile.weeklyAvailability.map((slot) => (
              <li key={`${slot.dayOfWeek}-${slot.startTimeLocal}`}>
                {formatDayOfWeek(slot.dayOfWeek)}:{" "}
                {formatTime12h(slot.startTimeLocal)} –{" "}
                {formatTime12h(slot.endTimeLocal)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="text-slate-900">{value}</p>
    </div>
  );
}

function DocumentLink({ label, url }: { label: string; url?: string }) {
  if (!url) return null;
  return (
    <li>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand hover:underline"
      >
        {label}
      </a>
    </li>
  );
}

function VerificationBadge({ status }: { status: string }) {
  if (status === VerificationStatuses.APPROVED) {
    return <Badge>Approved · Live</Badge>;
  }
  if (status === VerificationStatuses.REJECTED) {
    return <Badge variant="outline">Rejected</Badge>;
  }
  return <Badge variant="secondary">Pending review</Badge>;
}
