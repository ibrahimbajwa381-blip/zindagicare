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
  MessageSquareQuote,
  Sparkles,
  Stethoscope,
  UserRound,
  Video,
} from "lucide-react";
import { HOME_CARE_MATCH_RADIUS_KM, HomeVisitServiceTypes } from "@zindagi/shared";
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
import {
  ProfileReviewList,
  RatingSummary,
} from "@/features/marketing/components/profile-reviews";
import { ProfileSectionNav } from "@/features/marketing/components/profile-section-nav";
import { ShareProfileButton } from "@/features/marketing/components/share-profile-button";
import {
  PortfolioAwardList,
  PortfolioCertificationList,
  PortfolioEducationList,
  PortfolioExperienceTimeline,
  PortfolioTagList,
} from "@/features/physiotherapist/components/portfolio/portfolio-views";
import { nurseProfilePath } from "@/lib/nurses/profile-path";
import { surfaceCard } from "@/lib/ui/surfaces";
import type { StaffReviewSummary } from "@/server/services/home-visit-review.service";
import type { PublicNurse } from "@/server/services/public-nurse.service";

export function nurseHomeVisitHref(nurseId: string) {
  return `${siteConfig.links.homeCareRequest}?service=${HomeVisitServiceTypes.NURSE}&nurse=${nurseId}`;
}

