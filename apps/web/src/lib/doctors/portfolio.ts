/**
 * Doctor portfolio shape + completeness scoring. Pure (no server imports) so the workspace
 * editor, dashboard card, and public profile all score and render identically.
 */
import {
  DOCTOR_PORTFOLIO_HIDEABLE_SECTIONS,
  DOCTOR_PORTFOLIO_LINK_KEYS,
  isAllowedPortfolioLink,
  parseYouTubeVideoId,
  type DoctorPortfolioHideableSection,
  type DoctorPortfolioLinkKey,
} from "@zindagi/shared";
import type {
  PortfolioAward,
  PortfolioCertification,
  PortfolioEducation,
  PortfolioExperience,
} from "@/lib/physiotherapists/portfolio";

export type { PortfolioAward, PortfolioCertification, PortfolioEducation, PortfolioExperience };
export { formatExperienceYears } from "@/lib/physiotherapists/portfolio";

export type DoctorPortfolioService = { name: string; description?: string; fee?: number };
export type DoctorPortfolioPublication = {
  title: string;
  publisher?: string;
  year?: number;
  url?: string;
};
export type DoctorPortfolioFaq = { question: string; answer: string };
export type DoctorPortfolioLinks = Partial<Record<DoctorPortfolioLinkKey, string>>;

export type DoctorPortfolio = {
  headline?: string;
  bio?: string;
  approach?: string;
  languages: string[];
  introVideoUrl?: string;
  conditionsTreated: string[];
  memberships: string[];
  services: DoctorPortfolioService[];
  education: PortfolioEducation[];
  experience: PortfolioExperience[];
  certifications: PortfolioCertification[];
  awards: PortfolioAward[];
  publications: DoctorPortfolioPublication[];
  faqs: DoctorPortfolioFaq[];
  links: DoctorPortfolioLinks;
  hiddenSections: DoctorPortfolioHideableSection[];
  updatedAt?: string;
};

/** Loose input: accepts lean docs, hydrated Mongoose subdocuments, and nulls alike. */
type RawList = readonly unknown[] | null | undefined;
type RawPortfolio = {
  headline?: string | null;
  approach?: string | null;
  introVideoUrl?: string | null;
  conditionsTreated?: RawList;
  memberships?: RawList;
  services?: RawList;
  education?: RawList;
  experience?: RawList;
  certifications?: RawList;
  awards?: RawList;
  publications?: RawList;
  faqs?: RawList;
  links?: Record<string, unknown> | null;
  hiddenSections?: RawList;
  updatedAt?: Date | string | null;
};

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const year = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const strings = (value: RawList): string[] =>
  Array.isArray(value) ? value.map(text).filter((v): v is string => Boolean(v)) : [];
const records = (value: RawList): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    : [];
/** Certificate / publication pages may be plain http (older registries), but never other schemes. */
const safeHttpUrl = (value: unknown) => {
  const url = text(value);
  if (!url) return undefined;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
};

/** Normalizes the raw DoctorProfile fields (lean doc or hydrated) into the DTO shape. */
export function mapDoctorPortfolio(doctor: {
  bio?: string | null;
  languages?: RawList;
  portfolio?: RawPortfolio | null;
}): DoctorPortfolio {
  const p = doctor.portfolio ?? {};
  const updatedAt = p.updatedAt ? new Date(p.updatedAt).toISOString() : undefined;
  const rawLinks = p.links && typeof p.links === "object" ? p.links : {};
  const links: DoctorPortfolioLinks = {};
  for (const key of DOCTOR_PORTFOLIO_LINK_KEYS) {
    const url = text(rawLinks[key]);
    if (url && isAllowedPortfolioLink(key, url)) links[key] = url;
  }
  const hideable = new Set<string>(DOCTOR_PORTFOLIO_HIDEABLE_SECTIONS);
  const video = text(p.introVideoUrl);

  return {
    headline: text(p.headline),
    bio: text(doctor.bio),
    approach: text(p.approach),
    languages: strings(doctor.languages),
    introVideoUrl: video && parseYouTubeVideoId(video) ? video : undefined,
    conditionsTreated: strings(p.conditionsTreated),
    memberships: strings(p.memberships),
    services: records(p.services)
      .filter((s) => text(s.name))
      .map((s) => ({
        name: text(s.name)!,
        description: text(s.description),
        fee: typeof s.fee === "number" && s.fee >= 0 ? s.fee : undefined,
      })),
    education: records(p.education)
      .filter((e) => text(e.degree))
      .map((e) => ({ degree: text(e.degree)!, institute: text(e.institute) ?? "", year: year(e.year) })),
    experience: records(p.experience)
      .filter((e) => text(e.role))
      .map((e) => ({
        role: text(e.role)!,
        organization: text(e.organization) ?? "",
        city: text(e.city),
        startYear: year(e.startYear),
        endYear: e.current ? undefined : year(e.endYear),
        current: Boolean(e.current),
        description: text(e.description),
      })),
    certifications: records(p.certifications)
      .filter((c) => text(c.title))
      .map((c) => ({
        title: text(c.title)!,
        issuer: text(c.issuer),
        year: year(c.year),
        url: safeHttpUrl(c.url),
      })),
    awards: records(p.awards)
      .filter((a) => text(a.title))
      .map((a) => ({ title: text(a.title)!, year: year(a.year) })),
    publications: records(p.publications)
      .filter((pub) => text(pub.title))
      .map((pub) => ({
        title: text(pub.title)!,
        publisher: text(pub.publisher),
        year: year(pub.year),
        url: safeHttpUrl(pub.url),
      })),
    faqs: records(p.faqs)
      .filter((f) => text(f.question) && text(f.answer))
      .map((f) => ({ question: text(f.question)!, answer: text(f.answer)! })),
    links,
    hiddenSections: strings(p.hiddenSections).filter(
      (s): s is DoctorPortfolioHideableSection => hideable.has(s),
    ),
    updatedAt,
  };
}

