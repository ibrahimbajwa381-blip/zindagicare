import { NutritionistDashboardHero } from "@/features/nutritionist/components/nutritionist-dashboard-hero";
import { NutritionistProfileSection } from "@/features/nutritionist/components/nutritionist-profile-section";
import type { NutritionistDashboardSummary } from "@/server/services/nutritionist-dashboard.service";
import type { NutritionistProfileDto } from "@/server/services/nutritionist-profile.service";

type Props = {
  profile: NutritionistProfileDto;
  summary: NutritionistDashboardSummary | null;
};

/** Overview page body — hero stats when approved, verification status otherwise. */
export function NutritionistWorkspacePanels({ profile, summary }: Props) {
  return (
    <div className="space-y-8">
      {summary && (
        <NutritionistDashboardHero
          name={profile.user.name}
          avatarUrl={profile.user.avatarUrl}
          primarySpecialty={profile.primarySpecialty}
          summary={summary}
        />
      )}
      <NutritionistProfileSection profile={profile} />
    </div>
  );
}