export function NurseProfileView({
  nurse,
  reviews,
}: {
  nurse: PublicNurse;
  reviews: StaffReviewSummary;
}) {
  const homeVisitPrice = nurse.homeVisitFee;
  const takesHomeVisits = nurse.homeVisitEnabled && nurse.isAvailable;
  // Not taking visits → a general nursing request matched to the nearest available nurse.
  const bookHref = takesHomeVisits
    ? nurseHomeVisitHref(nurse.id)
    : `${siteConfig.links.homeCareRequest}?service=${HomeVisitServiceTypes.NURSE}`;
  const location = [nurse.area, nurse.city].filter(Boolean).join(", ");
  const firstName = nurse.name.split(" ")[0];

  const portfolio = nurse.portfolio;
  const conditions = portfolio?.conditionsTreated ?? [];
  const techniques = portfolio?.techniques ?? [];
  const experience = portfolio?.experience ?? [];
  const education = portfolio?.education ?? [];
  const certifications = portfolio?.certifications ?? [];
  const awards = portfolio?.awards ?? [];
  const memberships = portfolio?.memberships ?? [];

  const hasFocus = nurse.specialties.length > 0 || conditions.length > 0 || techniques.length > 0;
  const hasRecognition = awards.length > 0 || memberships.length > 0;

  // The hero shows at most four stats — keep the home-visit fee as the last one.
  const stats: ProfileStat[] = [
    ...[
      nurse.experienceYears ? { value: `${nurse.experienceYears}+`, label: "Years experience" } : null,
      reviews.total > 0 ? { value: `${reviews.ratingAvg.toFixed(1)} ★`, label: "Patient rating" } : null,
      conditions.length ? { value: String(conditions.length), label: "Care areas" } : null,
      certifications.length
        ? { value: String(certifications.length), label: "Certifications" }
        : nurse.specialties.length
          ? { value: String(nurse.specialties.length), label: "Specialties" }
          : null,
    ]
      .filter((s): s is ProfileStat => s !== null)
      .slice(0, 3),
    { value: `Rs. ${homeVisitPrice.toLocaleString("en-PK")}`, label: "Home visit" },
  ];

  const facts = [
    nurse.qualification && { icon: GraduationCap, label: "Qualification", value: nurse.qualification },
    nurse.experienceYears && {
      icon: Briefcase,
      label: "Experience",
      value: `${nurse.experienceYears}+ years in practice`,
    },
    location && { icon: MapPin, label: "Based in", value: location },
    nurse.languages.length > 0 && {
      icon: Languages,
      label: "Languages",
      value: nurse.languages.join(", "),
    },
  ].filter((f): f is { icon: typeof MapPin; label: string; value: string } => Boolean(f));

  const nav = [
    { id: "about", label: "About", show: true },
    { id: "focus", label: "Expertise", show: hasFocus },
    { id: "experience", label: "Experience", show: experience.length > 0 },
    { id: "education", label: "Education", show: education.length > 0 },
    { id: "certifications", label: "Certifications", show: certifications.length > 0 },
    { id: "recognition", label: "Awards", show: hasRecognition },
    { id: "reviews", label: "Reviews", show: true },
    { id: "book", label: "Book a visit", show: true },
  ].filter((item) => item.show);

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/nurses"
          className="inline-flex min-w-0 truncate text-sm font-medium text-brand hover:text-brand-dark"
        >
          ← All nurses
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <ShareProfileButton
            className="whitespace-nowrap"
            doctorName={nurse.name}
            shareLabel="Share profile"
            copiedLabel="Link copied"
          />
          <DoctorShareCardDialog
            triggerLabel="Share card"
            shareText={`Book a home nursing visit with ${nurse.name} on ${siteConfig.name}`}
            card={{
              name: nurse.name,
              avatarUrl: nurse.avatarUrl,
              specialty: nurse.specialties.join(" · ") || "Nurse",
              qualifications: nurse.qualification ? [nurse.qualification] : [],
              location: location ? `Home visits in ${location}` : undefined,
              experienceYears: nurse.experienceYears,
              consultationFee: homeVisitPrice,
              feeLabel: "per home visit",
              pmdcVerified: true,
              profileUrl: `${siteConfig.url}${nurseProfilePath(nurse.slug, nurse.id)}`,
            }}
          />
        </div>
      </div>

      <ProfileHero
        name={nurse.name}
        avatarUrl={nurse.avatarUrl}
        verifiedLabel="Verified nurse"
        eyebrow={nurse.specialties[0] ?? "Nurse"}
        credentials={nurse.qualification ? [nurse.qualification] : []}
        headline={nurse.headline}
        meta={[
          ...(location ? [{ icon: MapPin, label: location }] : []),
          ...(takesHomeVisits ? [{ icon: Home, label: "Home visits available" }] : []),
          ...(nurse.languages.length ? [{ icon: Languages, label: nurse.languages.join(", ") }] : []),
        ]}
        stats={stats}
        actions={
          <>
            <Link href={bookHref} className={heroPrimaryAction}>
              <CalendarCheck className="h-4 w-4" />
              {takesHomeVisits ? "Book home visit" : "Book a nurse"}
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
              {nurse.bio ? (
                <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">{nurse.bio}</p>
              ) : (
                <p className="text-[15px] leading-7 text-slate-700">
                  {nurse.name} is a verified nurse
                  {location ? ` based in ${location}` : ""}, offering nursing at home through{" "}
                  {siteConfig.name}.
                </p>
              )}
              <PortfolioFacts items={facts} />
            </div>
          </PortfolioSection>

          {hasFocus && (
            <PortfolioSection id="focus" icon={Stethoscope} eyebrow="What I do" title="Areas of expertise">
              <div className="space-y-6">
                {nurse.specialties.length > 0 && (
                  <div>
                    <PortfolioSubHeading>Specialties</PortfolioSubHeading>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {nurse.specialties.map((s) => (
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
                    <PortfolioSubHeading>Care provided</PortfolioSubHeading>
                    <PortfolioTagList tags={conditions} variant="check" />
                  </div>
                )}
                {techniques.length > 0 && (
                  <div>
                    <PortfolioSubHeading>Clinical skills</PortfolioSubHeading>
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

          <PortfolioSection
            id="reviews"
            icon={MessageSquareQuote}
            eyebrow="Patient feedback"
            title="Patient reviews"
            aside={
              reviews.total > 0 ? (
                <RatingSummary ratingAvg={reviews.ratingAvg} total={reviews.total} />
              ) : undefined
            }
          >
            <ProfileReviewList
              reviews={reviews.reviews}
              emptyText={`No reviews yet. Patients can rate ${firstName} after a completed home visit.`}
            />
          </PortfolioSection>
        </div>

        <aside id="book" className="scroll-mt-36 space-y-4 lg:sticky lg:top-[var(--profile-sticky-top,9rem)] lg:transition-[top] lg:duration-300 lg:ease-in-out">
          <div className={`overflow-hidden ${surfaceCard}`}>
            <div className="bg-gradient-to-br from-brand to-accent px-6 py-5 text-white">
              <p className="flex items-center gap-2 text-sm font-semibold text-white/90">
                <Home className="h-4 w-4" />
                Home nursing visit
              </p>
              <p className="mt-1 font-display text-3xl font-semibold">
                Rs. {homeVisitPrice.toLocaleString("en-PK")}
                <span className="ml-1 text-sm font-medium text-white/75">/ visit</span>
              </p>
            </div>
            <div className="space-y-5 p-6">
              <ul className="space-y-2.5 text-sm text-slate-700">
                {[
                  `${firstName} comes to your home — no travel, no waiting room`,
                  `Usually visits within ${HOME_CARE_MATCH_RADIUS_KM} km of ${nurse.area ?? nurse.city} — farther visits can be booked; travel and extra charges may need confirming`,
                  `Profile verified by ${siteConfig.name}`,
                  "IV drips, injections and wound care are billed at standard rates",
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
                    Book the nearest available nurse
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
            <p className="mt-1 text-xs text-slate-500">Coming soon for nurses.</p>
          </div>
        </aside>
      </div>

      <ProfileClosingCta
        title={`Get care at home with ${firstName}`}
        description={`Personalised nursing in the comfort of your home${
          location ? ` across ${location}` : ""
        }. Book a visit in a few taps.`}
        actions={
          <Link href={bookHref} className={heroPrimaryAction}>
            <CalendarCheck className="h-4 w-4" />
            {takesHomeVisits ? "Book home visit" : "Book a nurse"}
          </Link>
        }
      />

      <DoctorMobileBookBar
        fee={homeVisitPrice}
        label={takesHomeVisits ? "Book home visit" : "Book a nurse"}
      />
    </div>
  );
}
