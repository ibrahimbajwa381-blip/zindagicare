import Link from "next/link";
import {
  Activity,
  Award,
  BadgeCheck,
  Briefcase,
  GraduationCap,
  Home,
  Languages,
  MapPin,
  Stethoscope,
  Video,
  type LucideIcon,
} from "lucide-react";
import { HOME_CARE_MATCH_RADIUS_KM, HOME_CARE_PRICING, HomeVisitServiceTypes } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { PhysiotherapistAvatar } from "@/features/physiotherapist/components/physiotherapist-avatar";
import {
  PortfolioAwardList,
  PortfolioCertificationList,
  PortfolioEducationList,
  PortfolioExperienceTimeline,
  PortfolioTagList,
} from "@/features/physiotherapist/components/portfolio/portfolio-views";
import { surfaceCard, surfaceCardInteractive } from "@/lib/ui/surfaces";
import type { PublicPhysiotherapist } from "@/server/services/public-physiotherapist.service";

export function physiotherapistHomeVisitHref(physioId: string) {
  return `${siteConfig.links.homeCareRequest}?service=${HomeVisitServiceTypes.PHYSIOTHERAPY}&physio=${physioId}`;
}

function ProfileSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`p-6 ${surfaceCard}`}>
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Icon className="h-5 w-5 text-brand" />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function PhysiotherapistProfileView({ physio }: { physio: PublicPhysiotherapist }) {
  const homeVisitPrice = HOME_CARE_PRICING[HomeVisitServiceTypes.PHYSIOTHERAPY];
  const takesHomeVisits = physio.homeVisitEnabled && physio.isAvailable;
  const portfolio = physio.portfolio;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="space-y-6">
        <Link
          href="/physiotherapists"
          className="inline-flex text-sm font-medium text-brand hover:text-brand-dark"
        >
          ← All physiotherapists
        </Link>

        <div className={`overflow-hidden ${surfaceCardInteractive}`}>
          <div className="bg-gradient-to-br from-brand-muted/80 via-white to-accent-muted/40 p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <PhysiotherapistAvatar
                name={physio.name}
                avatarUrl={physio.avatarUrl}
                size="xl"
                className="h-28 w-28 rounded-3xl ring-4"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start gap-2">
                  <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">
                    {physio.name}
                  </h1>
                  <Badge
                    variant="secondary"
                    className="gap-1 border-brand-light/50 bg-white/80 text-brand-muted-foreground"
                  >
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified physiotherapist
                  </Badge>
                </div>
                {physio.headline && (
                  <p className="mt-1 text-base font-medium text-slate-700">{physio.headline}</p>
                )}
                {physio.specialties.length > 0 && (
                  <p className="mt-1 text-base text-brand/90">{physio.specialties.join(" · ")}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                  {physio.qualification && (
                    <span className="inline-flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4 text-brand" />
                      {physio.qualification}
                    </span>
                  )}
                  {physio.experienceYears ? (
                    <span>{physio.experienceYears}+ years experience</span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-brand" />
                    {[physio.area, physio.city].filter(Boolean).join(", ")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {physio.bio && (
          <section className={`p-6 ${surfaceCard}`}>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Activity className="h-5 w-5 text-brand" />
              About
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              {physio.bio}
            </p>
          </section>
        )}

        {physio.specialties.length > 0 && (
          <section className={`p-6 ${surfaceCard}`}>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <GraduationCap className="h-5 w-5 text-brand" />
              Specialties
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {physio.specialties.map((s) => (
                <Badge key={s} variant="outline" className="border-slate-200 bg-white/80 text-slate-700">
                  {s}
                </Badge>
              ))}
            </div>
          </section>
        )}

        {portfolio && (portfolio.conditionsTreated.length > 0 || portfolio.techniques.length > 0) && (
          <ProfileSection icon={Stethoscope} title="Conditions & techniques">
            <div className="space-y-4">
              {portfolio.conditionsTreated.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Conditions treated
                  </p>
                  <PortfolioTagList tags={portfolio.conditionsTreated} />
                </div>
              )}
              {portfolio.techniques.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Techniques
                  </p>
                  <PortfolioTagList tags={portfolio.techniques} />
                </div>
              )}
            </div>
          </ProfileSection>
        )}

        {portfolio && portfolio.experience.length > 0 && (
          <ProfileSection icon={Briefcase} title="Experience">
            <PortfolioExperienceTimeline items={portfolio.experience} />
          </ProfileSection>
        )}

        {portfolio && portfolio.education.length > 0 && (
          <ProfileSection icon={GraduationCap} title="Education">
            <PortfolioEducationList items={portfolio.education} />
          </ProfileSection>
        )}

        {portfolio && portfolio.certifications.length > 0 && (
          <ProfileSection icon={BadgeCheck} title="Certifications & training">
            <PortfolioCertificationList items={portfolio.certifications} />
          </ProfileSection>
        )}

        {portfolio && (portfolio.awards.length > 0 || portfolio.memberships.length > 0) && (
          <ProfileSection icon={Award} title="Awards & memberships">
            <div className="space-y-4">
              {portfolio.awards.length > 0 && <PortfolioAwardList items={portfolio.awards} />}
              {portfolio.memberships.length > 0 && <PortfolioTagList tags={portfolio.memberships} />}
            </div>
          </ProfileSection>
        )}


        <ProfileSection icon={Languages} title="Languages">
          <p className="text-sm text-slate-600">{physio.languages.join(", ")}</p>
        </ProfileSection>
      </div>

      <aside className={`space-y-4 p-6 ${surfaceCard} lg:sticky lg:top-24`}>
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Home className="h-4 w-4 text-brand" />
            Home physiotherapy visit
          </p>
          <p className="mt-1 text-2xl font-semibold text-brand-dark">
            Rs. {homeVisitPrice.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Covers patients within {HOME_CARE_MATCH_RADIUS_KM} km of {physio.area ?? physio.city}.
          </p>
        </div>
        {takesHomeVisits ? (
          <Button className="w-full" asChild>
            <Link href={physiotherapistHomeVisitHref(physio.id)}>Book home visit</Link>
          </Button>
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Not taking home visits right now.{" "}
            <Link
              href={`${siteConfig.links.homeCareRequest}?service=${HomeVisitServiceTypes.PHYSIOTHERAPY}`}
              className="font-medium underline"
            >
              Book the nearest available physiotherapist
            </Link>
            .
          </p>
        )}

        <div className="border-t border-slate-100 pt-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Video className="h-4 w-4 text-brand" />
            Online video consultation
          </p>
          <p className="mt-1 text-xs text-slate-500">Coming soon for physiotherapists.</p>
        </div>
      </aside>
    </div>
  );
}
