import { z } from "zod";
import {
  DOCTOR_PORTFOLIO_HIDEABLE_SECTIONS,
  DOCTOR_PORTFOLIO_LIMITS,
  DOCTOR_PORTFOLIO_LINK_KEYS,
  DOCTOR_PORTFOLIO_LINKS,
  isAllowedPortfolioLink,
  parseYouTubeVideoId,
  PORTFOLIO_MIN_YEAR,
  type DoctorPortfolioLinkKey,
} from "@zindagi/shared";
import {
  portfolioAwardSchema,
  portfolioCertificationSchema,
  portfolioEducationSchema,
  portfolioExperienceSchema,
} from "./staff-profile.schema";

const DL = DOCTOR_PORTFOLIO_LIMITS;

const yearSchema = z
  .number()
  .int()
  .min(PORTFOLIO_MIN_YEAR, `Year must be ${PORTFOLIO_MIN_YEAR} or later`)
  .max(new Date().getFullYear() + 1, "Year cannot be in the future")
  .optional();
const requiredText = (label: string, min: number, max: number) =>
  z.string().trim().min(min, `${label} is required`).max(max, `${label} is too long`);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

/** Free-text chips; trimmed and de-duplicated case-insensitively. */
const tagsSchema = (label: string, max: number) =>
  z
    .array(z.string().trim().min(1).max(DL.tag, `Each ${label} must be ${DL.tag} characters or fewer`))
    .max(max, `Add up to ${max} ${label}`)
    .transform((tags) => {
      const seen = new Set<string>();
      return tags.filter((tag) => {
        const key = tag.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });

export const doctorPortfolioServiceSchema = z.object({
  name: requiredText("Service name", 2, DL.serviceName),
  description: optionalText(DL.serviceDescription),
  fee: z
    .number()
    .int("Fee must be a whole number")
    .min(0, "Fee cannot be negative")
    .max(DL.serviceFee, "Fee is too high")
    .optional(),
});

export const doctorPortfolioPublicationSchema = z.object({
  title: requiredText("Publication title", 2, 300),
  publisher: optionalText(160),
  year: yearSchema,
  url: z
    .string()
    .trim()
    .max(DL.url, "Link is too long")
    .optional()
    .transform((v) => v || undefined)
    .refine((v) => !v || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), {
      message: "Publication link must be a valid http(s) URL",
    }),
});

export const doctorPortfolioFaqSchema = z.object({
  question: requiredText("Question", 5, DL.faqQuestion),
  answer: requiredText("Answer", 2, DL.faqAnswer),
});

const linkSchema = (key: DoctorPortfolioLinkKey) =>
  z
    .string()
    .trim()
    .max(DL.url, "Link is too long")
    .optional()
    .transform((v) => v || undefined)
    .refine(
      (v) => v === undefined || isAllowedPortfolioLink(key, v),
      DOCTOR_PORTFOLIO_LINKS[key].hosts
        ? `${DOCTOR_PORTFOLIO_LINKS[key].label} link must be an https:// link to ${DOCTOR_PORTFOLIO_LINKS[key].hosts![0]}`
        : "Website must be a full https:// link",
    );

export const doctorPortfolioLinksSchema = z
  .object(
    Object.fromEntries(DOCTOR_PORTFOLIO_LINK_KEYS.map((key) => [key, linkSchema(key)])) as {
      [K in DoctorPortfolioLinkKey]: ReturnType<typeof linkSchema>;
    },
  )
  .strict();

/** Empty string clears the video; anything else must be a recognisable YouTube link. */
const introVideoSchema = z
  .string()
  .trim()
  .max(DL.url, "Link is too long")
  .refine((v) => v === "" || parseYouTubeVideoId(v) !== null, "Paste a valid YouTube video link")
  .transform((v) => {
    const id = v ? parseYouTubeVideoId(v) : null;
    return id ? `https://www.youtube.com/watch?v=${id}` : "";
  });

/** PATCH body — each key is optional so a section can be saved on its own. */
export const updateDoctorPortfolioSchema = z
  .object({
    headline: z.string().trim().max(DL.headline, "Headline is too long").optional(),
    bio: z.string().trim().max(DL.bio, "About section is too long").optional(),
    approach: z.string().trim().max(DL.approach, "Approach section is too long").optional(),
    languages: tagsSchema("languages", DL.languages)
      .refine((v) => v.length > 0, "Add at least one language")
      .optional(),
    introVideoUrl: introVideoSchema.optional(),
    conditionsTreated: tagsSchema("conditions", DL.conditionsTreated).optional(),
    memberships: tagsSchema("memberships", DL.memberships).optional(),
    services: z.array(doctorPortfolioServiceSchema).max(DL.services).optional(),
    education: z.array(portfolioEducationSchema).max(DL.education).optional(),
    experience: z.array(portfolioExperienceSchema).max(DL.experience).optional(),
    certifications: z.array(portfolioCertificationSchema).max(DL.certifications).optional(),
    awards: z.array(portfolioAwardSchema).max(DL.awards).optional(),
    publications: z.array(doctorPortfolioPublicationSchema).max(DL.publications).optional(),
    faqs: z.array(doctorPortfolioFaqSchema).max(DL.faqs).optional(),
    links: doctorPortfolioLinksSchema.optional(),
    hiddenSections: z
      .array(z.enum(DOCTOR_PORTFOLIO_HIDEABLE_SECTIONS))
      .max(DOCTOR_PORTFOLIO_HIDEABLE_SECTIONS.length)
      .transform((v) => [...new Set(v)])
      .optional(),
  })
  .strict();
export type UpdateDoctorPortfolioInput = z.infer<typeof updateDoctorPortfolioSchema>;
