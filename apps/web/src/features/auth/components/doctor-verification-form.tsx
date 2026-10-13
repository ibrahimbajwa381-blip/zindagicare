"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HOME_CARE_MATCH_RADIUS_KM, SPECIALTIES } from "@zindagi/shared";
import { parseQualificationsInput } from "@/lib/doctors/qualifications";
import { useSafeRouter } from "@/lib/navigation/safe-router";
import { Button } from "@/components/ui/button";
import { CalendarHeart, Clock } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { TimePicker, formatTime12h } from "@/components/ui/time-picker";
import { previewSundaySlots } from "@/lib/sunday/display";
import { DoctorProfilePhotoUpload } from "@/features/doctor/components/doctor-profile-photo-upload";
import { DoctorSpecialtyFields } from "@/components/forms/doctor-specialty-fields";
import { GeoLocationPicker } from "@/components/forms/geo-location-picker";
import { CitySelect } from "@/components/forms/city-select";
import { CityAreaSelect } from "@/components/forms/city-area-select";
import { VerificationDocumentUpload } from "@/components/forms/verification-document-upload";
import type { GeoCoordinates } from "@/lib/geo/parse-google-maps-url";
import {
  EMPTY_VERIFICATION_FIELDS,
  useDoctorVerificationDraft,
  type AvailabilityDayDraft,
  type DoctorVerificationDraftFields,
} from "@/features/auth/hooks/use-doctor-verification-draft";
import { cityAreaError } from "@/lib/geo/city-area-error";

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

type AvailabilityDay = AvailabilityDayDraft;

const DEFAULT_AVAILABILITY: Record<number, AvailabilityDay> = {
  1: { enabled: true, startTimeLocal: "16:00", endTimeLocal: "20:00" },
  2: { enabled: true, startTimeLocal: "16:00", endTimeLocal: "20:00" },
  3: { enabled: true, startTimeLocal: "16:00", endTimeLocal: "20:00" },
  4: { enabled: true, startTimeLocal: "16:00", endTimeLocal: "20:00" },
  5: { enabled: true, startTimeLocal: "16:00", endTimeLocal: "20:00" },
  6: { enabled: false, startTimeLocal: "10:00", endTimeLocal: "14:00" },
  0: { enabled: false, startTimeLocal: "10:00", endTimeLocal: "14:00" },
};

const DEFAULT_SPECIALTY =
  SPECIALTIES.find((item) => item === "General Physician") ?? SPECIALTIES[0] ?? "";

const DRAFT_SAVE_MS = 400;

function mergeAvailability(
  raw: Record<string, AvailabilityDayDraft> | undefined,
): Record<number, AvailabilityDay> {
  const next: Record<number, AvailabilityDay> = { ...DEFAULT_AVAILABILITY };
  if (!raw) return next;

  for (const day of DAYS) {
    const entry = raw[String(day.value)];
    if (!entry || typeof entry !== "object") continue;
    next[day.value] = {
      enabled: Boolean(entry.enabled),
      startTimeLocal:
        typeof entry.startTimeLocal === "string" && entry.startTimeLocal
          ? entry.startTimeLocal
          : DEFAULT_AVAILABILITY[day.value].startTimeLocal,
      endTimeLocal:
        typeof entry.endTimeLocal === "string" && entry.endTimeLocal
          ? entry.endTimeLocal
          : DEFAULT_AVAILABILITY[day.value].endTimeLocal,
    };
  }
  return next;
}

function availabilityForStorage(
  availability: Record<number, AvailabilityDay>,
): Record<string, AvailabilityDayDraft> {
  const out: Record<string, AvailabilityDayDraft> = {};
  for (const day of DAYS) {
    out[String(day.value)] = availability[day.value];
  }
  return out;
}

