"use client";

import { useCallback, useEffect, useState } from "react";
import type { GeoCoordinates } from "@/lib/geo/parse-google-maps-url";

const DRAFT_VERSION = 2 as const;
const STORAGE_PREFIX = "zc:doctor-verification-draft:";

export type AvailabilityDayDraft = {
  enabled: boolean;
  startTimeLocal: string;
  endTimeLocal: string;
};

export type DoctorVerificationDraftFields = {
  pmdcNumber: string;
  cnic: string;
  medicalDegree: string;
  qualifications: string;
  medicalCollege: string;
  graduationYear: string;
  experienceYears: string;
  bio: string;
  hospitalName: string;
  hospitalCity: string;
  hospitalArea: string;
  hospitalAddress: string;
  consultationFee: string;
  homeVisitArea: string;
};

export type DoctorVerificationDraft = {
  v: typeof DRAFT_VERSION;
  updatedAt: number;
  fields: DoctorVerificationDraftFields;
  primarySpecialty: string;
  additionalSpecialties: string[];
  /** @deprecated v1 drafts used a single specialty */
  specialty?: string;
  avatarUrl?: string;
  availability: Record<string, AvailabilityDayDraft>;
  sundayEnabled: boolean;
  sundayStart: string;
  sundayEnd: string;
  slotDurationMins: number;
  documents: Record<string, string>;
  documentNames: Record<string, string>;
  homeVisitEnabled: boolean;
  homeVisitGeo: GeoCoordinates | null;
};

export type DoctorVerificationDraftPayload = Omit<
  DoctorVerificationDraft,
  "v" | "updatedAt"
>;

export const EMPTY_VERIFICATION_FIELDS: DoctorVerificationDraftFields = {
  pmdcNumber: "",
  cnic: "",
  medicalDegree: "",
  qualifications: "",
  medicalCollege: "",
  graduationYear: "",
  experienceYears: "0",
  bio: "",
  hospitalName: "",
  hospitalCity: "Lahore",
  hospitalArea: "",
  hospitalAddress: "",
  consultationFee: "",
  homeVisitArea: "",
};

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function isGeo(value: unknown): value is GeoCoordinates {
  if (!value || typeof value !== "object") return false;
  const geo = value as GeoCoordinates;
  return Number.isFinite(geo.lng) && Number.isFinite(geo.lat);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function parseDraft(raw: string): DoctorVerificationDraft | null {
  try {
    const parsed = JSON.parse(raw) as {
      v?: number;
      updatedAt?: number;
      fields?: Partial<DoctorVerificationDraftFields>;
      specialty?: string;
      primarySpecialty?: string;
      additionalSpecialties?: unknown;
      avatarUrl?: string;
      availability?: Record<string, AvailabilityDayDraft>;
      sundayEnabled?: boolean;
      sundayStart?: string;
      sundayEnd?: string;
      slotDurationMins?: number;
      documents?: Record<string, string>;
      documentNames?: Record<string, string>;
      homeVisitEnabled?: boolean;
      homeVisitGeo?: unknown;
    };
    if (
      (parsed.v !== 1 && parsed.v !== 2) ||
      !parsed.fields ||
      typeof parsed.fields !== "object"
    ) {
      return null;
    }

    const fields = parsed.fields as Partial<DoctorVerificationDraftFields>;
    const legacySpecialty = asString(parsed.specialty);
    const primarySpecialty =
      asString(parsed.primarySpecialty) || legacySpecialty;
    const additionalSpecialties = Array.isArray(parsed.additionalSpecialties)
      ? parsed.additionalSpecialties.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0,
        )
      : [];

    return {
      v: DRAFT_VERSION,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
      fields: {
        pmdcNumber: asString(fields.pmdcNumber),
        cnic: asString(fields.cnic),
        medicalDegree: asString(fields.medicalDegree),
        qualifications: asString(fields.qualifications),
        medicalCollege: asString(fields.medicalCollege),
        graduationYear: asString(fields.graduationYear),
        experienceYears: asString(fields.experienceYears, "0"),
        bio: asString(fields.bio),
        hospitalName: asString(fields.hospitalName),
        hospitalCity: asString(fields.hospitalCity, "Lahore"),
        hospitalArea: asString(fields.hospitalArea),
        hospitalAddress: asString(fields.hospitalAddress),
        consultationFee: asString(fields.consultationFee),
        homeVisitArea: asString(fields.homeVisitArea),
      },
      primarySpecialty,
      additionalSpecialties,
      avatarUrl: parsed.avatarUrl ? asString(parsed.avatarUrl) : undefined,
      availability:
        parsed.availability && typeof parsed.availability === "object"
          ? (parsed.availability as Record<string, AvailabilityDayDraft>)
          : {},
      sundayEnabled: Boolean(parsed.sundayEnabled),
      sundayStart: asString(parsed.sundayStart, "16:00"),
      sundayEnd: asString(parsed.sundayEnd, "18:00"),
      slotDurationMins:
        typeof parsed.slotDurationMins === "number" && Number.isFinite(parsed.slotDurationMins)
          ? Math.min(60, Math.max(5, parsed.slotDurationMins))
          : 10,
      documents:
        parsed.documents && typeof parsed.documents === "object"
          ? (parsed.documents as Record<string, string>)
          : {},
      documentNames:
        parsed.documentNames && typeof parsed.documentNames === "object"
          ? (parsed.documentNames as Record<string, string>)
          : {},
      homeVisitEnabled: Boolean(parsed.homeVisitEnabled),
      homeVisitGeo: isGeo(parsed.homeVisitGeo) ? parsed.homeVisitGeo : null,
    };
  } catch {
    return null;
  }
}

