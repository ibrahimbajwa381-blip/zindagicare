import Link from "next/link";
import {
  Briefcase,
  Building2,
  Check,
  Clock,
  GraduationCap,
  Languages,
  MapPin,
  MessageCircle,
  MessageSquareQuote,
  Sparkles,
  Stethoscope,
  UserRound,
  Video,
} from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { DoctorShareCardDialog } from "@/features/doctor/components/doctor-share-card-dialog";
import {
  DoctorMobileBookBar,
  DoctorWeeklyHours,
} from "@/features/marketing/components/doctor-profile-interactive";
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
  type ProfileReview,
} from "@/features/marketing/components/profile-reviews";
import { ProfileSectionNav } from "@/features/marketing/components/profile-section-nav";
import { ShareProfileButton } from "@/features/marketing/components/share-profile-button";
import {
  CONSULT_PROVIDER_ROLES,
  consultRequestWhatsAppHref,
} from "@/features/marketing/data/consult-provider-roles";
import { surfaceCard } from "@/lib/ui/surfaces";
import type { PublicConsultProvider } from "@/server/services/public-consult-provider.service";

/**
 * Public profile for herbalists and nutritionists — laid out like the doctor profile. Online
 * booking for these roles isn't live yet, so the booking card offers a WhatsApp request instead.
 */
