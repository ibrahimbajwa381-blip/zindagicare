import {
  MAX_ADDITIONAL_SPECIALTIES,
  normalizeAdditionalSpecialties,
  SPECIALTIES,
} from "@zindagi/shared";
import { z } from "zod";
import { pakistaniPhoneSchema, weeklyAvailabilityEntrySchema } from "./auth.schema";
import { geoPointInputSchema } from "./geo.schema";

const timeLocalSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Use HH:mm format (e.g. 16:00)");

const hospitalSchema = z.object({
  name: z.string().min(2, "Hospital name is required"),
  city: z.string().min(2, "City is required"),
  address: z.string().optional(),
});

const doctorHomeVisitSchema = z
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
        message: "Location is required for in-house visits",
        path: ["geo"],
      });
    }
  });

const specialtyEnum = z.enum(SPECIALTIES);

export const updateDoctorProfileSchema = z
  .object({
    name: z.string().min(2, "Name is required").optional(),
    phone: pakistaniPhoneSchema.optional(),
    avatarUrl: z.string().min(1, "Invalid profile photo URL").optional(),
    bio: z.string().max(2000).optional().nullable(),
    consultationFee: z.coerce.number().min(0).optional(),
    primarySpecialty: specialtyEnum.optional(),
    additionalSpecialties: z
      .array(specialtyEnum)
      .max(
        MAX_ADDITIONAL_SPECIALTIES,
        `Select up to ${MAX_ADDITIONAL_SPECIALTIES} additional specialties`,
      )
      .optional(),
    languages: z.array(z.string().trim().min(1)).min(1, "Add at least one language").optional(),
    hospitals: z.array(hospitalSchema).min(1, "Add at least one practice location").optional(),
    weeklyAvailability: z
      .array(weeklyAvailabilityEntrySchema)
      .min(1, "Add at least one availability window")
      .optional(),
    homeVisit: doctorHomeVisitSchema.optional(),
    sundayConsult: z
      .object({
        enabled: z.boolean(),
        startTimeLocal: timeLocalSchema.optional(),
        endTimeLocal: timeLocalSchema.optional(),
        slotDurationMins: z.coerce.number().int().min(5).max(60).optional(),
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
  })
  .superRefine((data, ctx) => {
    if (data.additionalSpecialties !== undefined && data.primarySpecialty === undefined) {
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

export type UpdateDoctorProfileInput = z.infer<typeof updateDoctorProfileSchema>;