export function loadDoctorVerificationDraft(
  userId: string,
): DoctorVerificationDraft | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    return parseDraft(raw);
  } catch {
    return null;
  }
}

export function saveDoctorVerificationDraft(
  userId: string,
  payload: DoctorVerificationDraftPayload,
) {
  try {
    const draft: DoctorVerificationDraft = {
      v: DRAFT_VERSION,
      updatedAt: Date.now(),
      ...payload,
    };
    localStorage.setItem(storageKey(userId), JSON.stringify(draft));
  } catch {
    // Private mode / quota — ignore.
  }
}

export function clearDoctorVerificationDraft(userId: string) {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}

/** True when the draft has user-entered progress (not just empty defaults). */
export function isMeaningfulVerificationDraft(
  draft: DoctorVerificationDraft | DoctorVerificationDraftPayload | null | undefined,
): boolean {
  if (!draft) return false;
  const f = draft.fields;
  if (draft.avatarUrl) return true;
  if (Object.keys(draft.documents).length > 0) return true;
  if (draft.homeVisitEnabled || draft.sundayEnabled) return true;
  if (draft.homeVisitGeo) return true;
  if (
    f.pmdcNumber ||
    f.cnic ||
    f.medicalDegree ||
    f.qualifications ||
    f.medicalCollege ||
    f.graduationYear ||
    f.bio ||
    f.hospitalName ||
    f.hospitalArea ||
    f.hospitalAddress ||
    f.consultationFee ||
    f.homeVisitArea
  ) {
    return true;
  }
  if (f.experienceYears && f.experienceYears !== "0") return true;
  return false;
}

/** Loads a per-user draft once; pair with debounced `save` / `clear` in the form. */
export function useDoctorVerificationDraft(userId: string | undefined) {
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [draft, setDraft] = useState<DoctorVerificationDraft | null>(null);

  useEffect(() => {
    if (!userId) return;
    const loaded = loadDoctorVerificationDraft(userId);
    const meaningful = isMeaningfulVerificationDraft(loaded);
    setDraft(meaningful ? loaded : null);
    setRestored(meaningful);
    setReady(true);
  }, [userId]);

  const save = useCallback(
    (payload: DoctorVerificationDraftPayload) => {
      if (!userId) return;
      if (!isMeaningfulVerificationDraft(payload)) {
        clearDoctorVerificationDraft(userId);
        return;
      }
      saveDoctorVerificationDraft(userId, payload);
    },
    [userId],
  );

  const clear = useCallback(() => {
    if (!userId) return;
    clearDoctorVerificationDraft(userId);
    setDraft(null);
    setRestored(false);
  }, [userId]);

  return { ready, restored, draft, save, clear };
}