export type DoctorPortfolioSectionId =
  | "photo"
  | "about"
  | "conditions"
  | "services"
  | "experience"
  | "education"
  | "clinics";

export type DoctorPortfolioChecklistItem = {
  id: DoctorPortfolioSectionId;
  label: string;
  hint: string;
  done: boolean;
};

export const DOCTOR_PORTFOLIO_MIN_BIO_CHARS = 100;

/** Context outside the portfolio itself that still counts toward a strong public page. */
export type DoctorPortfolioContext = {
  avatarUrl?: string;
  hospitalCount: number;
  weeklySlotCount: number;
};

/**
 * Ordered by patient impact — the dashboard surfaces the first few missing items as
 * "next steps". Video, publications, awards, FAQs and links are a bonus, not required for 100%.
 */
export function doctorPortfolioChecklist(
  portfolio: DoctorPortfolio,
  context: DoctorPortfolioContext,
): DoctorPortfolioChecklistItem[] {
  return [
    {
      id: "photo",
      label: "Profile photo",
      hint: "A clear, professional headshot builds instant trust.",
      done: Boolean(context.avatarUrl),
    },
    {
      id: "about",
      label: "Headline & about you",
      hint: `A one-line headline and at least ${DOCTOR_PORTFOLIO_MIN_BIO_CHARS} characters about your practice.`,
      done:
        Boolean(portfolio.headline) &&
        (portfolio.bio?.length ?? 0) >= DOCTOR_PORTFOLIO_MIN_BIO_CHARS,
    },
    {
      id: "conditions",
      label: "Conditions you treat",
      hint: "Patients search by problem — list at least 3 conditions.",
      done: portfolio.conditionsTreated.length >= 3,
    },
    {
      id: "services",
      label: "Services & procedures",
      hint: "Consultations, tests and procedures patients can come to you for.",
      done: portfolio.services.length > 0,
    },
    {
      id: "experience",
      label: "Work experience",
      hint: "Hospitals and clinics where you've practiced.",
      done: portfolio.experience.length > 0,
    },
    {
      id: "education",
      label: "Training & qualifications",
      hint: "House job, residency, fellowships and postgraduate training.",
      done: portfolio.education.length > 0,
    },
    {
      id: "clinics",
      label: "Clinic locations & hours",
      hint: "Where and when patients can see you.",
      done: context.hospitalCount > 0 && context.weeklySlotCount > 0,
    },
  ];
}

export function doctorPortfolioCompleteness(items: DoctorPortfolioChecklistItem[]): number {
  if (!items.length) return 0;
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}

export function isDoctorSectionVisible(
  portfolio: Pick<DoctorPortfolio, "hiddenSections">,
  section: DoctorPortfolioHideableSection,
): boolean {
  return !portfolio.hiddenSections.includes(section);
}

export function doctorPortfolioVideoId(portfolio: Pick<DoctorPortfolio, "introVideoUrl">) {
  return portfolio.introVideoUrl ? parseYouTubeVideoId(portfolio.introVideoUrl) : null;
}

/**
 * Public-page view of the portfolio: hidden sections are emptied on the server so their
 * content never reaches the browser.
 */
export function toPublicDoctorPortfolio(portfolio: DoctorPortfolio): DoctorPortfolio {
  const hidden = new Set(portfolio.hiddenSections);
  return {
    ...portfolio,
    introVideoUrl: hidden.has("video") ? undefined : portfolio.introVideoUrl,
    services: hidden.has("services") ? [] : portfolio.services,
    conditionsTreated: hidden.has("conditions") ? [] : portfolio.conditionsTreated,
    experience: hidden.has("experience") ? [] : portfolio.experience,
    education: hidden.has("education") ? [] : portfolio.education,
    certifications: hidden.has("certifications") ? [] : portfolio.certifications,
    awards: hidden.has("awards") ? [] : portfolio.awards,
    publications: hidden.has("publications") ? [] : portfolio.publications,
    memberships: hidden.has("memberships") ? [] : portfolio.memberships,
    faqs: hidden.has("faqs") ? [] : portfolio.faqs,
    links: hidden.has("links") ? {} : portfolio.links,
    hiddenSections: [],
  };
}