export function ConsultProviderProfileView({
  provider,
  reviews,
  reviewTotal,
}: {
  provider: PublicConsultProvider;
  reviews: ProfileReview[];
  reviewTotal: number;
}) {
  const config = CONSULT_PROVIDER_ROLES[provider.role];
  const firstName = provider.name.split(" ")[0];
  const requestHref = consultRequestWhatsAppHref(provider.role, provider.name);
  const credentials = [provider.degree, ...provider.qualifications].filter(
    (c): c is string => Boolean(c),
  );
  const hasClinics = provider.clinics.length > 0 || provider.weeklyAvailability.length > 0;
  const hasEducation = credentials.length > 0 || Boolean(provider.institute);

  const stats: ProfileStat[] = [
    ...[
      provider.experienceYears > 0
        ? { value: `${provider.experienceYears}+`, label: "Years experience" }
        : null,
      provider.ratingAvg !== undefined && reviewTotal > 0
        ? { value: `${provider.ratingAvg.toFixed(1)} ★`, label: "Patient rating" }
        : null,
      provider.specialties.length
        ? { value: String(provider.specialties.length), label: "Specialties" }
        : null,
    ]
      .filter((s): s is ProfileStat => s !== null)
      .slice(0, 3),
    ...(provider.consultationFee > 0
      ? [
          {
            value: `Rs. ${provider.consultationFee.toLocaleString("en-PK")}`,
            label: "Per consultation",
          },
        ]
      : []),
  ];

  const facts = [
    provider.degree && { icon: GraduationCap, label: "Qualification", value: provider.degree },
    provider.experienceYears > 0 && {
      icon: Briefcase,
      label: "Experience",
      value: `${provider.experienceYears}+ years in practice`,
    },
    { icon: MapPin, label: "Based in", value: provider.city },
    provider.languages.length > 0 && {
      icon: Languages,
      label: "Languages",
      value: provider.languages.join(", "),
    },
  ].filter((f): f is { icon: typeof MapPin; label: string; value: string } => Boolean(f));

  const nav = [
    { id: "about", label: "About", show: true },
    { id: "focus", label: "Expertise", show: provider.specialties.length > 0 },
    { id: "clinics", label: "Clinics & hours", show: hasClinics },
    { id: "education", label: "Education", show: hasEducation },
    { id: "reviews", label: "Reviews", show: true },
    { id: "book", label: "Consult", show: true },
  ].filter((item) => item.show);

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={config.directoryPath}
          className="inline-flex min-w-0 truncate text-sm font-medium text-brand hover:text-brand-dark"
        >
          ← All {config.nounPlural}
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <ShareProfileButton
            className="whitespace-nowrap"
            doctorName={provider.name}
            shareLabel="Share profile"
            copiedLabel="Link copied"
          />
          <DoctorShareCardDialog
            triggerLabel="Share card"
            shareText={`Consult ${provider.name} online on ${siteConfig.name}`}
            card={{
              name: provider.name,
              avatarUrl: provider.avatarUrl,
              specialty: provider.specialties.join(" · ") || config.title,
              qualifications: credentials,
              location: `Online consultations · ${provider.city}`,
              experienceYears: provider.experienceYears || undefined,
              consultationFee: provider.consultationFee,
              feeLabel: "per consultation",
              pmdcVerified: true,
              profileUrl: `${siteConfig.url}${config.profilePath(provider.slug, provider.id)}`,
            }}
          />
        </div>
      </div>

      <ProfileHero
        name={provider.name}
        avatarUrl={provider.avatarUrl}
        verifiedLabel={`Verified ${config.noun}`}
        eyebrow={provider.specialties[0] ?? config.title}
        credentials={credentials}
        meta={[
          { icon: MapPin, label: provider.city },
          ...(provider.videoConsultEnabled ? [{ icon: Video, label: "Online video consults" }] : []),
          ...(provider.languages.length
            ? [{ icon: Languages, label: provider.languages.join(", ") }]
            : []),
        ]}
        stats={stats}
        actions={
          <>
            <a href="#book" className={heroPrimaryAction}>
              <Video className="h-4 w-4" />
              Request consultation
            </a>
            <a href="#about" className={heroSecondaryAction}>
              View profile
            </a>
          </>
        }
      />

      <ProfileSectionNav items={nav} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-6">
          <PortfolioSection id="about" icon={UserRound} eyebrow="Introduction" title={`About ${firstName}`}>
            <div className="space-y-6">
              <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">
                {provider.bio ?? config.aboutFallback(provider.name, provider.city)}
              </p>
              <PortfolioFacts items={facts} />
            </div>
          </PortfolioSection>

          {provider.specialties.length > 0 && (
            <PortfolioSection id="focus" icon={Stethoscope} eyebrow="What I help with" title="Areas of expertise">
              <div className="grid gap-3 sm:grid-cols-2">
                {provider.specialties.map((s) => (
                  <div
                    key={s}
                    className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-brand-muted to-accent-muted/60 px-4 py-3.5"
                  >
                    <Sparkles className="h-4 w-4 shrink-0 text-brand" />
                    <span className="font-semibold text-slate-800">{s}</span>
                  </div>
                ))}
              </div>
            </PortfolioSection>
          )}

          {hasClinics && (
            <PortfolioSection id="clinics" icon={Building2} eyebrow="Where & when" title="Clinics & hours">
              <div className="grid gap-5 md:grid-cols-2">
                {provider.clinics.length > 0 && (
                  <ul className="space-y-3">
                    {provider.clinics.map((clinic) => {
                      const mapQuery = encodeURIComponent(
                        [clinic.name, clinic.address, clinic.area, clinic.city, "Pakistan"].filter(Boolean).join(", "),
                      );
                      return (
                        <li
                          key={`${clinic.name}-${clinic.city}`}
                          className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm"
                        >
                          <p className="font-medium text-slate-900">{clinic.name}</p>
                          <p className="text-slate-500">
                            {clinic.area ? `${clinic.area}, ` : ""}
                            {clinic.city}
                            {clinic.address ? ` · ${clinic.address}` : ""}
                          </p>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                          >
                            <MapPin className="h-3 w-3" />
                            Get directions
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {provider.weeklyAvailability.length > 0 && (
                  <div className={cn(provider.clinics.length === 0 && "md:col-span-2")}>
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-800">
                      <Clock className="h-4 w-4 text-brand" />
                      Consultation hours
                    </p>
                    <DoctorWeeklyHours windows={provider.weeklyAvailability} />
                  </div>
                )}
              </div>
            </PortfolioSection>
          )}

          {hasEducation && (
            <PortfolioSection id="education" icon={GraduationCap} eyebrow="Academics" title="Education">
              <div className="space-y-4">
                {credentials.length > 0 && (
                  <div>
                    <PortfolioSubHeading>Qualifications</PortfolioSubHeading>
                    <div className="flex flex-wrap gap-2">
                      {credentials.map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-brand-muted px-3 py-1 text-sm font-medium text-brand-dark"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {provider.institute && (
                  <p className="text-sm text-slate-700">
                    {provider.institute}
                    {provider.graduationYear ? ` · ${provider.graduationYear}` : ""}
                  </p>
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
              provider.ratingAvg !== undefined && reviewTotal > 0 ? (
                <RatingSummary ratingAvg={provider.ratingAvg} total={reviewTotal} />
              ) : undefined
            }
          >
            <ProfileReviewList
              reviews={reviews}
              emptyText={`No reviews yet. Patients can rate ${firstName} after a completed consultation.`}
            />
          </PortfolioSection>
        </div>

        <aside id="book" className="scroll-mt-36 space-y-4 lg:sticky lg:top-[var(--profile-sticky-top,9rem)] lg:transition-[top] lg:duration-300 lg:ease-in-out">
          <div className={`overflow-hidden ${surfaceCard}`}>
            <div className="bg-gradient-to-br from-brand to-accent px-6 py-5 text-white">
              <p className="flex items-center gap-2 text-sm font-semibold text-white/90">
                <Video className="h-4 w-4" />
                Online video consultation
              </p>
              {provider.consultationFee > 0 && (
                <p className="mt-1 font-display text-3xl font-semibold">
                  Rs. {provider.consultationFee.toLocaleString("en-PK")}
                  <span className="ml-1 text-sm font-medium text-white/75">/ consultation</span>
                </p>
              )}
            </div>
            <div className="space-y-5 p-6">
              <ul className="space-y-2.5 text-sm text-slate-700">
                {[
                  "Consult from home over secure video",
                  `Profile verified by ${siteConfig.name}`,
                  "Chat with your provider after the consultation",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-muted">
                      <Check className="h-3 w-3 text-brand" strokeWidth={3} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900">
                Instant online booking for {config.nounPlural} is coming soon. Send us a request
                and our team will schedule your consultation with {firstName}.
              </p>
              <Button className="w-full" size="lg" asChild>
                <a href={requestHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  Request on WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <ProfileClosingCta
        title={`Consult ${firstName} from home`}
        description={`${config.field} advice over secure video — no travel, no waiting room.`}
        actions={
          <a href={requestHref} target="_blank" rel="noopener noreferrer" className={heroPrimaryAction}>
            <MessageCircle className="h-4 w-4" />
            Request consultation
          </a>
        }
      />

      <DoctorMobileBookBar fee={provider.consultationFee} label="Request consultation" />
    </div>
  );
}
