import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { resolvePhysioHomeVisitFee, VerificationStatuses, Roles } from "@zindagi/shared";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { DoctorShareCardDialog } from "@/features/doctor/components/doctor-share-card-dialog";
import { PhysiotherapistPageHeader } from "@/features/physiotherapist/components/physiotherapist-page-header";
import { PhysiotherapistAvailabilityToggle } from "@/features/physiotherapist/components/physiotherapist-availability-toggle";
import { PortfolioDashboardCard } from "@/features/physiotherapist/components/portfolio/portfolio-dashboard-card";
import { physiotherapistProfilePath } from "@/lib/physiotherapists/profile-path";
import {
  getPhysiotherapistDashboardSummary,
  getPhysiotherapistProfile,
} from "@/server/services/physiotherapist.service";

export const metadata = { title: "Physiotherapist workspace" };

type Props = { searchParams: Promise<{ submitted?: string }> };

export default async function PhysiotherapistOverviewPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/physiotherapist");
  if (!session.user.roles?.includes(Roles.PHYSIOTHERAPIST)) redirect("/onboarding");

  const { submitted } = await searchParams;
  const [profile, summary] = await Promise.all([
    getPhysiotherapistProfile(session.user.id),
    getPhysiotherapistDashboardSummary(session.user.id),
  ]);

  const verification = profile.verification;
  const isApproved = verification.status === VerificationStatuses.APPROVED;
  const isRejected = verification.status === VerificationStatuses.REJECTED;
  const hasSubmitted = Boolean(verification.submittedAt);
  const publicPath =
    isApproved && profile.publicProfile.slug
      ? physiotherapistProfilePath(profile.publicProfile.slug, profile.user.id)
      : null;
  const serviceLocation = [profile.staff.serviceArea.area, profile.staff.serviceArea.city]
    .filter(Boolean)
    .join(", ");

  const stats = [
    {
      label: "Active visits",
      value: summary.activeVisits,
      description: "Assigned, en route or arrived",
      icon: ClipboardList,
    },
    {
      label: "Scheduled today",
      value: summary.upcomingToday,
      description: "Visits on today's schedule",
      icon: CalendarClock,
    },
    {
      label: "Completed this month",
      value: summary.completedThisMonth,
      description: "Visits finished since month start",
      icon: CheckCircle2,
    },
    {
      label: "Completed all-time",
      value: summary.completedTotal,
      description: "Total visits completed",
      icon: CheckCircle2,
    },
  ];

  return (
    <>
      <PhysiotherapistPageHeader
        eyebrow="Physiotherapist workspace"
        title={`Welcome, ${profile.user.name}`}
        description="Track your in-house service visits, manage your availability, and keep your service area up to date."
        actions={
          isApproved ? (
            <PhysiotherapistAvailabilityToggle initialAvailable={profile.staff.isAvailable} />
          ) : undefined
        }
      />

      {submitted === "1" && !isApproved && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <p className="font-semibold">Application submitted successfully</p>
          <p className="mt-1">
            An admin will review your credentials shortly. You will start receiving
            in-house visit assignments once your profile is approved.
          </p>
        </div>
      )}

      {!isApproved && !isRejected && !hasSubmitted && (
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Complete your verification</p>
            <p className="mt-1">
              Submit your physiotherapy registration and identity documents for admin approval.
              You cannot receive visit assignments until you are verified.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/physiotherapist/verification">
              <ShieldCheck className="h-4 w-4" />
              Start verification
            </Link>
          </Button>
        </div>
      )}

      {!isApproved && !isRejected && hasSubmitted && submitted !== "1" && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900">
          <p className="font-semibold">Application under review</p>
          <p className="mt-1">
            Your credentials are with our admin team. You will be able to receive
            in-house visit assignments once approved.
          </p>
        </div>
      )}

      {isRejected && (
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-red-800">
            <p className="font-semibold">Your application was rejected</p>
            <p className="mt-1">
              {verification.rejectionReason ?? "Please review and resubmit your credentials."}
            </p>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link href="/physiotherapist/verification">Resubmit application</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-start gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
                  <p className="text-sm font-medium text-slate-700">{stat.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{stat.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6">
        <PortfolioDashboardCard
          name={profile.user.name}
          avatarUrl={profile.user.avatarUrl}
          specialties={verification.specialties ?? []}
          portfolio={profile.portfolio}
          publicPath={publicPath}
          shareAction={
            publicPath ? (
              <DoctorShareCardDialog
                triggerLabel="Share profile card"
                shareText={`Book a home physiotherapy visit with ${profile.user.name} on ${siteConfig.name}`}
                card={{
                  name: profile.user.name,
                  avatarUrl: profile.user.avatarUrl,
                  specialty: verification.specialties?.join(" · ") || "Physiotherapist",
                  qualifications: verification.qualification ? [verification.qualification] : [],
                  location: serviceLocation ? `Home visits in ${serviceLocation}` : undefined,
                  experienceYears: verification.experienceYears,
                  consultationFee: resolvePhysioHomeVisitFee(profile.staff.homeVisitFee),
                  feeLabel: "per home visit",
                  pmdcVerified: true,
                  profileUrl: `${siteConfig.url}${publicPath}`,
                }}
              />
            ) : undefined
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Today&apos;s work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            {isApproved ? (
              <>
                <p>
                  {summary.activeVisits > 0
                    ? `You have ${summary.activeVisits} active visit${summary.activeVisits === 1 ? "" : "s"}. Update the status as you travel so patients can track you.`
                    : "No active visits right now. New requests near your service area will be assigned to you automatically while you're available."}
                </p>
                <Button asChild>
                  <Link href="/physiotherapist/visits">Go to my visits</Link>
                </Button>
              </>
            ) : (
              <p>
                Visit assignments unlock after an admin approves your verification.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Service area</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center gap-2 text-slate-700">
              <MapPin className="h-4 w-4 text-brand" />
              <span>
                {profile.staff.serviceArea.city} · {profile.staff.serviceArea.radiusKm} km
                radius
              </span>
            </div>
            <p className="text-slate-500">
              In-house service requests within this radius are matched to you when
              you&apos;re marked available.
            </p>
            <Button variant="outline" asChild>
              <Link href="/physiotherapist/profile">Edit profile & service area</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
