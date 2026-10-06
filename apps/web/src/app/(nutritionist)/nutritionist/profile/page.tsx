import { auth } from "@/lib/auth";
import { VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { ConsultProviderPublicProfileCard } from "@/features/consult-provider/components/consult-provider-public-profile-card";
import { ProviderReviewsCard } from "@/features/consult-provider/components/provider-reviews-card";
import { NutritionistDashboardHero } from "@/features/nutritionist/components/nutritionist-dashboard-hero";
import { NutritionistProfileOverview } from "@/features/nutritionist/components/nutritionist-profile-overview";
import { NutritionistProfileSection } from "@/features/nutritionist/components/nutritionist-profile-section";
import { nutritionistProfilePath } from "@/lib/nutritionists/profile-path";
import { getNutritionistDashboardSummary } from "@/server/services/nutritionist-dashboard.service";
import { getNutritionistProfile } from "@/server/services/nutritionist-profile.service";
import { PublicConsultProviderService } from "@/server/services/public-consult-provider.service";
import { ReviewService } from "@/server/services/review.service";

export const metadata = { title: "Nutritionist workspace" };

export default async function NutritionistProfilePage() {
  const session = await auth();

  if (!session?.user) redirect("/login?callbackUrl=/nutritionist/profile");
  if (!session.user.roles?.includes("nutritionist")) redirect("/onboarding");

  const profile = await getNutritionistProfile(session.user.id);
  const isApproved = profile.verification.status === VerificationStatuses.APPROVED;
  const hasSubmitted = Boolean(profile.verification.submittedAt);

  if (!hasSubmitted && !isApproved) {
    redirect("/nutritionist/verification");
  }

  if (!isApproved) {
    return (
      <div className="space-y-6">
        <NutritionistProfileSection profile={profile} />
      </div>
    );
  }

  const [summary, reviews, rating] = await Promise.all([
    getNutritionistDashboardSummary(session.user.id),
    ReviewService.listDoctorReviews(profile.id, { limit: 5 }),
    PublicConsultProviderService.getRating(profile.id),
  ]);
  const publicPath =
    profile.isListed && profile.slug ? nutritionistProfilePath(profile.slug, profile.id) : null;

  return (
    <div className="space-y-6">
      <NutritionistDashboardHero
        name={profile.user.name}
        avatarUrl={profile.user.avatarUrl}
        primarySpecialty={profile.primarySpecialty}
        summary={summary}
      />
      <ConsultProviderPublicProfileCard
        role="nutritionist"
        name={profile.user.name}
        avatarUrl={profile.user.avatarUrl}
        specialties={profile.specialties}
        bio={profile.bio}
        degree={profile.degree}
        qualifications={profile.qualifications}
        experienceYears={profile.experienceYears}
        consultationFee={profile.consultationFee}
        city={profile.clinics[0]?.city ?? profile.coverageCities[0] ?? "Lahore"}
        clinicCount={profile.clinics.length}
        availabilityWindowCount={profile.weeklyAvailability.length}
        publicPath={publicPath}
        editHref="/nutritionist/profile/edit"
      />
      <ProviderReviewsCard
        reviews={reviews.reviews}
        total={rating.total}
        ratingAvg={rating.ratingAvg}
        publicPath={publicPath}
        emptyText="No reviews yet. Patients can rate you after a completed consultation."
      />
      <NutritionistProfileOverview profile={profile} />
    </div>
  );
}
