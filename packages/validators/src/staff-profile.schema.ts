import { z } from "zod";
import {
  MAX_NURSING_SPECIALTIES,
  MAX_PHYSIOTHERAPY_SPECIALTIES,
  NURSE_HOME_VISIT_FEE_MAX,
  NURSE_HOME_VISIT_FEE_MIN,
  PHYSIO_HOME_VISIT_FEE_MAX,
  PHYSIO_HOME_VISIT_FEE_MIN,
  PHYSIOTHERAPIST_PORTFOLIO_LIMITS,
  PORTFOLIO_MIN_YEAR,
} from "@zindagi/shared";
import { geoPointInputSchema } from "./geo.schema";
import { pakistaniPhoneSchema } from "./auth.schema";

/** Profile fields every home-visit staff role (nurse, physiotherapist) can edit. */
const baseStaffProfileSchema = z.object({
  name: z.string().min(2, "Name is required").optional(),
  phone: pakistaniPhoneSchema.optional(),
  city: z.string().min(2, "City is required").optional(),
  area: z.string().min(2, "Area / neighborhood is required").optional(),
  geo: geoPointInputSchema.optional(),
  radiusKm: z
    .number()
    .min(1, "Radius must be at least 1 km")
    .max(50, "Radius cannot exceed 50 km")
    .optional(),
  homeVisitEnabled: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
});

const staffServiceAreaSchema = z
  .object({
    city: z.string().min(2, "City is required"),
    area: z.string().min(2, "Area / neighborhood is required"),
    homeVisitEnabled: z.boolean(),
    geo: geoPointInputSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.homeVisitEnabled && !data.geo) {
      ctx.addIssue({
        code: "custom",
        message: "Google Maps location is required for in-house visits",
        path: ["geo"],
      });
    }
  });

const baseStaffVerificationSchema = z.object({
  licenseNumber: z
    .string()
    .min(3, "License / registration number is required")
    .max(40, "License number is too long"),
  cnic: z
    .string()
    .regex(/^[0-9]{5}-[0-9]{7}-[0-9]$/, "CNIC must be XXXXX-XXXXXXX-X"),
  qualification: z
    .string()
    .min(2, "Qualification is required")
    .max(120, "Qualification is too long"),
  experienceYears: z.coerce.number().min(0).max(60),
  serviceArea: staffServiceAreaSchema,
  documentUrls: z.object({
    licenseCertificate: z.string().min(1, "License certificate required"),
    cnicFront: z.string().min(1, "CNIC front image required"),
    cnicBack: z.string().min(1, "CNIC back image required"),
  }),
  acceptedProviderAgreement: z.literal(true, {
    message: "You must accept the ZindagiCare Provider Agreement",
  }),
});

export const adminNurseDecisionSchema = z.object({
  staffProfileId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().max(500).optional(),
});

export type AdminNurseDecisionInput = z.infer<typeof adminNurseDecisionSchema>;

export const adminNurseNotesSchema = z.object({
  notes: z.string().max(5000),
});

export type AdminNurseNotesInput = z.infer<typeof adminNurseNotesSchema>;

const physiotherapySpecialtiesSchema = z
  .array(z.string().min(1))
  .max(MAX_PHYSIOTHERAPY_SPECIALTIES, `Select up to ${MAX_PHYSIOTHERAPY_SPECIALTIES} specialties`);

/** The per-visit fee the physiotherapist sets themselves (PKR). */
const physioHomeVisitFeeSchema = z.coerce
  .number({ message: "Enter your per-visit fee" })
  .int("Fee must be a whole number")
  .min(PHYSIO_HOME_VISIT_FEE_MIN, `Fee must be at least Rs. ${PHYSIO_HOME_VISIT_FEE_MIN}`)
  .max(PHYSIO_HOME_VISIT_FEE_MAX, `Fee can be at most Rs. ${PHYSIO_HOME_VISIT_FEE_MAX}`);

