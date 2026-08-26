import { HerbalistDashboardHero } from "@/features/herbalist/components/herbalist-dashboard-hero";
import { HerbalistProfileSection } from "@/features/herbalist/components/herbalist-profile-section";
import type { HerbalistDashboardSummary } from "@/server/services/herbalist-dashboard.service";
import type { HerbalistProfileDto } from "@/server/services/herbalist-profile.service";

type Props = {
  profile: HerbalistProfileDto;
  summary: HerbalistDashboardSummary | null;
};

/** Overview page body — hero stats when approved, verification status otherwise. */
export function HerbalistWorkspacePanels({ profile, summary }: Props) {
  return (
    <div className="space-y-8">
      {summary && (
        <HerbalistDashboardHero
          name={profile.user.name}
          avatarUrl={profile.user.avatarUrl}
          primarySpecialty={profile.primarySpecialty}
          summary={summary}
        />
      )}
      <HerbalistProfileSection profile={profile} />
    </div>
  );
}
