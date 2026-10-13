import { auth } from "@/lib/auth";
import { VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { ConsultProviderPublicProfileCard } from "@/features/consult-provider/components/consult-provider-public-profile-card";
import { ProviderReviewsCard } from "@/features/consult-provider/components/provider-reviews-card";
import { HerbalistDashboardHero } from "@/features/herbalist/components/herbalist-dashboard-hero";
import { HerbalistProfileOverview } from "@/features/herbalist/components/herbalist-profile-overview";
import { HerbalistProfileSection } from "@/features/herbalist/components/herbalist-profile-section";
import { herbalistProfilePath } from "@/lib/herbalists/profile-path";
import { getHerbalistDashboardSummary } from "@/server/services/herbalist-dashboard.service";
import { getHerbalistProfile } from "@/server/services/herbalist-profile.service";
import { PublicConsultProviderService } from "@/server/services/public-consult-provider.service";
import { ReviewService } from "@/server/services/review.service";

export const metadata = { title: "Herbalist workspace" };

export default async function HerbalistProfilePage() {
  const session = await auth();

  if (!session?.user) redirect("/login?callbackUrl=/herbalist/profile");
  if (!session.user.roles?.includes("herbalist")) redirect("/onboarding");

  const profile = await getHerbalistProfile(session.user.id);
  const isApproved = profile.verification.status === VerificationStatuses.APPROVED;
  const hasSubmitted = Boolean(profile.verification.submittedAt);

  if (!hasSubmitted && !isApproved) {
    redirect("/herbalist/verification");
  }

  if (!isApproved) {
    return (
      <div className="space-y-6">
        <HerbalistProfileSection profile={profile} />
      </div>
    );
  }

  const [summary, reviews, rating] = await Promise.all([
    getHerbalistDashboardSummary(session.user.id),
    ReviewService.listDoctorReviews(profile.id, { limit: 5 }),
    PublicConsultProviderService.getRating(profile.id),
  ]);
  const publicPath =
    profile.isListed && profile.slug ? herbalistProfilePath(profile.slug, profile.id) : null;

  return (
    <div className="space-y-6">
      <HerbalistDashboardHero
        name={profile.user.name}
        avatarUrl={profile.user.avatarUrl}
        primarySpecialty={profile.primarySpecialty}
        summary={summary}
      />
      <ConsultProviderPublicProfileCard
        role="herbalist"
        name={profile.user.name}
        avatarUrl={profile.user.avatarUrl}
        specialties={profile.specialties}
        bio={profile.bio}
        degree={profile.degree}
        qualifications={profile.qualifications}
        experienceYears={profile.experienceYears}
        consultationFee={profile.consultationFee}
        city={profile.clinics[0]?.city ?? profile.coverageCities[0] ?? "Pakistan"}
        clinicCount={profile.clinics.length}
        availabilityWindowCount={profile.weeklyAvailability.length}
        publicPath={publicPath}
        editHref="/herbalist/profile/edit"
      />
      <ProviderReviewsCard
        reviews={reviews.reviews}
        total={rating.total}
        ratingAvg={rating.ratingAvg}
        publicPath={publicPath}
        emptyText="No reviews yet. Patients can rate you after a completed consultation."
      />
      <HerbalistProfileOverview profile={profile} />
    </div>
  );
}