export const updatePhysiotherapistProfileSchema = baseStaffProfileSchema.extend({
  specialties: physiotherapySpecialtiesSchema.optional(),
  bio: z.string().trim().max(2000, "Bio is too long").optional(),
  languages: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  avatarUrl: z.string().min(1).max(500).optional(),
  homeVisitFee: physioHomeVisitFeeSchema.optional(),
});
export type UpdatePhysiotherapistProfileInput = z.infer<
  typeof updatePhysiotherapistProfileSchema
>;

/** Where a nurse's or physiotherapist's Sunday payouts are sent. */
const staffBankAccountSchema = z.object({
  accountTitle: z
    .string()
    .trim()
    .min(2, "Enter the account title (name on the account)")
    .max(120, "Account title is too long"),
  bankName: z
    .string()
    .trim()
    .min(2, "Enter your bank or wallet name")
    .max(120, "Bank name is too long"),
  accountNumber: z
    .string()
    .trim()
    .min(4, "Enter your account number")
    .max(40, "Account number is too long"),
  iban: z
    .string()
    .trim()
    .max(40, "IBAN is too long")
    .optional()
    .transform((value) => value || undefined),
});

export const physiotherapistBankAccountSchema = staffBankAccountSchema;
export type PhysiotherapistBankAccountInput = z.infer<
  typeof physiotherapistBankAccountSchema
>;

// A form opened before the bank section shipped sends no bankAccount at all — tell the
// provider how to get the section instead of a raw "expected object" error.
const verificationBankAccountSchema = z.object(staffBankAccountSchema.shape, {
  error: (issue) =>
    issue.input === undefined
      ? "Please add your payout bank account. Refresh this page to see the bank account section."
      : undefined,
});

export const physiotherapistVerificationSchema = baseStaffVerificationSchema.extend({
  // Physiotherapists may not hold a PPTA license yet — the degree is the mandatory credential.
  licenseNumber: z
    .string()
    .trim()
    .max(40, "License number is too long")
    .optional()
    .transform((value) => value || undefined)
    .refine((value) => value === undefined || value.length >= 3, {
      message: "License / registration number must be at least 3 characters",
    }),
  documentUrls: z.object({
    degreeCertificate: z.string().min(1, "Degree certificate required"),
    licenseCertificate: z
      .string()
      .optional()
      .transform((value) => value || undefined),
    cnicFront: z.string().min(1, "CNIC front image required"),
    cnicBack: z.string().min(1, "CNIC back image required"),
  }),
  specialties: physiotherapySpecialtiesSchema.min(1, "Select at least one specialty"),
  avatarUrl: z.string().min(1, "Profile photo is required").max(500),
  homeVisitFee: physioHomeVisitFeeSchema,
  bankAccount: verificationBankAccountSchema,
});
export type PhysiotherapistVerificationInput = z.infer<
  typeof physiotherapistVerificationSchema
>;

export const adminPhysiotherapistDecisionSchema = adminNurseDecisionSchema;
export type AdminPhysiotherapistDecisionInput = z.infer<
  typeof adminPhysiotherapistDecisionSchema
>;

export const adminPhysiotherapistNotesSchema = adminNurseNotesSchema;
export type AdminPhysiotherapistNotesInput = z.infer<
  typeof adminPhysiotherapistNotesSchema
>;

export const convertDoctorToPhysiotherapistSchema = z.object({
  doctorProfileId: z.string().min(1),
});
export type ConvertDoctorToPhysiotherapistInput = z.infer<
  typeof convertDoctorToPhysiotherapistSchema
>;

/** Admin: add an approved physiotherapist directly (skips self-onboarding). */
export const adminCreatePhysiotherapistSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  phone: pakistaniPhoneSchema.optional(),
  licenseNumber: z
    .string()
    .trim()
    .min(3, "License / registration number is required")
    .max(40, "License number is too long"),
  qualification: z.string().trim().min(2).max(120).optional(),
  experienceYears: z.coerce.number().min(0).max(60).optional(),
  specialties: physiotherapySpecialtiesSchema.min(1, "Select at least one specialty"),
  city: z.string().trim().min(2, "City is required"),
  area: z.string().trim().min(2).max(120).optional(),
  homeVisitEnabled: z.boolean().optional(),
});
export type AdminCreatePhysiotherapistInput = z.infer<
  typeof adminCreatePhysiotherapistSchema
