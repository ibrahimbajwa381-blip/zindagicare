import {
  MAX_ADDITIONAL_SPECIALTIES,
  MAX_VERIFIED_SPECIALTIES,
  normalizeAdditionalSpecialties,
  SPECIALTIES,
} from "@zindagi/shared";
import { z } from "zod";

const specialtyEnum = z.enum(SPECIALTIES);

/**
 * Doctor-claimed specialties: exactly one primary + optional additional (no duplicates).
 */
export const doctorSpecialtySelectionSchema = z
  .object({
    primarySpecialty: specialtyEnum,
    additionalSpecialties: z
      .array(specialtyEnum)
      .max(
        MAX_ADDITIONAL_SPECIALTIES,
        `Select up to ${MAX_ADDITIONAL_SPECIALTIES} additional specialties`,
      )
      .optional()
      .default([]),
  })
  .transform((data) => ({
    primarySpecialty: data.primarySpecialty,
    additionalSpecialties: normalizeAdditionalSpecialties(
      data.primarySpecialty,
      data.additionalSpecialties,
    ),
  }));

/** Admin-verified specialties visible to patients. */
export const verifiedSpecialtiesSchema = z
  .array(specialtyEnum)
  .min(1, "Select at least one specialty to verify")
  .max(
    MAX_VERIFIED_SPECIALTIES,
    `Verify up to ${MAX_VERIFIED_SPECIALTIES} specialties`,
  );

export type DoctorSpecialtySelection = z.infer<typeof doctorSpecialtySelectionSchema>;
