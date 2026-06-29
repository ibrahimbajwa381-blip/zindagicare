import { SPECIALTIES } from "@zindagi/shared";
import { z } from "zod";
import {
  isValidPakistaniMobile,
  normalizePhoneDigits,
  PAKISTANI_PHONE_ERROR,
  toPakistaniLocalPhone,
} from "./pakistan-phone";
import { geoPointInputSchema } from "./geo.schema";

/** Accepts 03001234567, spaces, dashes, +92, 0092, etc. Outputs 03XXXXXXXXX. */
export const pakistaniPhoneSchema = z
  .string()
  .trim()
  .min(1, "Enter your mobile number")
  .transform(normalizePhoneDigits)
  .refine(isValidPakistaniMobile, { message: PAKISTANI_PHONE_ERROR })
  .transform(toPakistaniLocalPhone);

const pakistaniPhone = pakistaniPhoneSchema;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const accountTypes = ["patient", "doctor", "nurse", "physiotherapist"] as const;
export type AccountType = (typeof accountTypes)[number];

export const staffAccountTypes = ["doctor", "nurse", "physiotherapist"] as const;
export type StaffAccountType = (typeof staffAccountTypes)[number];

/** Add a staff role to an existing logged-in account (keeps patient role). */
export const addStaffRoleSchema = z.object({
  accountType: z.enum(staffAccountTypes),
  city: z.string().trim().min(2, "City is required"),
});

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
    phone: pakistaniPhone,
    accountType: z.enum(accountTypes).default("patient"),
    city: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.accountType !== "patient" && (!data.city || data.city.length < 2)) {
      ctx.addIssue({
        code: "custom",
        message: "City is required",
        path: ["city"],
      });
    }
  });

export const otpRequestSchema = z.object({
  phone: pakistaniPhone,
});

export const otpVerifySchema = otpRequestSchema.extend({
  code: z.string().length(6, "Enter the 6-digit code"),
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
  specialties: z
    .array(z.enum(SPECIALTIES))
    .min(1, "Select your specialization category")
    .max(3, "Select up to three specialties"),
  avatarUrl: z.string().min(1, "Profile photo is required"),
  bio: z.string().max(2000).optional(),
  consultationFee: z.coerce.number().min(0).optional(),
  hospitals: z
    .array(
      z.object({
        name: z.string().min(2),
        city: z.string().min(2),
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
});

export const adminDoctorDecisionSchema = z.object({
  doctorProfileId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().max(500).optional(),
});