>;

/** Admin: manage an existing physiotherapist — status, service toggles, and profile corrections. */
export const adminUpdatePhysiotherapistSchema = z
  .object({
    verificationStatus: z.enum(["approved", "rejected"]).optional(),
    rejectionReason: z.string().trim().min(3).max(500).optional(),
    isActive: z.boolean().optional(),
    isAvailable: z.boolean().optional(),
    homeVisitEnabled: z.boolean().optional(),
    commissionPercent: z.number().min(0).max(100).nullable().optional(),

    name: z.string().trim().min(2, "Name is required").max(100).optional(),
    phone: pakistaniPhoneSchema.optional(),
    city: z.string().trim().min(2, "City is required").optional(),
    area: z.string().trim().max(120).optional(),
    radiusKm: z
      .number()
      .min(1, "Radius must be at least 1 km")
      .max(50, "Radius cannot exceed 50 km")
      .optional(),
    bio: z.string().trim().max(2000, "Bio is too long").optional(),
    languages: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
    specialties: physiotherapySpecialtiesSchema.optional(),
    licenseNumber: z.string().trim().min(3).max(40).optional(),
    qualification: z.string().trim().max(120).optional(),
    experienceYears: z.coerce.number().min(0).max(60).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.verificationStatus === "rejected" && !data.rejectionReason) {
      ctx.addIssue({
        code: "custom",
        message: "A rejection reason is required",
        path: ["rejectionReason"],
      });
    }
  });
export type AdminUpdatePhysiotherapistInput = z.infer<
  typeof adminUpdatePhysiotherapistSchema
>;

const PL = PHYSIOTHERAPIST_PORTFOLIO_LIMITS;
const portfolioYearSchema = z
  .number()
  .int()
  .min(PORTFOLIO_MIN_YEAR, `Year must be ${PORTFOLIO_MIN_YEAR} or later`)
  .max(new Date().getFullYear() + 1, "Year cannot be in the future")
  .optional();
const portfolioTextSchema = (label: string, max: number) =>
  z.string().trim().min(2, `${label} is required`).max(max, `${label} is too long`);
const optionalPortfolioText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);
/** Free-text chips; trimmed and de-duplicated case-insensitively. */
const portfolioTagsSchema = (label: string, max: number) =>
  z
    .array(z.string().trim().min(1).max(PL.tag, `Each ${label} must be ${PL.tag} characters or fewer`))
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

export const portfolioEducationSchema = z.object({
  degree: portfolioTextSchema("Degree", 120),
  institute: portfolioTextSchema("Institute", 160),
  year: portfolioYearSchema,
});

export const portfolioExperienceSchema = z
  .object({
    role: portfolioTextSchema("Role", 100),
    organization: portfolioTextSchema("Hospital / clinic", 160),
    city: optionalPortfolioText(80),
    startYear: portfolioYearSchema,
    endYear: portfolioYearSchema,
    current: z.boolean().default(false),
    description: optionalPortfolioText(PL.experienceDescription),
  })
  .transform((item) => (item.current ? { ...item, endYear: undefined } : item))
  .refine(
    (item) => !item.startYear || !item.endYear || item.endYear >= item.startYear,
    { message: "End year cannot be before start year", path: ["endYear"] },
  );

export const portfolioCertificationSchema = z.object({
  title: portfolioTextSchema("Certification", 160),
  issuer: optionalPortfolioText(160),
  year: portfolioYearSchema,
  /** Public link where patients can verify the certificate (issuer's registry, credential page…). */
  url: z
    .string()
    .trim()
    .max(500, "Certificate link is too long")
    .optional()
    .transform((v) => v || undefined)
    .refine((v) => !v || /^https?:\/\/[^\s]+\.[^\s]+/i.test(v), {
      message: "Certificate link must be a valid http(s) URL",
    }),
});

