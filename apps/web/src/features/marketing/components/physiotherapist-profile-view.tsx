import Link from "next/link";
import {
  Award,
  BadgeCheck,
  Briefcase,
  CalendarCheck,
  Check,
  GraduationCap,
  Home,
  Languages,
  MapPin,
  Sparkles,
  Stethoscope,
  UserRound,
  Video,
} from "lucide-react";
import { HOME_CARE_MATCH_RADIUS_KM, HOME_CARE_PRICING, HomeVisitServiceTypes } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { DoctorShareCardDialog } from "@/features/doctor/components/doctor-share-card-dialog";
import { DoctorMobileBookBar } from "@/features/marketing/components/doctor-profile-interactive";
import {
  PortfolioFacts,
  PortfolioSection,
  PortfolioSubHeading,
  ProfileClosingCta,
  ProfileHero,
  heroPrimaryAction,
  heroSecondaryAction,
  type ProfileStat,
} from "@/features/marketing/components/profile-portfolio";
import { ProfileSectionNav } from "@/features/marketing/components/profile-section-nav";
import { ShareProfileButton } from "@/features/marketing/components/share-profile-button";
import {
  PortfolioAwardList,
  PortfolioCertificationList,
  PortfolioEducationList,
  PortfolioExperienceTimeline,
  PortfolioTagList,
} from "@/features/physiotherapist/components/portfolio/portfolio-views";
import { physiotherapistProfilePath } from "@/lib/physiotherapists/profile-path";
import { surfaceCard } from "@/lib/ui/surfaces";
import type { PublicPhysiotherapist } from "@/server/services/public-physiotherapist.service";

export function physiotherapistHomeVisitHref(physioId: string) {
  return `${siteConfig.links.homeCareRequest}?service=${HomeVisitServiceTypes.PHYSIOTHERAPY}&physio=${physioId}`;
}

