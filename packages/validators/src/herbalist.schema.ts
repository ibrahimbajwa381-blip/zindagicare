import {
  HERBALIST_SPECIALTIES,
  MAX_HERBALIST_SPECIALTIES,
  normalizeAdditionalSpecialties,
} from "@zindagi/shared";
import { z } from "zod";
import { pakistaniPhoneSchema, weeklyAvailabilityEntrySchema } from "./auth.schema";
import { geoPointInputSchema } from "./geo.schema";

const herbalistSpecialtyEnum = z.enum(HERBALIST_SPECIALTIES);
const MAX_ADDITIONAL = MAX_HERBALIST_SPECIALTIES - 1;

const clinicSchema = z.object({
  name: z.string().min(2, "Clinic name is required"),
  city: z.string().min(2, "City is required"),
  address: z.string().optional(),
  geo: geoPointInputSchema.optional(),
});

/** Herbalist onboarding — video consults only, so no home-visit or Sunday blocks. */
export const herbalistVerificationSchema = z.object({
  licenseNumber: z
    .string()
    .min(4, "Council registration number is required")
    .max(32, "Council registration number is too long"),
  cnic: z
    .string()
    .regex(/^[0-9]{5}-[0-9]{7}-[0-9]$/, "CNIC must be XXXXX-XXXXXXX-X"),
  degree: z.string().min(2, "Qualification is required"),
  qualifications: z
    .array(z.string().trim().min(2).max(80))
    .max(12, "Add up to 12 additional qualifications")
    .optional()
    .default([]),
  institute: z.string().min(2, "Institute is required"),
  graduationYear: z.coerce
    .number()
    .int()
    .min(1950)
    .max(new Date().getFullYear()),
  experienceYears: z.coerce.number().int().min(0).max(60),
  avatarUrl: z.string().min(1, "Profile photo is required"),
  bio: z.string().max(2000).optional(),
  consultationFee: z.coerce
    .number({ message: "Enter your consultation fee" })
    .min(500, "Consultation fee must be at least PKR 500"),
  primarySpecialty: herbalistSpecialtyEnum,
  additionalSpecialties: z
    .array(herbalistSpecialtyEnum)
    .max(MAX_ADDITIONAL, `Select up to ${MAX_ADDITIONAL} additional specialties`)
    .optional()
    .default([]),
  languages: z
    .array(z.string().trim().min(1))
    .min(1, "Add at least one language")
    .optional()
    .default(["English", "Urdu"]),
  clinics: z.array(clinicSchema).min(1, "Add at least one practice location"),
  videoConsultEnabled: z.boolean().optional().default(true),
  documentUrls: z.object({
    licenseCertificate: z.string().min(1, "Council certificate required"),
    cnicFront: z.string().min(1, "CNIC front image required"),
    cnicBack: z.string().min(1, "CNIC back image required"),
    degreeCertificate: z.string().min(1, "Degree certificate required"),
  }),
  weeklyAvailability: z
    .array(weeklyAvailabilityEntrySchema)
    .min(1, "Add at least one availability window"),
});

export type HerbalistVerificationInput = z.infer<
  typeof herbalistVerificationSchema
>;

export const updateHerbalistProfileSchema = z
  .object({
    name: z.string().min(2, "Name is required").optional(),
    phone: pakistaniPhoneSchema.optional(),
    avatarUrl: z.string().min(1, "Invalid profile photo URL").optional(),
    bio: z.string().max(2000).optional().nullable(),
    consultationFee: z.coerce
      .number()
      .min(500, "Consultation fee must be at least PKR 500")
      .optional(),
    primarySpecialty: herbalistSpecialtyEnum.optional(),
    additionalSpecialties: z
      .array(herbalistSpecialtyEnum)
      .max(MAX_ADDITIONAL, `Select up to ${MAX_ADDITIONAL} additional specialties`)
      .optional(),
    languages: z
      .array(z.string().trim().min(1))
      .min(1, "Add at least one language")
      .optional(),
    clinics: z
      .array(clinicSchema)
      .min(1, "Add at least one practice location")
      .optional(),
    videoConsultEnabled: z.boolean().optional(),
    weeklyAvailability: z
      .array(weeklyAvailabilityEntrySchema)
      .min(1, "Add at least one availability window")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.additionalSpecialties !== undefined &&
      data.primarySpecialty === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Primary specialty is required when updating specialties",
        path: ["primarySpecialty"],
      });
    }
  })
  .transform((data) => {
    if (data.primarySpecialty === undefined) {
      const { additionalSpecialties: _drop, ...rest } = data;
      return { ...rest, additionalSpecialties: undefined as string[] | undefined };
    }
    return {
      ...data,
      additionalSpecialties: normalizeAdditionalSpecialties(
        data.primarySpecialty,
        data.additionalSpecialties ?? [],
      ),
    };
  });

