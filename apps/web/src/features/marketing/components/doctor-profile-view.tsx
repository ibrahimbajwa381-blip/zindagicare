import Link from "next/link";
import {
  Award,
  BadgeCheck,
  BookOpen,
  Briefcase,
  CalendarCheck,
  Building2,
  ClipboardList,
  Clock,
  GraduationCap,
  HelpCircle,
  Languages,
  MapPin,
  MessageSquareQuote,
  PlayCircle,
  ShieldCheck,
  Star,
  Stethoscope,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { DoctorProfileBookingPanel } from "@/features/consult/components/doctor-profile-booking-panel";
import { DoctorShareCardDialog } from "@/features/doctor/components/doctor-share-card-dialog";
import { DoctorIntroVideo } from "@/features/doctor/components/portfolio/doctor-intro-video";
import {
  DoctorFaqList,
  DoctorLinkList,
  DoctorPublicationList,
  DoctorServiceList,
  hasDoctorLinks,
} from "@/features/doctor/components/portfolio/doctor-portfolio-views";
import {
  PortfolioAwardList,
  PortfolioCertificationList,
  PortfolioEducationList,
  PortfolioExperienceTimeline,
  PortfolioTagList,
} from "@/features/physiotherapist/components/portfolio/portfolio-views";
import {
  DoctorMobileBookBar,
  DoctorWeeklyHours,
} from "@/features/marketing/components/doctor-profile-interactive";
import {
  PortfolioFacts,
  PortfolioQuote,
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
import type {
  DoctorReviewDto,
  PublicDoctorProfile,
} from "@/features/marketing/types/doctor-public";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import { doctorPortfolioVideoId } from "@/lib/doctors/portfolio";
import { formatQualificationsList } from "@/lib/doctors/qualifications";
import {
  doctorProfilePath,
  doctorShortLinkPath,
  formatDoctorDisplayName,
} from "@/lib/doctors/profile-path";
import { cn } from "@zindagi/shared";

type Copy = {
  backToDoctors: string;
  about: string;
  education: string;
  practicesAt: string;
  languages: string;
  experience: string;
  yearsExperience: string;
  reviews: string;
  reviewsEmpty: string;
  pmdcVerified: string;
  videoConsult: string;
  perConsultation: string;
  shareProfile: string;
  linkCopied: string;
};

type Props = {
  doctor: PublicDoctorProfile;
  reviews: DoctorReviewDto[];
  reviewTotal: number;
  copy: Copy;
};

function formatReviewDate(iso: string) {
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeZone: "Asia/Karachi",
  }).format(new Date(iso));
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-200",
          )}
        />
      ))}
    </span>
  );
}