export function PhysiotherapistProfileView({ physio }: { physio: PublicPhysiotherapist }) {
  const homeVisitPrice = HOME_CARE_PRICING[HomeVisitServiceTypes.PHYSIOTHERAPY];
  const takesHomeVisits = physio.homeVisitEnabled && physio.isAvailable;
  const bookHref = takesHomeVisits
    ? physiotherapistHomeVisitHref(physio.id)
    : `${siteConfig.links.homeCareRequest}?service=${HomeVisitServiceTypes.PHYSIOTHERAPY}`;
  const location = [physio.area, physio.city].filter(Boolean).join(", ");
  const firstName = physio.name.split(" ")[0];

  const portfolio = physio.portfolio;
  const conditions = portfolio?.conditionsTreated ?? [];
  const techniques = portfolio?.techniques ?? [];
  const experience = portfolio?.experience ?? [];
  const education = portfolio?.education ?? [];
  const certifications = portfolio?.certifications ?? [];
  const awards = portfolio?.awards ?? [];
  const memberships = portfolio?.memberships ?? [];

  const hasFocus = physio.specialties.length > 0 || conditions.length > 0 || techniques.length > 0;
  const hasRecognition = awards.length > 0 || memberships.length > 0;

  const stats: ProfileStat[] = [
    physio.experienceYears ? { value: `${physio.experienceYears}+`, label: "Years experience" } : null,
    conditions.length ? { value: String(conditions.length), label: "Conditions treated" } : null,
    certifications.length
      ? { value: String(certifications.length), label: "Certifications" }
      : physio.specialties.length
        ? { value: String(physio.specialties.length), label: "Specialties" }
        : null,
    { value: `Rs. ${homeVisitPrice.toLocaleString("en-PK")}`, label: "Home visit" },
  ].filter((s): s is ProfileStat => s !== null);

  const facts = [
    physio.qualification && { icon: GraduationCap, label: "Qualification", value: physio.qualification },
    physio.experienceYears && {
      icon: Briefcase,
      label: "Experience",
      value: `${physio.experienceYears}+ years in practice`,
    },
    location && { icon: MapPin, label: "Based in", value: location },
    physio.languages.length > 0 && {
      icon: Languages,
      label: "Languages",
      value: physio.languages.join(", "),
    },
  ].filter((f): f is { icon: typeof MapPin; label: string; value: string } => Boolean(f));

  const nav = [
    { id: "about", label: "About", show: true },
    { id: "focus", label: "Expertise", show: hasFocus },
    { id: "experience", label: "Experience", show: experience.length > 0 },
    { id: "education", label: "Education", show: education.length > 0 },
    { id: "certifications", label: "Certifications", show: certifications.length > 0 },
    { id: "recognition", label: "Awards", show: hasRecognition },
    { id: "book", label: "Book a visit", show: true },
  ].filter((item) => item.show);

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/physiotherapists"
          className="inline-flex min-w-0 truncate text-sm font-medium text-brand hover:text-brand-dark"
        >
          ← All physiotherapists
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <ShareProfileButton
            className="whitespace-nowrap"
            doctorName={physio.name}
            shareLabel="Share profile"
            copiedLabel="Link copied"
          />
          <DoctorShareCardDialog
            triggerLabel="Share card"
            shareText={`Book a home physiotherapy visit with ${physio.name} on ${siteConfig.name}`}
            card={{
              name: physio.name,
              avatarUrl: physio.avatarUrl,
              specialty: physio.specialties.join(" · ") || "Physiotherapist",
              qualifications: physio.qualification ? [physio.qualification] : [],
              location: location ? `Home visits in ${location}` : undefined,
              experienceYears: physio.experienceYears,
              consultationFee: homeVisitPrice,
              feeLabel: "per home visit",
              pmdcVerified: true,
              profileUrl: `${siteConfig.url}${physiotherapistProfilePath(physio.slug, physio.id)}`,
            }}
          />
        </div>
      </div>

      <ProfileHero
        name={physio.name}
        avatarUrl={physio.avatarUrl}
        verifiedLabel="Verified physiotherapist"
        eyebrow={physio.specialties[0] ?? "Physiotherapist"}
        credentials={physio.qualification ? [physio.qualification] : []}
        headline={physio.headline}
        meta={[
          ...(location ? [{ icon: MapPin, label: location }] : []),
          ...(takesHomeVisits ? [{ icon: Home, label: "Home visits available" }] : []),
          ...(physio.languages.length ? [{ icon: Languages, label: physio.languages.join(", ") }] : []),
        ]}
        stats={stats}
        actions={
          <>
            <Link href={bookHref} className={heroPrimaryAction}>
              <CalendarCheck className="h-4 w-4" />
              {takesHomeVisits ? "Book home visit" : "Book a physiotherapist"}
            </Link>
            <a href="#about" className={heroSecondaryAction}>
              View portfolio
            </a>
          </>
        }
      />

      <ProfileSectionNav items={nav} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-6">
          <PortfolioSection id="about" icon={UserRound} eyebrow="Introduction" title={`About ${firstName}`}>
            <div className="space-y-6">
              {physio.bio ? (
                <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">{physio.bio}</p>
              ) : (
                <p className="text-[15px] leading-7 text-slate-700">
                  {physio.name} is a verified physiotherapist
                  {location ? ` based in ${location}` : ""}, offering physiotherapy at home through{" "}
                  {siteConfig.name}.
                </p>
              )}
              <PortfolioFacts items={facts} />
            </div>
          </PortfolioSection>

          {hasFocus && (
            <PortfolioSection id="focus" icon={Stethoscope} eyebrow="What I treat" title="Areas of expertise">
              <div className="space-y-6">
                {physio.specialties.length > 0 && (
                  <div>
                    <PortfolioSubHeading>Specialties</PortfolioSubHeading>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {physio.specialties.map((s) => (
                        <div
                          key={s}
                          className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-brand-muted to-accent-muted/60 px-4 py-3.5"
                        >
                          <Sparkles className="h-4 w-4 shrink-0 text-brand" />
                          <span className="font-semibold text-slate-800">{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {conditions.length > 0 && (
                  <div>
                    <PortfolioSubHeading>Conditions treated</PortfolioSubHeading>
                    <PortfolioTagList tags={conditions} variant="check" />
                  </div>
                )}
                {techniques.length > 0 && (
                  <div>
                    <PortfolioSubHeading>Techniques & modalities</PortfolioSubHeading>
                    <PortfolioTagList tags={techniques} />
                  </div>
                )}
              </div>
            </PortfolioSection>
          )}

          {experience.length > 0 && (
            <PortfolioSection id="experience" icon={Briefcase} eyebrow="Career" title="Work experience">
              <PortfolioExperienceTimeline items={experience} />
            </PortfolioSection>
          )}

          {education.length > 0 && (
            <PortfolioSection id="education" icon={GraduationCap} eyebrow="Academics" title="Education">
              <PortfolioEducationList items={education} />
            </PortfolioSection>
          )}

          {certifications.length > 0 && (
            <PortfolioSection
              id="certifications"
              icon={BadgeCheck}
              eyebrow="Continuing education"
              title="Certifications & training"
            >
              <PortfolioCertificationList items={certifications} />
            </PortfolioSection>
          )}

          {hasRecognition && (
            <PortfolioSection id="recognition" icon={Award} eyebrow="Recognition" title="Awards & memberships">
              <div className="space-y-6">
                {awards.length > 0 && <PortfolioAwardList items={awards} />}
                {memberships.length > 0 && (
                  <div>
                    <PortfolioSubHeading>Professional memberships</PortfolioSubHeading>
                    <PortfolioTagList tags={memberships} />
                  </div>
                )}
              </div>
            </PortfolioSection>
          )}
        </div>

        <aside id="book" className="scroll-mt-36 space-y-4 lg:sticky lg:top-[var(--profile-sticky-top,9rem)] lg:transition-[top] lg:duration-300 lg:ease-in-out">
          <div className={`overflow-hidden ${surfaceCard}`}>
            <div className="bg-gradient-to-br from-brand to-accent px-6 py-5 text-white">
              <p className="flex items-center gap-2 text-sm font-semibold text-white/90">
                <Home className="h-4 w-4" />
                Home physiotherapy visit
              </p>
              <p className="mt-1 font-display text-3xl font-semibold">
                Rs. {homeVisitPrice.toLocaleString("en-PK")}
                <span className="ml-1 text-sm font-medium text-white/75">/ session</span>
              </p>
            </div>
            <div className="space-y-5 p-6">
              <ul className="space-y-2.5 text-sm text-slate-700">
                {[
                  `${firstName} comes to your home — no travel, no waiting room`,
                  `Covers patients within ${HOME_CARE_MATCH_RADIUS_KM} km of ${physio.area ?? physio.city}`,
                  `Profile verified by ${siteConfig.name}`,
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-muted">
                      <Check className="h-3 w-3 text-brand" strokeWidth={3} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>

              {takesHomeVisits ? (
                <>
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Accepting home visits
                  </p>
                  <Button className="w-full" size="lg" asChild>
                    <Link href={bookHref}>
                      <CalendarCheck className="h-4 w-4" />
                      Book home visit
                    </Link>
                  </Button>
                </>
              ) : (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  Not taking home visits right now.{" "}
                  <Link href={bookHref} className="font-medium underline">
                    Book the nearest available physiotherapist
                  </Link>
                  .
                </p>
              )}
            </div>
          </div>

          <div className={`p-5 ${surfaceCard}`}>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Video className="h-4 w-4 text-brand" />
              Online video consultation
            </p>
            <p className="mt-1 text-xs text-slate-500">Coming soon for physiotherapists.</p>
          </div>
        </aside>
      </div>

      <ProfileClosingCta
        title={`Start your recovery with ${firstName}`}
        description={`Personalised physiotherapy in the comfort of your home${
          location ? ` across ${location}` : ""
        }. Book a visit in a few taps.`}
        actions={
          <Link href={bookHref} className={heroPrimaryAction}>
            <CalendarCheck className="h-4 w-4" />
            {takesHomeVisits ? "Book home visit" : "Book a physiotherapist"}
          </Link>
        }
      />

      <DoctorMobileBookBar
        fee={homeVisitPrice}
        label={takesHomeVisits ? "Book home visit" : "Book a physiotherapist"}
      />
    </div>
  );
}
