/**
 * Physiotherapist portfolio shape + completeness scoring. Pure (no server imports) so the
 * workspace editor, dashboard card, and public profile all score and render identically.
 */

export type PortfolioEducation = { degree: string; institute: string; year?: number };
export type PortfolioExperience = {
  role: string;
  organization: string;
  city?: string;
  startYear?: number;
  endYear?: number;
  current: boolean;
  description?: string;
};
export type PortfolioCertification = { title: string; issuer?: string; year?: number };
export type PortfolioAward = { title: string; year?: number };

export type PhysiotherapistPortfolio = {
  headline?: string;
  bio?: string;
  languages: string[];
  conditionsTreated: string[];
  techniques: string[];
  memberships: string[];
  education: PortfolioEducation[];
  experience: PortfolioExperience[];
  certifications: PortfolioCertification[];
  awards: PortfolioAward[];
  updatedAt?: string;
};

/** Loose input: accepts lean docs, hydrated Mongoose subdocuments, and nulls alike. */
type RawList = readonly unknown[] | null | undefined;
type RawPortfolio = {
  headline?: string | null;
  conditionsTreated?: RawList;
  techniques?: RawList;
  memberships?: RawList;
  education?: RawList;
  experience?: RawList;
  certifications?: RawList;
  awards?: RawList;
  updatedAt?: Date | string | null;
};

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const year = (value: unknown) => (typeof value === "number" ? value : undefined);
const strings = (value: RawList): string[] =>
  Array.isArray(value) ? value.map(text).filter((v): v is string => Boolean(v)) : [];
const records = (value: RawList): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    : [];

/** Normalizes the raw StaffProfile fields (lean doc or hydrated) into the DTO shape. */
export function mapPhysiotherapistPortfolio(staff: {
  bio?: string | null;
  languages?: RawList;
  portfolio?: RawPortfolio | null;
}): PhysiotherapistPortfolio {
  const p = staff.portfolio ?? {};
  const updatedAt = p.updatedAt ? new Date(p.updatedAt).toISOString() : undefined;

  return {
    headline: text(p.headline),
    bio: text(staff.bio),
    languages: strings(staff.languages),
    conditionsTreated: strings(p.conditionsTreated),
    techniques: strings(p.techniques),
    memberships: strings(p.memberships),
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
      .map((c) => ({ title: text(c.title)!, issuer: text(c.issuer), year: year(c.year) })),
    awards: records(p.awards)
      .filter((a) => text(a.title))
      .map((a) => ({ title: text(a.title)!, year: year(a.year) })),
    updatedAt,
  };
}

export type PortfolioSectionId =
  | "photo"
  | "about"
  | "focus"
  | "experience"
  | "education"
  | "certifications"
  | "recognition";

export type PortfolioChecklistItem = {
  id: PortfolioSectionId;
  label: string;
  hint: string;
  done: boolean;
};

const MIN_BIO_CHARS = 100;

/**
 * Ordered by patient impact — the dashboard surfaces the first few missing items as
 * "next steps". Awards/memberships are a bonus and not required for 100%.
 */
export function portfolioChecklist(
  portfolio: PhysiotherapistPortfolio,
  avatarUrl?: string,
): PortfolioChecklistItem[] {
  return [
    {
      id: "photo",
      label: "Profile photo",
      hint: "A clear, friendly headshot builds instant trust.",
      done: Boolean(avatarUrl),
    },
    {
      id: "about",
      label: "Headline & about you",
      hint: `A one-line headline and at least ${MIN_BIO_CHARS} characters about your approach.`,
      done: Boolean(portfolio.headline) && (portfolio.bio?.length ?? 0) >= MIN_BIO_CHARS,
    },
    {
      id: "focus",
      label: "Conditions & techniques",
      hint: "Patients search by problem — list at least 3 conditions you treat.",
      done: portfolio.conditionsTreated.length >= 3 && portfolio.techniques.length > 0,
    },
    {
      id: "experience",
      label: "Work experience",
      hint: "Hospitals, clinics or teams you've worked with.",
      done: portfolio.experience.length > 0,
    },
    {
      id: "education",
      label: "Education",
      hint: "Your DPT / BSPT and any post-graduate degrees.",
      done: portfolio.education.length > 0,
    },
    {
      id: "certifications",
      label: "Certifications & training",
      hint: "Courses like dry needling, manual therapy or taping.",
      done: portfolio.certifications.length > 0,
    },
  ];
}

export function portfolioCompleteness(items: PortfolioChecklistItem[]): number {
  if (!items.length) return 0;
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}

/** "2019 – Present", "2016 – 2019", "2020", or "" when no years are known. */
export function formatExperienceYears(item: PortfolioExperience): string {
  const end = item.current ? "Present" : item.endYear?.toString();
  if (item.startYear && end) return `${item.startYear} – ${end}`;
  return item.startYear?.toString() ?? end ?? "";
}
