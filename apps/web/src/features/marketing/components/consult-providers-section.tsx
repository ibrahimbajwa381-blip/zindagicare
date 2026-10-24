import Link from "next/link";
import { ArrowRight, BadgeCheck, Leaf, Salad, Video, type LucideIcon } from "lucide-react";
import { PageSection } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";
import { getServerTranslations } from "@/i18n/server";
import { HerbalistAvatar } from "@/features/herbalist/components/herbalist-avatar";
import { NutritionistAvatar } from "@/features/nutritionist/components/nutritionist-avatar";
import {
  CONSULT_PROVIDER_ROLES,
  consultSpecialtyHref,
  type ConsultProviderRole,
} from "@/features/marketing/data/consult-provider-roles";
import { surfaceCardInteractive } from "@/lib/ui/surfaces";
import {
  PublicConsultProviderService,
  type PublicConsultProvider,
} from "@/server/services/public-consult-provider.service";
import { SectionHeader } from "./section-header";

const ROLE_VISUALS: Record<
  ConsultProviderRole,
  { icon: LucideIcon; gradient: string; Avatar: typeof HerbalistAvatar }
> = {
  herbalist: { icon: Leaf, gradient: "from-brand-dark to-brand", Avatar: HerbalistAvatar },
  nutritionist: { icon: Salad, gradient: "from-accent to-accent-dark", Avatar: NutritionistAvatar },
};

const AVATARS_SHOWN = 4;
const CHIPS_SHOWN = 4;

/**
 * Landing-page entry point to the herbalist and nutritionist directories. Unlike the care-team
 * tabs it always renders, so both services are discoverable before anyone is listed.
 */
export async function ConsultProvidersSection() {
  const { t } = await getServerTranslations();
  const copy = t.consultProviders;
  const roles: ConsultProviderRole[] = ["herbalist", "nutritionist"];
  const listed = await Promise.all(
    roles.map((role) => PublicConsultProviderService.list(role).catch(() => [])),
  );

  return (
    <PageSection id="herbal-nutrition" variant="soft" spacing="default" flipBlur>
      <SectionHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <div className="mt-6 grid gap-4 sm:mt-10 sm:gap-6 lg:grid-cols-2">
        {roles.map((role, i) => (
          <RoleCard
            key={role}
            role={role}
            providers={listed[i]}
            copy={copy[role]}
            popularLabel={copy.popular}
            countLabel={copy.verifiedCount}
            onboardingLabel={copy.onboarding}
            roleLabel={role === "herbalist" ? t.nav.herbalists : t.nav.nutritionists}
          />
        ))}
      </div>
    </PageSection>
  );
}

function RoleCard({
  role,
  providers,
  copy,
  popularLabel,
  countLabel,
  onboardingLabel,
  roleLabel,
}: {
  role: ConsultProviderRole;
  providers: PublicConsultProvider[];
  copy: { title: string; description: string; cta: string; join: string };
  popularLabel: string;
  countLabel: string;
  onboardingLabel: string;
  roleLabel: string;
}) {
  const config = CONSULT_PROVIDER_ROLES[role];
  const { icon: Icon, gradient, Avatar } = ROLE_VISUALS[role];

  return (
    <article className={`flex flex-col p-5 sm:p-7 ${surfaceCardInteractive}`}>
      <div className="flex items-start gap-4">
        <span
          className={`inline-flex shrink-0 rounded-xl bg-gradient-to-br ${gradient} p-2.5 text-white shadow-sm`}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold text-foreground sm:text-xl">
            {copy.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{copy.description}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500">{popularLabel}</span>
        {config.popularSpecialties.slice(0, CHIPS_SHOWN).map((s) => (
          <Link
            key={s}
            href={consultSpecialtyHref(role, s)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-brand/40 hover:text-brand-dark"
          >
            {s}
          </Link>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-xl border border-brand/15 bg-brand-muted/40 px-3 py-2.5">
        {providers.length > 0 ? (
          <>
            <div className="flex -space-x-2">
              {providers.slice(0, AVATARS_SHOWN).map((p) => (
                <Avatar
                  key={p.id}
                  name={p.name}
                  avatarUrl={p.avatarUrl}
                  size="sm"
                  className="ring-2 ring-white"
                />
              ))}
            </div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-brand-dark">
              <BadgeCheck className="h-4 w-4 shrink-0" />
              {countLabel
                .replace("{count}", String(providers.length))
                .replace("{role}", roleLabel.toLowerCase())}
            </p>
          </>
        ) : (
          <p className="flex items-center gap-1.5 text-sm font-medium text-brand-dark">
            <Video className="h-4 w-4 shrink-0" />
            {onboardingLabel}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2.5 sm:mt-auto sm:flex-row sm:items-center sm:pt-6">
        <Button className="group h-11 w-full rounded-xl sm:w-auto" asChild>
          <Link href={config.directoryPath}>
            {copy.cta}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
        <Button variant="ghost" className="h-11 w-full rounded-xl text-brand-dark sm:w-auto" asChild>
          <Link href={config.registerPath}>{copy.join}</Link>
        </Button>
      </div>
    </article>
  );
}
