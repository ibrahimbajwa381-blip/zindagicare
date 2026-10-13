"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { CalendarHeart, Clock, Home, Plus, Trash2 } from "lucide-react";
import {
  HOME_CARE_MATCH_RADIUS_KM,
  SPECIALTIES,
  VerificationStatuses,
} from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { TimePicker, formatTime12h } from "@/components/ui/time-picker";
import { DoctorSpecialtyFields } from "@/components/forms/doctor-specialty-fields";
import { GeoLocationPicker } from "@/components/forms/geo-location-picker";
import { CitySelect } from "@/components/forms/city-select";
import { CityAreaSelect } from "@/components/forms/city-area-select";
import { previewSundaySlots } from "@/lib/sunday/display";
import type { GeoCoordinates } from "@/lib/geo/parse-google-maps-url";
import type { DoctorProfileDto } from "@/features/doctor/types";
import { DoctorProfilePhotoUpload } from "@/features/doctor/components/doctor-profile-photo-upload";
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

type AvailabilityDay = {
  enabled: boolean;
  startTimeLocal: string;
  endTimeLocal: string;
};

type HospitalRow = {
  name: string;
  city: string;
  area: string;
  address: string;
};

function buildAvailabilityFromProfile(
  weeklyAvailability: DoctorProfileDto["weeklyAvailability"],
): Record<number, AvailabilityDay> {
  const base: Record<number, AvailabilityDay> = {
    1: { enabled: false, startTimeLocal: "16:00", endTimeLocal: "20:00" },
    2: { enabled: false, startTimeLocal: "16:00", endTimeLocal: "20:00" },
    3: { enabled: false, startTimeLocal: "16:00", endTimeLocal: "20:00" },
    4: { enabled: false, startTimeLocal: "16:00", endTimeLocal: "20:00" },
    5: { enabled: false, startTimeLocal: "16:00", endTimeLocal: "20:00" },
    6: { enabled: false, startTimeLocal: "10:00", endTimeLocal: "14:00" },
    0: { enabled: false, startTimeLocal: "10:00", endTimeLocal: "14:00" },
  };

  for (const slot of weeklyAvailability) {
    base[slot.dayOfWeek] = {
      enabled: true,
      startTimeLocal: slot.startTimeLocal,
      endTimeLocal: slot.endTimeLocal,
    };
  }

  return base;
}

type Props = {
  profile: DoctorProfileDto;
  /** PATCH endpoint — defaults to doctor self-edit API. */
  apiEndpoint?: string;
  /** Where to go after a successful save. */
  successRedirect?: string;
  /** Update the signed-in session name/avatar (doctor self-edit only). */
  syncSession?: boolean;
  /** Allow editing PMDC, degree, college, and experience (admin). */
  allowCredentialEdit?: boolean;
  /** Avatar upload endpoint — defaults to doctor self-serve upload. */
  avatarUploadEndpoint?: string;
};

