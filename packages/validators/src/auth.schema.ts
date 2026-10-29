import { z } from "zod";
import {
  isValidPakistaniMobile,
  normalizePhoneDigits,
  PAKISTANI_PHONE_ERROR,
  parsePhoneNumber,
  PHONE_ERROR,
  toPakistaniLocalPhone,
} from "./pakistan-phone";
import { geoPointInputSchema } from "./geo.schema";
import {
  doctorSpecialtySelectionSchema,
  verifiedSpecialtiesSchema,
} from "./specialty.schema";

/** Accepts 03001234567, spaces, dashes, +92, 0092, etc. Outputs 03XXXXXXXXX. */
export const pakistaniPhoneSchema = z
  .string()
  .trim()
  .min(1, "Enter your mobile number")
  .transform(normalizePhoneDigits)
  .refine(isValidPakistaniMobile, { message: PAKISTANI_PHONE_ERROR })
  .transform(toPakistaniLocalPhone);

/**
 * Pakistani or international mobile. Pakistani numbers come out as 03XXXXXXXXX (same as
 * {@link pakistaniPhoneSchema}); international ones (+ or 00 prefix) as E.164.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Enter your mobile number")
  .transform((value, ctx) => {
    const parsed = parsePhoneNumber(value);
    if (!parsed) {
      ctx.addIssue({ code: "custom", message: PHONE_ERROR });
      return z.NEVER;
    }
    return parsed;
  });

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const accountTypes = [
  "patient",
  "doctor",
  "nurse",
  "physiotherapist",
  "herbalist",
  "nutritionist",
  "lab",
  "other",
] as const;
export type AccountType = (typeof accountTypes)[number];

export const staffAccountTypes = [
  "doctor",
  "nurse",
  "physiotherapist",
  "herbalist",
  "nutritionist",
] as const;
export type StaffAccountType = (typeof staffAccountTypes)[number];

const MIN_AGE_YEARS = 13;
const MAX_AGE_YEARS = 120;

export const dateOfBirthSchema = z
  .string()
  .trim()
  .min(1, "Date of birth is required")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Enter a valid date of birth",
  })
  .refine(
    (value) => {
      const dob = new Date(value);
      const now = new Date();
      const ageMs = now.getTime() - dob.getTime();
      const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
      return ageYears >= MIN_AGE_YEARS && ageYears <= MAX_AGE_YEARS;
    },
    { message: `Age must be between ${MIN_AGE_YEARS} and ${MAX_AGE_YEARS} years` },
  );

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name is required"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Invalid email address"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    phone: phoneSchema,
    accountType: z.enum(accountTypes).default("patient"),
    city: z.string().trim().min(2, "City is required"),
    dateOfBirth: dateOfBirthSchema,
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

/** Patient-only profile completion after signup. */
export const onboardingSchema = z.object({
  city: z.string().min(2, "City is required"),
  locale: z.enum(["en", "ur"]).default("en"),
  dateOfBirth: z.string().optional(),
  gender: z
    .union([z.enum(["male", "female", "other"]), z.literal("")])
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  /** Required when the account has no phone yet (e.g. Google signup). */
  phone: phoneSchema.optional(),
});

const timeLocalSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Use HH:mm format (e.g. 16:00)");

export const weeklyAvailabilityEntrySchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTimeLocal: timeLocalSchema,
    endTimeLocal: timeLocalSchema,
  })
  .refine((data) => data.endTimeLocal > data.startTimeLocal, {
    message: "End time must be after start time",
    path: ["endTimeLocal"],
  });

export const doctorVerificationSchema = z.object({
  pmdcNumber: z
    .string()
    .min(4, "PMDC number is required")
    .max(32, "PMDC number is too long"),
  cnic: z
    .string()
    .regex(/^[0-9]{5}-[0-9]{7}-[0-9]$/, "CNIC must be XXXXX-XXXXXXX-X"),
  medicalDegree: z.string().min(2, "Medical degree is required"),
  qualifications: z
    .array(z.string().trim().min(2).max(80))
    .max(12, "Add up to 12 additional qualifications")
    .optional()
    .default([]),
  medicalCollege: z.string().min(2, "Medical college is required"),
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
  hospitals: z
    .array(
      z.object({
        name: z.string().min(2),
        city: z.string().min(2),
        area: z.string().trim().max(100).optional(),
        address: z.string().optional(),
        geo: geoPointInputSchema.optional(),
      }),
    )
    .min(1, "Add at least one practice location"),
  homeVisit: z
    .object({
      enabled: z.boolean(),
      area: z.string().min(2).optional(),
      geo: geoPointInputSchema.optional(),
    })
    .superRefine((data, ctx) => {
      if (!data.enabled) return;
      if (!data.area?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Service area is required for in-house visits",
          path: ["area"],
        });
      }
      if (!data.geo) {
        ctx.addIssue({
          code: "custom",
          message: "Google Maps location is required for in-house visits",
          path: ["geo"],
        });
      }
    }),
  documentUrls: z.object({
    pmdcCertificate: z.string().min(1, "PMDC certificate required"),
    cnicFront: z.string().min(1, "CNIC front image required"),
    cnicBack: z.string().min(1, "CNIC back image required"),
    degreeCertificate: z.string().min(1, "Degree certificate required"),
  }),
  weeklyAvailability: z
    .array(weeklyAvailabilityEntrySchema)
    .min(1, "Add at least one availability window"),
  sundayConsult: z
    .object({
      enabled: z.boolean(),
      startTimeLocal: timeLocalSchema.optional(),
      endTimeLocal: timeLocalSchema.optional(),
      slotDurationMins: z.coerce.number().int().min(5).max(60).default(10),
    })
    .optional()
    .superRefine((data, ctx) => {
      if (!data?.enabled) return;
      if (!data.startTimeLocal) {
        ctx.addIssue({
          code: "custom",
          message: "Sunday start time is required",
          path: ["startTimeLocal"],
        });
      }
      if (!data.endTimeLocal) {
        ctx.addIssue({
          code: "custom",
          message: "Sunday end time is required",
          path: ["endTimeLocal"],
        });
      }
      if (
        data.startTimeLocal &&
        data.endTimeLocal &&
        data.endTimeLocal <= data.startTimeLocal
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Sunday end time must be after start time",
          path: ["endTimeLocal"],
        });
      }
    }),
  acceptedProviderAgreement: z.literal(true, {
    message: "You must accept the ZindagiCare Provider Agreement",
  }),
}).and(doctorSpecialtySelectionSchema);

export const adminDoctorDecisionSchema = z.object({
  doctorProfileId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().max(500).optional(),
  /** On approve: specialties to make patient-visible. Defaults to all claimed. */
  verifiedSpecialties: verifiedSpecialtiesSchema.optional(),
});

/** Mobile app: Google ID token obtained on-device (expo-auth-session), exchanged for our own tokens. */
export const mobileGoogleSignInSchema = z.object({
  idToken: z.string().min(1, "Missing Google ID token"),
});

export const mobileRefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Missing refresh token"),
});