export function DoctorVerificationForm() {
  const { push } = useSafeRouter();
  const { update, data: session } = useSession();
  const userId = session?.user?.id;
  const { ready, restored, draft, save, clear } = useDoctorVerificationDraft(userId);
  const skipDraftSave = useRef(false);

  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [acceptedAgreement, setAcceptedAgreement] = useState(false);
  const [draftApplied, setDraftApplied] = useState(false);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);

  const [fields, setFields] = useState<DoctorVerificationDraftFields>(EMPTY_VERIFICATION_FIELDS);
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [primarySpecialty, setPrimarySpecialty] = useState<string>(DEFAULT_SPECIALTY);
  const [additionalSpecialties, setAdditionalSpecialties] = useState<string[]>([]);
  const [availability, setAvailability] = useState(DEFAULT_AVAILABILITY);
  const [sundayEnabled, setSundayEnabled] = useState(false);
  const [sundayStart, setSundayStart] = useState("16:00");
  const [sundayEnd, setSundayEnd] = useState("18:00");
  const [slotDurationMins, setSlotDurationMins] = useState(10);
  const [documents, setDocuments] = useState<Record<string, string>>({});
  const [documentNames, setDocumentNames] = useState<Record<string, string>>({});
  const [homeVisitEnabled, setHomeVisitEnabled] = useState(false);
  const [homeVisitGeo, setHomeVisitGeo] = useState<GeoCoordinates | null>(null);

  useEffect(() => {
    if (!ready || draftApplied) return;

    if (draft) {
      setFields(draft.fields);
      setPrimarySpecialty(draft.primarySpecialty || DEFAULT_SPECIALTY);
      setAdditionalSpecialties(draft.additionalSpecialties ?? []);
      setAvatarUrl(draft.avatarUrl);
      setAvailability(mergeAvailability(draft.availability));
      setSundayEnabled(draft.sundayEnabled);
      setSundayStart(draft.sundayStart);
      setSundayEnd(draft.sundayEnd);
      setSlotDurationMins(draft.slotDurationMins);
      setDocuments(draft.documents);
      setDocumentNames(draft.documentNames);
      setHomeVisitEnabled(draft.homeVisitEnabled);
      setHomeVisitGeo(draft.homeVisitGeo);
      setShowRestoredNotice(true);
    }

    setDraftApplied(true);
  }, [ready, draft, draftApplied]);

  const draftPayload = useMemo(
    () => ({
      fields,
      primarySpecialty,
      additionalSpecialties,
      avatarUrl,
      availability: availabilityForStorage(availability),
      sundayEnabled,
      sundayStart,
      sundayEnd,
      slotDurationMins,
      documents,
      documentNames,
      homeVisitEnabled,
      homeVisitGeo,
    }),
    [
      fields,
      primarySpecialty,
      additionalSpecialties,
      avatarUrl,
      availability,
      sundayEnabled,
      sundayStart,
      sundayEnd,
      slotDurationMins,
      documents,
      documentNames,
      homeVisitEnabled,
      homeVisitGeo,
    ],
  );

  useEffect(() => {
    if (!draftApplied || !userId || skipDraftSave.current) return;
    const timer = window.setTimeout(() => {
      if (skipDraftSave.current) return;
      save(draftPayload);
    }, DRAFT_SAVE_MS);
    return () => window.clearTimeout(timer);
  }, [draftApplied, userId, draftPayload, save]);

  function updateField<K extends keyof DoctorVerificationDraftFields>(
    key: K,
    value: DoctorVerificationDraftFields[K],
  ) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function updateAvailability(day: number, patch: Partial<AvailabilityDay>) {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
  }

  const sundaySlotPreview = useMemo(() => {
    if (!sundayEnabled) return [];
    return previewSundaySlots(sundayStart, sundayEnd, slotDurationMins);
  }, [sundayEnabled, sundayStart, sundayEnd, slotDurationMins]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);

    const weeklyAvailability = DAYS.filter((d) => availability[d.value]?.enabled).map(
      (d) => ({
        dayOfWeek: d.value,
        startTimeLocal: availability[d.value].startTimeLocal,
        endTimeLocal: availability[d.value].endTimeLocal,
      }),
    );

    if (!weeklyAvailability.length) {
      setError("Select at least one day for your clinic availability.");
      setPending(false);
      return;
    }

    if (!avatarUrl) {
      setError("Please upload your profile photo.");
      setPending(false);
      return;
    }

    const requiredDocs = [
      "pmdcCertificate",
      "cnicFront",
      "cnicBack",
      "degreeCertificate",
    ] as const;
    for (const key of requiredDocs) {
      if (!documents[key]) {
        setError("Please upload all required documents.");
        setPending(false);
        return;
      }
    }

    if (homeVisitEnabled && !homeVisitGeo) {
      setError("Please add your Google Maps location for in-house visit matching.");
      setPending(false);
      return;
    }

    const homeVisitArea = fields.homeVisitArea.trim();
    if (homeVisitEnabled && homeVisitArea.length < 2) {
      setError("Please enter your service area for in-house visits.");
      setPending(false);
      return;
    }

    if (!primarySpecialty) {
      setError("Select your primary specialty.");
      setPending(false);
      return;
    }

    const currentYear = new Date().getFullYear();
    const graduationYear = Number(fields.graduationYear);
    if (
      !fields.graduationYear.trim() ||
      !Number.isInteger(graduationYear) ||
      graduationYear < 1950 ||
      graduationYear > currentYear
    ) {
      setError(`Enter a valid graduation year between 1950 and ${currentYear}.`);
      setPending(false);
      return;
    }

    const locationError = cityAreaError(fields.hospitalCity, fields.hospitalArea);
    if (locationError) {
      setError(locationError);
      setPending(false);
      return;
    }

    if (!fields.consultationFee || Number(fields.consultationFee) < 500) {
      setError("Enter your consultation fee (at least PKR 500).");
      setPending(false);
      return;
    }

    if (!acceptedAgreement) {
      setError("You must accept the ZindagiCare Provider Agreement to submit.");
      setPending(false);
      return;
    }

    const body = {
      pmdcNumber: fields.pmdcNumber,
      cnic: fields.cnic,
      medicalDegree: fields.medicalDegree,
      qualifications: parseQualificationsInput(fields.qualifications),
      medicalCollege: fields.medicalCollege,
      graduationYear: fields.graduationYear,
      experienceYears: fields.experienceYears,
      primarySpecialty,
      additionalSpecialties,
      avatarUrl,
      bio: fields.bio || undefined,
      consultationFee: fields.consultationFee,
      hospitals: [
        {
          name: fields.hospitalName,
          city: fields.hospitalCity,
          area: fields.hospitalArea.trim() || undefined,
          address: fields.hospitalAddress || undefined,
          geo: homeVisitEnabled && homeVisitGeo ? homeVisitGeo : undefined,
        },
      ],
      homeVisit: {
        enabled: homeVisitEnabled,
        area: homeVisitArea || undefined,
        geo: homeVisitGeo ?? undefined,
      },
      documentUrls: {
        pmdcCertificate: documents.pmdcCertificate,
        cnicFront: documents.cnicFront,
        cnicBack: documents.cnicBack,
        degreeCertificate: documents.degreeCertificate,
      },
      weeklyAvailability,
      sundayConsult: {
        enabled: sundayEnabled,
        startTimeLocal: sundayEnabled ? sundayStart : undefined,
        endTimeLocal: sundayEnabled ? sundayEnd : undefined,
        slotDurationMins,
      },
      acceptedProviderAgreement: acceptedAgreement,
    };

    const res = await fetch("/api/v1/doctor/verification/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error?.message ?? "Submission failed. Check all fields.");
      return;
    }

    skipDraftSave.current = true;
    clear();

    await update({
      doctorVerificationStatus: "pending",
    });

    push("/doctor/profile?submitted=1");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {showRestoredNotice && restored && (
        <div className="rounded-xl border border-brand-light/40 bg-brand-light/10 px-4 py-3 text-sm text-slate-800">
          <p className="font-medium text-slate-900">Draft restored</p>
          <p className="mt-0.5 text-xs text-slate-600">
            We saved your previous progress on this device, including uploaded photos and
            documents. Review the form, then finish any remaining steps.
          </p>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Profile photo</h2>
        <DoctorProfilePhotoUpload
          name={session?.user?.name ?? "Doctor"}
          value={avatarUrl}
          onUploaded={setAvatarUrl}
          required
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Identity & PMDC</h2>
        <div>
          <Label htmlFor="pmdcNumber">PMDC registration number</Label>
          <Input
            id="pmdcNumber"
            name="pmdcNumber"
            value={fields.pmdcNumber}
            onChange={(e) => updateField("pmdcNumber", e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="cnic">CNIC (XXXXX-XXXXXXX-X)</Label>
          <Input
            id="cnic"
            name="cnic"
            placeholder="35202-1234567-1"
            value={fields.cnic}
            onChange={(e) => updateField("cnic", e.target.value)}
            required
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Qualifications</h2>
        <div>
          <Label htmlFor="medicalDegree">Primary degree (e.g. MBBS)</Label>
          <Input
            id="medicalDegree"
            name="medicalDegree"
            placeholder="MBBS"
            value={fields.medicalDegree}
            onChange={(e) => updateField("medicalDegree", e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="qualifications">Additional qualifications (optional)</Label>
          <Input
            id="qualifications"
            name="qualifications"
            placeholder="e.g. FCPS, MCPS, MRCP — separate with commas"
            value={fields.qualifications}
            onChange={(e) => updateField("qualifications", e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Postgraduate degrees and fellowships shown on your public profile alongside MBBS.
          </p>
        </div>
        <div>
          <Label htmlFor="medicalCollege">Medical college</Label>
          <Input
            id="medicalCollege"
            name="medicalCollege"
            value={fields.medicalCollege}
            onChange={(e) => updateField("medicalCollege", e.target.value)}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="graduationYear">Graduation year</Label>
            <Input
              id="graduationYear"
              name="graduationYear"
              type="number"
              min={1950}
              max={new Date().getFullYear()}
              placeholder={`e.g. ${new Date().getFullYear() - 5}`}
              value={fields.graduationYear}
              onChange={(e) => updateField("graduationYear", e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="experienceYears">Years of experience</Label>
            <Input
              id="experienceYears"
              name="experienceYears"
              type="number"
              value={fields.experienceYears}
              onChange={(e) => updateField("experienceYears", e.target.value)}
              required
            />
          </div>
        </div>
        <DoctorSpecialtyFields
          primarySpecialty={primarySpecialty}
          additionalSpecialties={additionalSpecialties}
          onPrimaryChange={setPrimarySpecialty}
          onAdditionalChange={setAdditionalSpecialties}
        />
        <div>
          <Label htmlFor="bio">Professional bio</Label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Brief summary of your practice and expertise"
            value={fields.bio}
            onChange={(e) => updateField("bio", e.target.value)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Practice location</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="hospitalName">Hospital / clinic name</Label>
            <Input
              id="hospitalName"
              name="hospitalName"
              value={fields.hospitalName}
              onChange={(e) => updateField("hospitalName", e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="hospitalCity">City</Label>
            <CitySelect
              id="hospitalCity"
              value={fields.hospitalCity}
              onChange={(city) => {
                // A new city makes the old area meaningless, so clear it.
                if (city !== fields.hospitalCity) updateField("hospitalArea", "");
                updateField("hospitalCity", city);
              }}
              className="mt-1"
            />
          </div>
        </div>
        <CityAreaSelect
          id="hospitalArea"
          city={fields.hospitalCity}
          value={fields.hospitalArea}
          onChange={(area) => updateField("hospitalArea", area)}
        />
        <div>
          <Label htmlFor="hospitalAddress">Address</Label>
          <Input
            id="hospitalAddress"
            name="hospitalAddress"
            value={fields.hospitalAddress}
            onChange={(e) => updateField("hospitalAddress", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="consultationFee">Consultation fee (PKR)</Label>
          <Input
            id="consultationFee"
            name="consultationFee"
            type="number"
            min={500}
            value={fields.consultationFee}
            onChange={(e) => updateField("consultationFee", e.target.value)}
            placeholder="e.g. 2000"
            required
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-4">
        <h2 className="text-sm font-semibold text-slate-900">In-house visit availability</h2>
        <div>
          <Label htmlFor="homeVisitArea">Service area / neighborhood</Label>
          <Input
            id="homeVisitArea"
            name="homeVisitArea"
            placeholder="e.g. DHA Phase 5, Gulberg — where you can travel for home visits"
            minLength={2}
            value={fields.homeVisitArea}
            onChange={(e) => updateField("homeVisitArea", e.target.value)}
          />
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={homeVisitEnabled}
            onChange={(e) => setHomeVisitEnabled(e.target.checked)}
            className="mt-1"
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              I am available for in-house doctor visits within {HOME_CARE_MATCH_RADIUS_KM} km
              of my area
            </p>
            <p className="text-xs text-slate-600">
              Admin will auto-assign you to nearby patient home visits when you are the
              nearest available doctor.
            </p>
          </div>
        </label>

        {homeVisitEnabled && (
          <GeoLocationPicker
            id="doctor-verification-geo"
            value={homeVisitGeo}
            onChange={setHomeVisitGeo}
            required
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Weekly availability</h2>
        <p className="text-xs text-slate-500">
          When are you available for in-clinic or paid consultations? Select days and
          time windows.
        </p>
        <div className="space-y-2">
          {DAYS.map((day) => {
            const slot = availability[day.value];
            return (
              <div
                key={day.value}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3"
              >
                <div className="flex min-w-[120px] items-center gap-2 text-sm">
                  <input
                    id={`availability-day-${day.value}`}
                    type="checkbox"
                    checked={slot.enabled}
                    onChange={(e) =>
                      updateAvailability(day.value, { enabled: e.target.checked })
                    }
                  />
                  <label htmlFor={`availability-day-${day.value}`}>{day.label}</label>
                </div>
                {slot.enabled && (
                  <div className="flex flex-wrap items-center gap-2">
                    <TimePicker
                      id={`availability-start-${day.value}`}
                      value={slot.startTimeLocal}
                      onChange={(startTimeLocal) =>
                        updateAvailability(day.value, { startTimeLocal })
                      }
                    />
                    <span className="text-xs text-slate-500">to</span>
                    <TimePicker
                      id={`availability-end-${day.value}`}
                      value={slot.endTimeLocal}
                      onChange={(endTimeLocal) =>
                        updateAvailability(day.value, { endTimeLocal })
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-brand-light/40 bg-gradient-to-br from-brand-light/10 via-white to-white shadow-sm">
        <label className="flex cursor-pointer items-start gap-4 p-5">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <CalendarHeart className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">
              Free Sunday online consultation{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              Patients will see bookable slots under your specialty on the Sunday
              consult page after admin approval.
            </p>
          </div>
          <span className="relative mt-0.5 inline-flex shrink-0">
            <input
              type="checkbox"
              checked={sundayEnabled}
              onChange={(e) => setSundayEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <span className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand-light/50 peer-focus-visible:ring-offset-2" />
            <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
          </span>
        </label>

        {sundayEnabled && (
          <div className="space-y-4 border-t border-brand-light/30 bg-white/60 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="sunday-start">Start time</Label>
                <TimePicker
                  id="sunday-start"
                  value={sundayStart}
                  onChange={setSundayStart}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="sunday-end">End time</Label>
                <TimePicker
                  id="sunday-end"
                  value={sundayEnd}
                  onChange={setSundayEnd}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="sunday-duration">Slot length</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="sunday-duration"
                    type="number"
                    min={5}
                    max={60}
                    value={slotDurationMins}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setSlotDurationMins(
                        Number.isFinite(next) ? Math.min(60, Math.max(5, next)) : 5,
                      );
                    }}
                    className="pr-12"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-slate-400">
                    min
                  </span>
                </div>
              </div>
            </div>

            {sundaySlotPreview.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                    <Clock className="size-4 text-brand" aria-hidden />
                    Booking slots preview
                  </p>
                  <span className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
                    {sundaySlotPreview.length} slots · {slotDurationMins} min each
                  </span>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  Patients will see these {formatTime12h(sundayStart)}–{formatTime12h(sundayEnd)} time
                  slots on the Sunday consult page.
                </p>
                <div className="max-h-48 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {sundaySlotPreview.map((slot) => (
                      <div
                        key={slot.id}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-center"
                      >
                        <p className="text-sm font-semibold tabular-nums text-slate-800">
                          {slot.startLabel}
                        </p>
                        <p className="text-[11px] tabular-nums text-slate-400">
                          to {slot.endLabel}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-medium text-amber-800">
                  Adjust your time window — the end time must be after the start time.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Verification documents</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Tap each box to choose a file, or drag and drop. JPG, PNG, WebP, or PDF (max 5 MB
            each).
          </p>
        </div>
        <VerificationDocumentUpload
          label="PMDC certificate"
          docKey="pmdcCertificate"
          value={documents.pmdcCertificate}
          fileName={documentNames.pmdcCertificate}
          uploadUrl="/api/v1/doctor/verification/upload"
          onUploaded={(url, name) => {
            setDocuments((prev) => ({ ...prev, pmdcCertificate: url }));
            setDocumentNames((prev) => ({ ...prev, pmdcCertificate: name }));
          }}
          onClear={() => {
            setDocuments((prev) => {
              const next = { ...prev };
              delete next.pmdcCertificate;
              return next;
            });
            setDocumentNames((prev) => {
              const next = { ...prev };
              delete next.pmdcCertificate;
              return next;
            });
          }}
        />
        <VerificationDocumentUpload
          label="CNIC front"
          docKey="cnicFront"
          value={documents.cnicFront}
          fileName={documentNames.cnicFront}
          uploadUrl="/api/v1/doctor/verification/upload"
          onUploaded={(url, name) => {
            setDocuments((prev) => ({ ...prev, cnicFront: url }));
            setDocumentNames((prev) => ({ ...prev, cnicFront: name }));
          }}
          onClear={() => {
            setDocuments((prev) => {
              const next = { ...prev };
              delete next.cnicFront;
              return next;
            });
            setDocumentNames((prev) => {
              const next = { ...prev };
              delete next.cnicFront;
              return next;
            });
          }}
        />
        <VerificationDocumentUpload
          label="CNIC back"
          docKey="cnicBack"
          value={documents.cnicBack}
          fileName={documentNames.cnicBack}
          uploadUrl="/api/v1/doctor/verification/upload"
          onUploaded={(url, name) => {
            setDocuments((prev) => ({ ...prev, cnicBack: url }));
            setDocumentNames((prev) => ({ ...prev, cnicBack: name }));
          }}
          onClear={() => {
            setDocuments((prev) => {
              const next = { ...prev };
              delete next.cnicBack;
              return next;
            });
            setDocumentNames((prev) => {
              const next = { ...prev };
              delete next.cnicBack;
              return next;
            });
          }}
        />
        <VerificationDocumentUpload
          label="Degree certificate"
          docKey="degreeCertificate"
          value={documents.degreeCertificate}
          fileName={documentNames.degreeCertificate}
          uploadUrl="/api/v1/doctor/verification/upload"
          onUploaded={(url, name) => {
            setDocuments((prev) => ({ ...prev, degreeCertificate: url }));
            setDocumentNames((prev) => ({ ...prev, degreeCertificate: name }));
          }}
          onClear={() => {
            setDocuments((prev) => {
              const next = { ...prev };
              delete next.degreeCertificate;
              return next;
            });
            setDocumentNames((prev) => {
              const next = { ...prev };
              delete next.degreeCertificate;
              return next;
            });
          }}
        />
      </section>

      <section className="space-y-3 rounded-lg border border-amber-200/60 bg-amber-50/40 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Provider agreement</h2>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={acceptedAgreement}
            onChange={(e) => setAcceptedAgreement(e.target.checked)}
            className="mt-1"
            required
          />
          <span className="text-sm text-slate-700">
            I agree to the{" "}
            <Link
              href="/provider-agreement"
              target="_blank"
              className="font-medium text-brand hover:underline"
            >
              ZindagiCare Provider Platform Agreement
            </Link>
            . I will bring every patient I meet through ZindagiCare through the platform for
            booking and payment, and will not accept direct payment or take bookings
            off-platform. I understand that violating this may lead to account suspension,
            forfeiture of earnings, and legal action.
          </span>
        </label>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending} loading={pending}>
        {pending ? "Submitting…" : "Submit for admin review"}
      </Button>
    </form>
  );
}