export function DoctorProfileEditForm({
  profile,
  apiEndpoint = "/api/v1/doctor/profile",
  successRedirect = "/doctor/profile",
  syncSession = true,
  allowCredentialEdit = false,
  avatarUploadEndpoint,
}: Props) {
  const router = useRouter();
  const { update } = useSession();
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  const [pending, setPending] = useState(false);

  const [name, setName] = useState(profile.user.name);
  const [phone, setPhone] = useState(profile.user.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.user.avatarUrl ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [pmdcNumber, setPmdcNumber] = useState(profile.pmdcNumber ?? "");
  const [medicalDegree, setMedicalDegree] = useState(profile.medicalDegree ?? "");
  const [qualifications, setQualifications] = useState(
    (profile.qualifications ?? []).join(", "),
  );
  const [medicalCollege, setMedicalCollege] = useState(profile.medicalCollege ?? "");
  const [graduationYear, setGraduationYear] = useState(
    profile.graduationYear ? String(profile.graduationYear) : "",
  );
  const [experienceYears, setExperienceYears] = useState(
    String(profile.experienceYears ?? 0),
  );
  const [primarySpecialty, setPrimarySpecialty] = useState(
    profile.primarySpecialty ??
      profile.specialties[0] ??
      SPECIALTIES.find((item) => item === "General Physician") ??
      SPECIALTIES[0] ??
      "",
  );
  const [additionalSpecialties, setAdditionalSpecialties] = useState(
    profile.additionalSpecialties?.length
      ? profile.additionalSpecialties
      : profile.specialties.slice(1),
  );
  const [consultationFee, setConsultationFee] = useState(
    String(profile.consultationFee ?? 0),
  );
  const [languages, setLanguages] = useState(profile.languages.join(", "));
  const [hospitals, setHospitals] = useState<HospitalRow[]>(
    profile.hospitals.length
      ? profile.hospitals.map((h) => ({
          name: h.name,
          city: h.city,
          area: h.area ?? "",
          address: h.address ?? "",
        }))
      : [{ name: "", city: "", area: "", address: "" }],
  );
  const [availability, setAvailability] = useState(() =>
    buildAvailabilityFromProfile(profile.weeklyAvailability),
  );
  const [sundayEnabled, setSundayEnabled] = useState(profile.sundayConsult.enabled);
  const [sundayStart, setSundayStart] = useState(
    profile.sundayConsult.startTimeLocal ?? "16:00",
  );
  const [sundayEnd, setSundayEnd] = useState(
    profile.sundayConsult.endTimeLocal ?? "18:00",
  );
  const [slotDurationMins, setSlotDurationMins] = useState(
    profile.sundayConsult.slotDurationMins ?? 10,
  );
  const [homeVisitEnabled, setHomeVisitEnabled] = useState(profile.homeVisit.enabled);
  const [homeVisitArea, setHomeVisitArea] = useState(profile.homeVisit.area ?? "");
  const [homeVisitGeo, setHomeVisitGeo] = useState<GeoCoordinates | null>(
    profile.homeVisit.geo ?? null,
  );

  function updateAvailability(day: number, patch: Partial<AvailabilityDay>) {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
  }

  function updateHospital(index: number, patch: Partial<HospitalRow>) {
    setHospitals((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addHospital() {
    setHospitals((prev) => [...prev, { name: "", city: "", area: "", address: "" }]);
  }

  function removeHospital(index: number) {
    setHospitals((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  const sundaySlotPreview = useMemo(() => {
    if (!sundayEnabled) return [];
    return previewSundaySlots(sundayStart, sundayEnd, slotDurationMins);
  }, [sundayEnabled, sundayStart, sundayEnd, slotDurationMins]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    setFieldError(undefined);

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

    // Every named location needs both a city and an area.
    for (const [index, h] of hospitals.entries()) {
      if (!h.name.trim()) continue;
      const locationError = cityAreaError(h.city, h.area, `for Location ${index + 1}`);
      if (locationError) {
        setError(locationError);
        setPending(false);
        return;
      }
    }

    const cleanedHospitals = hospitals
      .map((h) => ({
        name: h.name.trim(),
        city: h.city.trim(),
        // Sent even when empty so clearing the area removes the saved one.
        area: h.area.trim(),
        address: h.address.trim() || undefined,
      }))
      .filter((h) => h.name && h.city);

    if (!cleanedHospitals.length) {
      setError("Add at least one practice location.");
      setPending(false);
      return;
    }

    const languageList = languages
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!languageList.length) {
      setError("Add at least one language.");
      setPending(false);
      return;
    }

    if (!primarySpecialty.trim()) {
      setError("Select your primary specialty.");
      setPending(false);
      return;
    }

    if (homeVisitEnabled) {
      if (homeVisitArea.trim().length < 2) {
        setError("Add your service area for in-house visits (e.g. DHA Phase 5, Gulberg).");
        setPending(false);
        return;
      }
      if (!homeVisitGeo) {
        setError("Add your location for in-house visit matching.");
        setPending(false);
        return;
      }
    }

    const feeValue = Number(consultationFee) || 0;
    if (feeValue < 500) {
      setError("Consultation fee must be at least PKR 500.");
      setPending(false);
      return;
    }

    const body = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      ...(avatarUrl && avatarUrl !== profile.user.avatarUrl
        ? { avatarUrl }
        : {}),
      bio: bio.trim() || null,
      consultationFee: feeValue,
      experienceYears: Number(experienceYears) || 0,
      primarySpecialty,
      additionalSpecialties,
      languages: languageList,
      hospitals: cleanedHospitals,
      weeklyAvailability,
      homeVisit: {
        enabled: homeVisitEnabled,
        area: homeVisitArea.trim() || undefined,
        geo: homeVisitGeo ?? undefined,
      },
      sundayConsult: {
        enabled: sundayEnabled,
        startTimeLocal: sundayEnabled ? sundayStart : undefined,
        endTimeLocal: sundayEnabled ? sundayEnd : undefined,
        slotDurationMins,
      },
      ...(allowCredentialEdit
        ? {
            pmdcNumber: pmdcNumber.trim() || undefined,
            medicalDegree: medicalDegree.trim() || undefined,
            qualifications: qualifications
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            medicalCollege: medicalCollege.trim() || undefined,
            graduationYear: graduationYear ? Number(graduationYear) : undefined,
          }
        : {}),
    };

    const res = await fetch(apiEndpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setPending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = data?.error?.message ?? "Could not save profile. Check your inputs.";
      setError(message);
      if (data?.error?.field) {
        setFieldError(data.error.field);
      }
      return;
    }

    if (syncSession) {
      await update({
        name: name.trim(),
        ...(avatarUrl && avatarUrl !== profile.user.avatarUrl
          ? { image: avatarUrl }
          : {}),
      });
    }
    router.push(successRedirect);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {allowCredentialEdit ? (
        <section className="space-y-4">
          <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Admin profile correction</p>
            <p className="mt-1">
              You can fix any field on this doctor&apos;s profile, including credentials
              doctors cannot change themselves.
            </p>
          </div>
          <h2 className="text-sm font-semibold text-slate-900">Credentials</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pmdcNumber">PMDC number</Label>
              <Input
                id="pmdcNumber"
                value={pmdcNumber}
                onChange={(e) => setPmdcNumber(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="medicalDegree">Medical degree</Label>
              <Input
                id="medicalDegree"
                value={medicalDegree}
                onChange={(e) => setMedicalDegree(e.target.value)}
                placeholder="MBBS"
              />
            </div>
            <div>
              <Label htmlFor="medicalCollege">Medical college</Label>
              <Input
                id="medicalCollege"
                value={medicalCollege}
                onChange={(e) => setMedicalCollege(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="graduationYear">Graduation year</Label>
              <Input
                id="graduationYear"
                type="number"
                min={1950}
                max={new Date().getFullYear()}
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="qualifications">Additional qualifications</Label>
              <Input
                id="qualifications"
                value={qualifications}
                onChange={(e) => setQualifications(e.target.value)}
                placeholder="FCPS, MCPS"
              />
              <p className="mt-1 text-xs text-slate-500">Comma-separated</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">Credentials are read-only</p>
          <p className="mt-1">
            PMDC ({profile.pmdcNumber ?? "—"}), degree, and verification documents cannot
            be changed here. Contact support if your credentials need updating.
          </p>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Profile photo</h2>
        <DoctorProfilePhotoUpload
          name={name}
          value={avatarUrl || undefined}
          onUploaded={setAvatarUrl}
          uploadEndpoint={avatarUploadEndpoint}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Contact & bio</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="phone">Mobile number</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03001234567"
            />
            {fieldError === "phone" && (
              <FieldError message="This phone number is already registered." />
            )}
          </div>
        </div>
        <DoctorSpecialtyFields
          primarySpecialty={primarySpecialty}
          additionalSpecialties={additionalSpecialties}
          onPrimaryChange={setPrimarySpecialty}
          onAdditionalChange={setAdditionalSpecialties}
          verifiedSpecialties={profile.specialties}
          showVerificationHint={
            !allowCredentialEdit &&
            (profile.verificationStatus === VerificationStatuses.APPROVED ||
              profile.verificationStatus === VerificationStatuses.PENDING)
          }
          allowCustomPrimary
        />
        <div>
          <Label htmlFor="bio">Professional bio</Label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Brief summary of your practice and expertise"
          />
        </div>
        <div>
          <Label htmlFor="experienceYears">Years of experience</Label>
          <Input
            id="experienceYears"
            type="number"
            min={0}
            max={60}
            value={experienceYears}
            onChange={(e) => setExperienceYears(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <div>
          <Label htmlFor="languages">Languages (comma-separated)</Label>
          <Input
            id="languages"
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
            placeholder="English, Urdu"
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Practice locations</h2>
          <Button type="button" variant="outline" size="sm" onClick={addHospital}>
            <Plus className="mr-1 h-4 w-4" />
            Add location
          </Button>
        </div>
        <div className="space-y-3">
          {hospitals.map((hospital, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Location {index + 1}
                </p>
                {hospitals.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => removeHospital(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`hospital-name-${index}`}>Hospital / clinic</Label>
                  <Input
                    id={`hospital-name-${index}`}
                    value={hospital.name}
                    onChange={(e) => updateHospital(index, { name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor={`hospital-city-${index}`}>City</Label>
                  <CitySelect
                    id={`hospital-city-${index}`}
                    value={hospital.city}
                    onChange={(city) =>
                      // A new city makes the old area meaningless, so clear it.
                      updateHospital(index, city === hospital.city ? { city } : { city, area: "" })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="mt-3">
                <CityAreaSelect
                  id={`hospital-area-${index}`}
                  city={hospital.city}
                  value={hospital.area}
                  onChange={(area) => updateHospital(index, { area })}
                />
              </div>
              <div className="mt-3">
                <Label htmlFor={`hospital-address-${index}`}>Address</Label>
                <Input
                  id={`hospital-address-${index}`}
                  value={hospital.address}
                  onChange={(e) => updateHospital(index, { address: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
        <div>
          <Label htmlFor="consultationFee">Consultation fee (PKR)</Label>
          <Input
            id="consultationFee"
            type="number"
            min={500}
            value={consultationFee}
            onChange={(e) => setConsultationFee(e.target.value)}
            className="max-w-xs"
          />
        </div>
      </section>

      <section className="space-y-4 overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/80 via-white to-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Home className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">In-house visit service</h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Offer doctor home visits in your city. Admin assigns you to nearby patient requests
              when you are the nearest available doctor within {HOME_CARE_MATCH_RADIUS_KM} km.
            </p>
          </div>
        </div>

        <div>
          <Label htmlFor="homeVisitArea">Service area / neighborhood</Label>
          <Input
            id="homeVisitArea"
            value={homeVisitArea}
            onChange={(e) => setHomeVisitArea(e.target.value)}
            placeholder="e.g. DHA Phase 5, Gulberg — where you can travel for home visits"
            disabled={!homeVisitEnabled}
            className="mt-1"
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
              Turn this on to receive home visit assignments from admin dispatch.
            </p>
          </div>
        </label>

        {homeVisitEnabled && (
          <GeoLocationPicker
            id="doctor-profile-home-visit-geo"
            value={homeVisitGeo}
            onChange={setHomeVisitGeo}
            required
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Weekly availability</h2>
        <p className="text-xs text-slate-500">
          When are you available for paid online or clinic consultations?
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
              Free Sunday online consultation
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              Patients can book free slots on the Sunday consult page when this is enabled.
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

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending} loading={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
