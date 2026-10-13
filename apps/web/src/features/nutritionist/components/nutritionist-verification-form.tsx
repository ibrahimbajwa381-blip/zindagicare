"use client";

import Link from "next/link";
import { useState } from "react";
import {
  NUTRITIONIST_SPECIALTIES_ALPHABETICAL,
  MAX_NUTRITIONIST_SPECIALTIES,
} from "@zindagi/shared";
import { useSafeRouter } from "@/lib/navigation/safe-router";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SpecialtyMultiSelect } from "@/components/forms/specialty-multi-select";
import { CitySelect } from "@/components/forms/city-select";
import { CityAreaSelect } from "@/components/forms/city-area-select";
import { VerificationDocumentUpload } from "@/components/forms/verification-document-upload";
import { NutritionistProfilePhotoUpload } from "@/features/nutritionist/components/nutritionist-profile-photo-upload";
import { formatDayOfWeek } from "@/features/nutritionist/types";
import { cityAreaError } from "@/lib/geo/city-area-error";

const UPLOAD_URL = "/api/v1/nutritionist/verification/upload";

const REQUIRED_DOCS = [
  "licenseCertificate",
  "degreeCertificate",
  "cnicFront",
  "cnicBack",
] as const;

type ClinicRow = { name: string; city: string; area: string; address: string };
type AvailabilityRow = {
  dayOfWeek: number;
  startTimeLocal: string;
  endTimeLocal: string;
};

type Props = {
  name: string;
  defaults?: {
    licenseNumber?: string;
    degree?: string;
    institute?: string;
    graduationYear?: number;
    experienceYears?: number;
    bio?: string;
    consultationFee?: number;
  };
};

