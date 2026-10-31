import { PageSection } from "@/components/layout/page-section";
import { siteConfig } from "@/config/site";
import { getServerTranslations } from "@/i18n/server";
import { CONSULT_PROVIDER_ROLES } from "@/features/marketing/data/consult-provider-roles";
import { nurseProfilePath } from "@/lib/nurses/profile-path";
import { physiotherapistProfilePath } from "@/lib/physiotherapists/profile-path";
import { PublicConsultProviderService } from "@/server/services/public-consult-provider.service";
import { PublicNurseService, type PublicNurse } from "@/server/services/public-nurse.service";
import {
  PublicPhysiotherapistService,
  type PublicPhysiotherapist,
} from "@/server/services/public-physiotherapist.service";
import { CareTeamTabs, type CareTeamCard, type CareTeamGroup } from "./care-team-tabs";
import { SectionHeader } from "./section-header";

const CARDS_PER_ROLE = 6;

function staffCard(
  staff: PublicNurse | PublicPhysiotherapist,
  href: string,
  fallbackSpecialty: string,
  locationTemplate: string,
): CareTeamCard {
  return {
    key: staff.id,
    href,
    name: staff.name,
    specialty: staff.specialties[0] ?? fallbackSpecialty,
    location: locationTemplate.replace(
      "{place}",
      [staff.area, staff.city].filter(Boolean).join(", "),
    ),
    rating: staff.ratingAvg ?? 0,
    reviews: staff.reviewCount ?? 0,
    fee: staff.homeVisitFee,
    imageUrl: staff.avatarUrl,
    credentials: staff.qualification ? [staff.qualification] : [],
  };
}

/**
 * Landing-page showcase of the non-doctor providers (doctors have their own section above).
 * Each role's tab shows its top listed profiles; roles with nobody listed yet are hidden.
 */
export async function CareTeamSection() {
  const { t } = await getServerTranslations();
  const [nurses, physios, herbalists, nutritionists] = await Promise.all([
    PublicNurseService.list(),
    PublicPhysiotherapistService.list(),
    PublicConsultProviderService.list("herbalist", { limit: CARDS_PER_ROLE }),
    PublicConsultProviderService.list("nutritionist", { limit: CARDS_PER_ROLE }),
  ]);

  const viewAll = (role: string) => t.careTeam.viewAll.replace("{role}", role.toLowerCase());

  const consultGroup = (
    role: "herbalist" | "nutritionist",
    label: string,
    rows: typeof herbalists,
  ): CareTeamGroup => {
    const config = CONSULT_PROVIDER_ROLES[role];
    return {
      id: role,
      label,
      viewAllHref: config.directoryPath,
      viewAllLabel: viewAll(label),
      cards: rows.map((p) => ({
        key: p.id,
        href: config.profilePath(p.slug, p.id),
        name: p.name,
        specialty: p.specialties[0] ?? config.title,
        location: t.careTeam.onlineConsultsIn.replace("{place}", p.city),
        rating: p.ratingAvg ?? 0,
        reviews: p.reviewCount,
        fee: p.consultationFee,
        imageUrl: p.avatarUrl,
        credentials: p.degree ? [p.degree] : [],
      })),
    };
  };

  // Physiotherapists come first so theirs is the tab selected by default.
  const groups: CareTeamGroup[] = [
    {
      id: "physiotherapists",
      label: t.nav.physiotherapists,
      viewAllHref: siteConfig.links.physiotherapists,
      viewAllLabel: viewAll(t.nav.physiotherapists),
      cards: physios
        .slice(0, CARDS_PER_ROLE)
        .map((p) =>
          staffCard(
            p,
            physiotherapistProfilePath(p.slug, p.id),
            "Physiotherapist",
            t.careTeam.homeVisitsIn,
          ),
        ),
    },
    {
      id: "nurses",
      label: t.nav.nurses,
      viewAllHref: siteConfig.links.nurses,
      viewAllLabel: viewAll(t.nav.nurses),
      cards: nurses
        .slice(0, CARDS_PER_ROLE)
        .map((n) =>
          staffCard(n, nurseProfilePath(n.slug, n.id), "Nurse", t.careTeam.homeVisitsIn),
        ),
    },
    consultGroup("herbalist", t.nav.herbalists, herbalists),
    consultGroup("nutritionist", t.nav.nutritionists, nutritionists),
  ].filter((group) => group.cards.length > 0);

  if (groups.length === 0) return null;

  return (
    <PageSection variant="brand" spacing="lg" flipBlur>
      <SectionHeader
        eyebrow={t.careTeam.eyebrow}
        title={t.careTeam.title}
        description={t.careTeam.description}
      />
      <CareTeamTabs groups={groups} verifiedLabel={t.careTeam.verified} />
    </PageSection>
  );
}