export type UpdateHerbalistProfileInput = z.infer<
  typeof updateHerbalistProfileSchema
>;

export const adminCreateHerbalistSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  phone: z.string().optional(),
  licenseNumber: z.string().min(3).max(30),
  /** First entry becomes primary; remainder additional + verified. */
  specialties: z.array(herbalistSpecialtyEnum).min(1).max(MAX_HERBALIST_SPECIALTIES),
});

export type AdminCreateHerbalistInput = z.infer<
  typeof adminCreateHerbalistSchema
>;

export const adminUpdateHerbalistSchema = z
  .object({
    isListed: z.boolean().optional(),
    isActive: z.boolean().optional(),
    videoConsultEnabled: z.boolean().optional(),
    verificationStatus: z.enum(["approved", "rejected", "restricted"]).optional(),
    rejectionReason: z.string().min(3).max(500).optional(),
    weeklyAvailability: z.array(weeklyAvailabilityEntrySchema).optional(),
    onlineCommissionPercent: z.number().min(0).max(100).nullable().optional(),
    /** Replace admin-verified patient-visible specialties. */
    verifiedSpecialties: z.array(herbalistSpecialtyEnum).optional(),
    primarySpecialty: herbalistSpecialtyEnum.optional(),
    additionalSpecialties: z
      .array(herbalistSpecialtyEnum)
      .max(MAX_ADDITIONAL)
      .optional(),

    /** Profile identity / content (same fields herbalists can self-edit). */
    name: z.string().min(2).max(100).optional(),
    phone: pakistaniPhoneSchema.optional(),
    avatarUrl: z.string().min(1).optional(),
    bio: z.string().max(2000).optional().nullable(),
    consultationFee: z.coerce.number().min(0).optional(),
    languages: z.array(z.string().trim().min(1)).min(1).optional(),
    clinics: z.array(clinicSchema).min(1).optional(),

    /** Credentials — admin-only corrections. */
    licenseNumber: z.string().min(4).max(32).optional(),
    degree: z.string().min(2).max(100).optional(),
    qualifications: z.array(z.string().trim().min(2).max(80)).max(12).optional(),
    institute: z.string().min(2).max(200).optional(),
    graduationYear: z.coerce
      .number()
      .int()
      .min(1950)
      .max(new Date().getFullYear())
      .optional(),
    experienceYears: z.coerce.number().int().min(0).max(60).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.additionalSpecialties !== undefined &&
      data.primarySpecialty === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Primary specialty is required when updating specialties",
        path: ["primarySpecialty"],
      });
    }
  })
  .transform((data) => {
    if (data.primarySpecialty === undefined) return data;
    return {
      ...data,
      additionalSpecialties: normalizeAdditionalSpecialties(
        data.primarySpecialty,
        data.additionalSpecialties ?? [],
      ),
    };
  });

export type AdminUpdateHerbalistInput = z.infer<
  typeof adminUpdateHerbalistSchema
>;

export const herbalistBankAccountSchema = z.object({
  accountTitle: z.string().min(2).max(120),
  accountNumber: z.string().min(4).max(40),
  bankName: z.string().min(2).max(120),
  iban: z.string().max(40).optional(),
});

export type HerbalistBankAccountInput = z.infer<
  typeof herbalistBankAccountSchema
>;