export function DoctorProfileView({ doctor, reviews, reviewTotal, copy }: Props) {
  const avatarSrc = resolveDoctorPortrait(doctor.name, doctor.avatarUrl);
  const displayName = formatDoctorDisplayName(doctor.name);
  const callbackUrl = doctorProfilePath(doctor.slug, doctor.doctorId);
  const credentialBadges = formatQualificationsList(
    doctor.medicalDegree,
    doctor.qualifications,
  );
  const portfolio = doctor.portfolio;
  const videoId = doctorPortfolioVideoId(portfolio);
  const hasCredentials = credentialBadges.length > 0 || Boolean(doctor.medicalCollege);
  const hasEducation = hasCredentials || portfolio.education.length > 0;
  const hasRecognition = portfolio.awards.length > 0 || portfolio.memberships.length > 0;
  const hasClinics = doctor.hospitals.length > 0 || doctor.weeklyAvailability.length > 0;
  const hasAbout = Boolean(doctor.bio || portfolio.approach || doctor.languages.length);

  const nav: { id: string; label: string; show: boolean }[] = [
    { id: "about", label: copy.about, show: hasAbout },
    { id: "video", label: "Video", show: Boolean(videoId) },
    { id: "services", label: "Services", show: portfolio.services.length > 0 },
    { id: "conditions", label: "Conditions", show: portfolio.conditionsTreated.length > 0 },
    { id: "clinics", label: "Clinics & hours", show: hasClinics },
    { id: "experience", label: copy.experience, show: portfolio.experience.length > 0 },
    { id: "education", label: copy.education, show: hasEducation },
    { id: "certifications", label: "Certifications", show: portfolio.certifications.length > 0 },
    { id: "publications", label: "Publications", show: portfolio.publications.length > 0 },
    { id: "recognition", label: "Awards", show: hasRecognition },
    { id: "reviews", label: copy.reviews, show: true },
    { id: "faqs", label: "FAQs", show: portfolio.faqs.length > 0 },
    { id: "book", label: "Book", show: true },
  ];
  const visibleNav = nav.filter((item) => item.show);

  const stats: ProfileStat[] = [
    doctor.experienceYears > 0
      ? { value: `${doctor.experienceYears}+`, label: copy.yearsExperience }
      : null,
    doctor.ratingCount > 0 ? { value: `${doctor.ratingAvg.toFixed(1)} ★`, label: "Patient rating" } : null,
    reviewTotal > 0 ? { value: String(reviewTotal), label: copy.reviews } : null,
    doctor.consultationFee > 0
      ? { value: `Rs. ${doctor.consultationFee.toLocaleString("en-PK")}`, label: copy.perConsultation }
      : null,
  ].filter((s): s is ProfileStat => s !== null);

  const primaryHospital = doctor.hospitals[0];
  const facts = [
    credentialBadges.length > 0 && {
      icon: GraduationCap,
      label: "Qualifications",
      value: credentialBadges.join(", "),
    },
    doctor.experienceYears > 0 && {
      icon: Briefcase,
      label: copy.experience,
      value: `${doctor.experienceYears}+ ${copy.yearsExperience}`,
    },
    primaryHospital && {
      icon: Building2,
      label: copy.practicesAt,
      value: `${primaryHospital.name}, ${primaryHospital.city}`,
    },
    doctor.languages.length > 0 && {
      icon: Languages,
      label: copy.languages,
      value: doctor.languages.join(", "),
    },
  ].filter((f): f is { icon: LucideIcon; label: string; value: string } => Boolean(f));

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/doctors"
          className="inline-flex min-w-0 truncate text-sm font-medium text-brand hover:text-brand-dark"
        >
          ← {copy.backToDoctors}
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <ShareProfileButton
            className="whitespace-nowrap"
            doctorName={displayName}
            shareLabel={copy.shareProfile}
            copiedLabel={copy.linkCopied}
          />
          <DoctorShareCardDialog
            triggerLabel="Share card"
            card={{
              name: displayName,
              avatarUrl: avatarSrc,
              specialty: doctor.specialties.join(" · "),
              qualifications: credentialBadges,
              hospital: primaryHospital?.name,
              city: primaryHospital?.city,
              experienceYears: doctor.experienceYears,
              ratingAvg: doctor.ratingAvg,
              ratingCount: doctor.ratingCount,
              consultationFee: doctor.consultationFee,
              pmdcVerified: doctor.pmdcVerified,
              profileUrl: `${siteConfig.url}${doctorShortLinkPath(doctor.slug)}`,
            }}
          />
        </div>
      </div>

      <ProfileHero
        name={displayName}
        avatarUrl={avatarSrc}
        verifiedLabel={doctor.pmdcVerified ? copy.pmdcVerified : undefined}
        eyebrow={doctor.specialties.join(" · ")}
        credentials={credentialBadges}
        headline={portfolio.headline}
        meta={[
          ...(primaryHospital
            ? [{ icon: Building2, label: `${primaryHospital.name}, ${primaryHospital.city}` }]
            : []),
          ...(doctor.videoConsultEnabled ? [{ icon: Video, label: copy.videoConsult }] : []),
          ...(doctor.languages.length
            ? [{ icon: Languages, label: doctor.languages.join(", ") }]
            : []),
        ]}
        stats={stats}
        actions={
          <>
            <a href="#book" className={heroPrimaryAction}>
              <CalendarCheck className="h-4 w-4" />
              Book consultation
            </a>
            <a href="#about" className={heroSecondaryAction}>
              View portfolio
            </a>
          </>
        }
        links={hasDoctorLinks(portfolio.links) ? <DoctorLinkList links={portfolio.links} /> : undefined}
      />

      <ProfileSectionNav items={visibleNav} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
      <div className="min-w-0 space-y-6">
        {hasAbout && (
          <PortfolioSection id="about" icon={UserRound} eyebrow="Introduction" title={copy.about}>
            <div className="space-y-6">
              {doctor.bio && (
                <p className="whitespace-pre-wrap text-[15px] leading-7 text-slate-700">
                  {doctor.bio}
                </p>
              )}
              {portfolio.approach && (
                <PortfolioQuote label="My approach to care">{portfolio.approach}</PortfolioQuote>
              )}
              <PortfolioFacts items={facts} />
            </div>
          </PortfolioSection>
        )}

        {videoId && (
          <PortfolioSection id="video" icon={PlayCircle} eyebrow="Video" title={`Meet ${displayName}`}>
            <DoctorIntroVideo videoId={videoId} title={`Introduction by ${displayName}`} />
          </PortfolioSection>
        )}

        {portfolio.services.length > 0 && (
          <PortfolioSection id="services" icon={ClipboardList} eyebrow="What I offer" title="Services & procedures">
            <DoctorServiceList items={portfolio.services} />
          </PortfolioSection>
        )}

        {portfolio.conditionsTreated.length > 0 && (
          <PortfolioSection id="conditions" icon={Stethoscope} eyebrow="What I treat" title="Conditions treated">
            <PortfolioTagList tags={portfolio.conditionsTreated} variant="check" />
          </PortfolioSection>
        )}

        {hasClinics && (
          <PortfolioSection id="clinics" icon={MapPin} eyebrow="Where to find me" title={copy.practicesAt}>
            <div className="grid gap-6 md:grid-cols-2">
              {doctor.hospitals.length > 0 && (
                <ul className="space-y-3">
                  {doctor.hospitals.map((hospital) => {
                    const mapQuery = encodeURIComponent(
                      [hospital.name, hospital.address, hospital.city, "Pakistan"]
                        .filter(Boolean)
                        .join(", "),
                    );
                    return (
                      <li
                        key={`${hospital.name}-${hospital.city}`}
                        className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm"
                      >
                        <p className="font-medium text-slate-900">{hospital.name}</p>
                        <p className="text-slate-500">
                          {hospital.city}
                          {hospital.address ? ` · ${hospital.address}` : ""}
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
              {doctor.weeklyAvailability.length > 0 && (
                <div className={cn(doctor.hospitals.length === 0 && "md:col-span-2")}>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-800">
                    <Clock className="h-4 w-4 text-brand" />
                    Consultation hours
                  </p>
                  <DoctorWeeklyHours windows={doctor.weeklyAvailability} />
                </div>
              )}
            </div>
          </PortfolioSection>
        )}

        {portfolio.experience.length > 0 && (
          <PortfolioSection id="experience" icon={Briefcase} eyebrow="Career" title={copy.experience}>
            <PortfolioExperienceTimeline items={portfolio.experience} />
          </PortfolioSection>
        )}

        {hasEducation && (
          <PortfolioSection id="education" icon={GraduationCap} eyebrow="Academics" title={copy.education}>
            <div className="space-y-5">
              {hasCredentials && (
                <div>
                  <PortfolioSubHeading>
                    <span className="inline-flex items-center gap-1 normal-case tracking-normal text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Verified by {siteConfig.name}
                    </span>
                  </PortfolioSubHeading>
                  <ul className="space-y-1 text-sm text-slate-700">
                    {credentialBadges.map((credential) => (
                      <li key={credential} className="font-medium">
                        {credential}
                      </li>
                    ))}
                    {doctor.medicalCollege && (
                      <li className="text-slate-600">
                        {doctor.medicalCollege}
                        {doctor.graduationYear ? ` · ${doctor.graduationYear}` : ""}
                      </li>
                    )}
                  </ul>
                </div>
              )}
              {portfolio.education.length > 0 && (
                <div>
                  {hasCredentials && <PortfolioSubHeading>Training & fellowships</PortfolioSubHeading>}
                  <PortfolioEducationList items={portfolio.education} />
                </div>
              )}
            </div>
          </PortfolioSection>
        )}

        {portfolio.certifications.length > 0 && (
          <PortfolioSection id="certifications" icon={BadgeCheck} eyebrow="Continuing education" title="Certifications & courses">
            <PortfolioCertificationList items={portfolio.certifications} />
          </PortfolioSection>
        )}

        {portfolio.publications.length > 0 && (
          <PortfolioSection id="publications" icon={BookOpen} eyebrow="Research" title="Publications & research">
            <DoctorPublicationList items={portfolio.publications} />
          </PortfolioSection>
        )}

        {hasRecognition && (
          <PortfolioSection id="recognition" icon={Award} eyebrow="Recognition" title="Awards & memberships">
            <div className="space-y-5">
              {portfolio.awards.length > 0 && <PortfolioAwardList items={portfolio.awards} />}
              {portfolio.memberships.length > 0 && (
                <div>
                  <PortfolioSubHeading>Professional memberships</PortfolioSubHeading>
                  <PortfolioTagList tags={portfolio.memberships} />
                </div>
              )}
            </div>
          </PortfolioSection>
        )}

        <PortfolioSection
          id="reviews"
          icon={MessageSquareQuote}
          eyebrow="Patient feedback"
          title={copy.reviews}
          aside={
            reviewTotal > 0 ? (
              <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                <RatingStars rating={doctor.ratingAvg} />
                {doctor.ratingAvg.toFixed(1)} · {reviewTotal} total
              </span>
            ) : undefined
          }
        >
          {reviews.length === 0 ? (
            <p className="text-sm text-slate-500">{copy.reviewsEmpty}</p>
          ) : (
            <ul className="space-y-4">
              {reviews.map((review) => (
                <li
                  key={review.id}
                  className="rounded-xl border border-slate-100 bg-white/80 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{review.patientName}</p>
                      <p className="text-xs text-slate-400">
                        {formatReviewDate(review.createdAt)}
                      </p>
                    </div>
                    <RatingStars rating={review.rating} />
                  </div>
                  {review.comment && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{review.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </PortfolioSection>

        {portfolio.faqs.length > 0 && (
          <PortfolioSection id="faqs" icon={HelpCircle} eyebrow="Good to know" title="Frequently asked questions">
            <DoctorFaqList items={portfolio.faqs} />
          </PortfolioSection>
        )}
      </div>

      <div id="book" className="scroll-mt-36 lg:self-stretch">
        <DoctorProfileBookingPanel doctor={doctor} callbackUrl={callbackUrl} />
      </div>
      </div>

      <ProfileClosingCta
        title={`Consult ${displayName}`}
        description={`${doctor.specialties[0] ?? "Specialist"} care${
          doctor.videoConsultEnabled ? " by secure video call or in clinic" : ""
        }. Pick a time that suits you and book in a few taps.`}
        actions={
          <a href="#book" className={heroPrimaryAction}>
            <CalendarCheck className="h-4 w-4" />
            Book consultation
          </a>
        }
      />

      <DoctorMobileBookBar fee={doctor.consultationFee} />
    </div>
  );
}