export const portfolioAwardSchema = z.object({
  title: portfolioTextSchema("Award", 160),
  year: portfolioYearSchema,
});


/** PATCH body — each key is optional so a section can be saved on its own. */
export const updatePhysiotherapistPortfolioSchema = z
  .object({
    headline: z.string().trim().max(PL.headline, "Headline is too long").optional(),
    bio: z.string().trim().max(PL.bio, "About section is too long").optional(),
    languages: portfolioTagsSchema("languages", PL.languages).optional(),
    conditionsTreated: portfolioTagsSchema("conditions", PL.conditionsTreated).optional(),
    techniques: portfolioTagsSchema("techniques", PL.techniques).optional(),
    memberships: portfolioTagsSchema("memberships", PL.memberships).optional(),
    education: z.array(portfolioEducationSchema).max(PL.education).optional(),
    experience: z.array(portfolioExperienceSchema).max(PL.experience).optional(),
    certifications: z.array(portfolioCertificationSchema).max(PL.certifications).optional(),
    awards: z.array(portfolioAwardSchema).max(PL.awards).optional(),
  })
  .strict();
export type UpdatePhysiotherapistPortfolioInput = z.infer<
  typeof updatePhysiotherapistPortfolioSchema
>;

const nursingSpecialtiesSchema = z
  .array(z.string().min(1))
  .max(MAX_NURSING_SPECIALTIES, `Select up to ${MAX_NURSING_SPECIALTIES} specialties`);

/** The per-visit fee the nurse sets themselves (PKR). */
const nurseHomeVisitFeeSchema = z.coerce
  .number({ message: "Enter your per-visit fee" })
  .int("Fee must be a whole number")
  .min(NURSE_HOME_VISIT_FEE_MIN, `Fee must be at least Rs. ${NURSE_HOME_VISIT_FEE_MIN}`)
  .max(NURSE_HOME_VISIT_FEE_MAX, `Fee can be at most Rs. ${NURSE_HOME_VISIT_FEE_MAX}`);

export const updateNurseProfileSchema = baseStaffProfileSchema.extend({
  specialties: nursingSpecialtiesSchema.optional(),
  bio: z.string().trim().max(2000, "Bio is too long").optional(),
  languages: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  avatarUrl: z.string().min(1).max(500).optional(),
  homeVisitFee: nurseHomeVisitFeeSchema.optional(),
});
export type UpdateNurseProfileInput = z.infer<typeof updateNurseProfileSchema>;

export const nurseBankAccountSchema = staffBankAccountSchema;
export type NurseBankAccountInput = z.infer<typeof nurseBankAccountSchema>;

export const nurseVerificationSchema = baseStaffVerificationSchema.extend({
  specialties: nursingSpecialtiesSchema.min(1, "Select at least one specialty"),
  avatarUrl: z.string().min(1, "Profile photo is required").max(500),
  homeVisitFee: nurseHomeVisitFeeSchema,
  bankAccount: verificationBankAccountSchema,
});
export type NurseVerificationInput = z.infer<typeof nurseVerificationSchema>;

/** Admin: add an approved nurse directly (skips self-onboarding). */
export const adminCreateNurseSchema = adminCreatePhysiotherapistSchema.extend({
  specialties: nursingSpecialtiesSchema.min(1, "Select at least one specialty"),
});
export type AdminCreateNurseInput = z.infer<typeof adminCreateNurseSchema>;

/** Admin: manage an existing nurse — status, service toggles, and profile corrections. */
export const adminUpdateNurseSchema = adminUpdatePhysiotherapistSchema.safeExtend({
  specialties: nursingSpecialtiesSchema.optional(),
});
export type AdminUpdateNurseInput = z.infer<typeof adminUpdateNurseSchema>;

/** Nurses share the physiotherapist portfolio shape (both live on StaffProfile.portfolio). */
export const updateNursePortfolioSchema = updatePhysiotherapistPortfolioSchema;
export type UpdateNursePortfolioInput = UpdatePhysiotherapistPortfolioInput;