export function NutritionistVerificationForm({ name, defaults }: Props) {
  const { push } = useSafeRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [documents, setDocuments] = useState<Record<string, string>>({});
  const [documentNames, setDocumentNames] = useState<Record<string, string>>({});
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [primarySpecialty, setPrimarySpecialty] = useState<string>("");
  const [additionalSpecialties, setAdditionalSpecialties] = useState<string[]>([]);
  const [languages, setLanguages] = useState("English, Urdu");
  const [clinics, setClinics] = useState<ClinicRow[]>([
    { name: "", city: "", area: "", address: "" },
  ]);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([
    { dayOfWeek: 1, startTimeLocal: "17:00", endTimeLocal: "21:00" },
  ]);
  const [acceptedAgreement, setAcceptedAgreement] = useState(false);

  function setDocument(key: string, url: string, fileName: string) {
    setDocuments((prev) => ({ ...prev, [key]: url }));
    setDocumentNames((prev) => ({ ...prev, [key]: fileName }));
  }

  function clearDocument(key: string) {
    setDocuments((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDocumentNames((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);

    for (const key of REQUIRED_DOCS) {
      if (!documents[key]) {
        setError("Please upload all required documents.");
        return;
      }
    }
    if (!avatarUrl) {
      setError("Please upload a profile photo.");
      return;
    }
    if (!primarySpecialty) {
      setError("Select your primary specialty.");
      return;
    }
    // Every named location needs both a city and an area.
    for (const [index, clinic] of clinics.entries()) {
      if (!clinic.name.trim()) continue;
      const locationError = cityAreaError(
        clinic.city,
        clinic.area,
        `for Location ${index + 1}`,
      );
      if (locationError) {
        setError(locationError);
        return;
      }
    }
    if (!clinics.some((clinic) => clinic.name.trim() && clinic.city.trim())) {
      setError("Add at least one practice location.");
      return;
    }
    if (!availability.length) {
      setError("Add at least one availability window.");
      return;
    }
    if (!acceptedAgreement) {
      setError("You must accept the ZindagiCare Provider Agreement to submit.");
      return;
    }

    setPending(true);
    const form = new FormData(e.currentTarget);

    const body = {
      licenseNumber: form.get("licenseNumber"),
      cnic: form.get("cnic"),
      degree: form.get("degree"),
      institute: form.get("institute"),
      graduationYear: form.get("graduationYear"),
      experienceYears: form.get("experienceYears"),
      avatarUrl,
      bio: form.get("bio") || undefined,
      consultationFee: form.get("consultationFee"),
      primarySpecialty,
      additionalSpecialties,
      languages: languages
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean),
      clinics: clinics
        .filter((clinic) => clinic.name.trim() && clinic.city.trim())
        .map((clinic) => ({
          name: clinic.name.trim(),
          city: clinic.city.trim(),
          area: clinic.area.trim() || undefined,
          address: clinic.address.trim() || undefined,
        })),
      videoConsultEnabled: true,
      documentUrls: {
        licenseCertificate: documents.licenseCertificate,
        degreeCertificate: documents.degreeCertificate,
        cnicFront: documents.cnicFront,
        cnicBack: documents.cnicBack,
      },
      weeklyAvailability: availability,
    };

    const res = await fetch("/api/v1/nutritionist/verification/submit", {
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

    push("/nutritionist/profile");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <NutritionistProfilePhotoUpload
        name={name}
        value={avatarUrl}
        onUploaded={setAvatarUrl}
        required
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Identity &amp; registration
        </h2>
        <div>
          <Label htmlFor="licenseNumber">
            Council registration number (e.g. PNDS / RD)
          </Label>
          <Input
            id="licenseNumber"
            name="licenseNumber"
            defaultValue={defaults?.licenseNumber}
            required
          />
        </div>
        <div>
          <Label htmlFor="cnic">CNIC (XXXXX-XXXXXXX-X)</Label>
          <Input id="cnic" name="cnic" placeholder="35202-1234567-1" required />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Qualifications</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="degree">Qualification (e.g. BS Nutrition, MSc Human Nutrition, RD)</Label>
            <Input
              id="degree"
              name="degree"
              defaultValue={defaults?.degree}
              required
            />
          </div>
          <div>
            <Label htmlFor="institute">Institute / college</Label>
            <Input
              id="institute"
              name="institute"
              defaultValue={defaults?.institute}
              required
            />
          </div>
          <div>
            <Label htmlFor="graduationYear">Graduation year</Label>
            <Input
              id="graduationYear"
              name="graduationYear"
              type="number"
              min={1950}
              max={new Date().getFullYear()}
              defaultValue={defaults?.graduationYear}
              required
            />
          </div>
          <div>
            <Label htmlFor="experienceYears">Years of experience</Label>
            <Input
              id="experienceYears"
              name="experienceYears"
              type="number"
              min={0}
              max={60}
              defaultValue={defaults?.experienceYears ?? 0}
              required
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Specialties</h2>
        <div>
          <Label htmlFor="primarySpecialty">Primary specialty</Label>
          <select
            id="primarySpecialty"
            value={primarySpecialty}
            onChange={(e) => setPrimarySpecialty(e.target.value)}
            required
            className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-base text-foreground shadow-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25 sm:h-10 sm:rounded-lg sm:px-3 sm:text-sm"
          >
            <option value="">Select your primary specialty</option>
            {NUTRITIONIST_SPECIALTIES_ALPHABETICAL.map((specialty) => (
              <option key={specialty} value={specialty}>
                {specialty}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="additionalSpecialties">Additional specialties</Label>
          <SpecialtyMultiSelect
            id="additionalSpecialties"
            values={additionalSpecialties}
            onChange={setAdditionalSpecialties}
            exclude={primarySpecialty ? [primarySpecialty] : []}
            max={MAX_NUTRITIONIST_SPECIALTIES - 1}
            options={NUTRITIONIST_SPECIALTIES_ALPHABETICAL}
            placeholder="Add additional specialties"
          />
          <p className="mt-1 text-xs text-slate-500">
            Optional. An admin verifies which specialties appear on your public
            profile.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Consultation details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="consultationFee">Video consultation fee (PKR)</Label>
            <Input
              id="consultationFee"
              name="consultationFee"
              type="number"
              min={500}
              defaultValue={defaults?.consultationFee || undefined}
              placeholder="e.g. 1500"
              required
            />
          </div>
          <div>
            <Label htmlFor="languages">Languages (comma separated)</Label>
            <Input
              id="languages"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="bio">About you</Label>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            maxLength={2000}
            defaultValue={defaults?.bio}
            placeholder="Tell patients about your practice, training, and approach."
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-foreground shadow-sm placeholder:text-slate-400 focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25"
          />
        </div>
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
          Nutritionist consultations on ZindagiCare are video-only. Home visits are
          not part of this role.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Practice locations
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setClinics((prev) => [
                ...prev,
                { name: "", city: "", area: "", address: "" },
              ])
            }
          >
            Add location
          </Button>
        </div>
        {clinics.map((clinic, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2"
          >
            <Input
              placeholder="Clinic name"
              value={clinic.name}
              onChange={(e) =>
                setClinics((prev) =>
                  prev.map((c, i) =>
                    i === index ? { ...c, name: e.target.value } : c,
                  ),
                )
              }
            />
            <CitySelect
              id={`clinic-city-${index}`}
              value={clinic.city}
              onChange={(city) =>
                setClinics((prev) =>
                  prev.map((c, i) =>
                    i !== index
                      ? c
                      : // A new city makes the old area meaningless, so clear it.
                        { ...c, city, area: city === c.city ? c.area : "" },
                  ),
                )
              }
            />
            <div className="sm:col-span-2">
              <CityAreaSelect
                id={`clinic-area-${index}`}
                city={clinic.city}
                value={clinic.area}
                onChange={(area) =>
                  setClinics((prev) =>
                    prev.map((c, i) => (i === index ? { ...c, area } : c)),
                  )
                }
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Input
                placeholder="Address (optional)"
                value={clinic.address}
                onChange={(e) =>
                  setClinics((prev) =>
                    prev.map((c, i) =>
                      i === index ? { ...c, address: e.target.value } : c,
                    ),
                  )
                }
              />
              {clinics.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setClinics((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Weekly availability
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setAvailability((prev) => [
                ...prev,
                { dayOfWeek: 1, startTimeLocal: "17:00", endTimeLocal: "21:00" },
              ])
            }
          >
            Add window
          </Button>
        </div>
        {availability.map((slot, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-4"
          >
            <select
              value={slot.dayOfWeek}
              onChange={(e) =>
                setAvailability((prev) =>
                  prev.map((s, i) =>
                    i === index ? { ...s, dayOfWeek: Number(e.target.value) } : s,
                  ),
                )
              }
              className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm shadow-sm sm:h-10 sm:rounded-lg"
            >
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <option key={day} value={day}>
                  {formatDayOfWeek(day)}
                </option>
              ))}
            </select>
            <Input
              type="time"
              value={slot.startTimeLocal}
              onChange={(e) =>
                setAvailability((prev) =>
                  prev.map((s, i) =>
                    i === index ? { ...s, startTimeLocal: e.target.value } : s,
                  ),
                )
              }
            />
            <Input
              type="time"
              value={slot.endTimeLocal}
              onChange={(e) =>
                setAvailability((prev) =>
                  prev.map((s, i) =>
                    i === index ? { ...s, endTimeLocal: e.target.value } : s,
                  ),
                )
              }
            />
            {availability.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setAvailability((prev) => prev.filter((_, i) => i !== index))
                }
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Verification documents
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Tap each box to choose a file, or drag and drop. JPG, PNG, WebP, or
            PDF (max 5 MB each).
          </p>
        </div>
        <VerificationDocumentUpload
          label="Council / license certificate"
          docKey="licenseCertificate"
          value={documents.licenseCertificate}
          fileName={documentNames.licenseCertificate}
          uploadUrl={UPLOAD_URL}
          onUploaded={(url, fileName) =>
            setDocument("licenseCertificate", url, fileName)
          }
          onClear={() => clearDocument("licenseCertificate")}
        />
        <VerificationDocumentUpload
          label="Degree certificate"
          docKey="degreeCertificate"
          value={documents.degreeCertificate}
          fileName={documentNames.degreeCertificate}
          uploadUrl={UPLOAD_URL}
          onUploaded={(url, fileName) =>
            setDocument("degreeCertificate", url, fileName)
          }
          onClear={() => clearDocument("degreeCertificate")}
        />
        <VerificationDocumentUpload
          label="CNIC front"
          docKey="cnicFront"
          value={documents.cnicFront}
          fileName={documentNames.cnicFront}
          uploadUrl={UPLOAD_URL}
          onUploaded={(url, fileName) => setDocument("cnicFront", url, fileName)}
          onClear={() => clearDocument("cnicFront")}
        />
        <VerificationDocumentUpload
          label="CNIC back"
          docKey="cnicBack"
          value={documents.cnicBack}
          fileName={documentNames.cnicBack}
          uploadUrl={UPLOAD_URL}
          onUploaded={(url, fileName) => setDocument("cnicBack", url, fileName)}
          onClear={() => clearDocument("cnicBack")}
        />
      </section>

      <section className="space-y-3 rounded-lg border border-amber-200/60 bg-amber-50/40 p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Provider agreement
        </h2>
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
            . I will bring every patient I meet through ZindagiCare through the
            platform for booking and payment, and will not accept direct payment
            or take bookings off-platform.
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
