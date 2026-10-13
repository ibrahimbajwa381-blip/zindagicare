"use client";

import Link from "next/link";
import { useState } from "react";
import {
  HOME_CARE_MATCH_RADIUS_KM,
  NURSE_HOME_VISIT_FEE_MAX,
  NURSE_HOME_VISIT_FEE_MIN,
  MAX_NURSING_SPECIALTIES,
  NURSING_HOME_VISIT_SPLIT as SPLIT,
  NURSING_SPECIALTIES_ALPHABETICAL,
} from "@zindagi/shared";
import { useSafeRouter } from "@/lib/navigation/safe-router";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { CitySelect } from "@/components/forms/city-select";
import { CityAreaSelect } from "@/components/forms/city-area-select";
import { GeoLocationPicker } from "@/components/forms/geo-location-picker";
import { SpecialtyMultiSelect } from "@/components/forms/specialty-multi-select";
import { VerificationDocumentUpload } from "@/components/forms/verification-document-upload";
import { NurseProfilePhotoUpload } from "@/features/nurse/components/nurse-profile-photo-upload";
import type { GeoCoordinates } from "@/lib/geo/parse-google-maps-url";

type NurseVerificationFormProps = {
  name: string;
  defaults?: {
    avatarUrl?: string;
    licenseNumber?: string;
    qualification?: string;
    experienceYears?: number;
    homeVisitFee?: number;
    city?: string;
    area?: string;
    bankAccount?: {
      accountTitle?: string;
      bankName?: string;
      accountNumber?: string;
      iban?: string;
    };
  };
};

export function NurseVerificationForm({
  name,
  defaults,
}: NurseVerificationFormProps) {
  const { push } = useSafeRouter();
  const [error, setError] = useState<string>();
  const [city, setCity] = useState(defaults?.city ?? "Lahore");
  const [area, setArea] = useState(defaults?.area ?? "");
  const [pending, setPending] = useState(false);
  const [documents, setDocuments] = useState<Record<string, string>>({});
  const [documentNames, setDocumentNames] = useState<Record<string, string>>({});
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(defaults?.avatarUrl);
  const [homeVisitEnabled, setHomeVisitEnabled] = useState(false);
  const [geo, setGeo] = useState<GeoCoordinates | null>(null);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [acceptedAgreement, setAcceptedAgreement] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(e.currentTarget);

    if (!avatarUrl) {
      setError("Please upload a profile photo.");
      setPending(false);
      return;
    }

    const requiredDocs = ["licenseCertificate", "cnicFront", "cnicBack"] as const;
    for (const key of requiredDocs) {
      if (!documents[key]) {
        setError("Please upload all required documents.");
        setPending(false);
        return;
      }
    }

    if (!city.trim()) {
      setError("Select your city.");
      setPending(false);
      return;
    }

    if (area.trim().length < 2) {
      setError("Select or type your area.");
      setPending(false);
      return;
    }

    if (homeVisitEnabled && !geo) {
      setError("Please add your Google Maps location for in-house visit matching.");
      setPending(false);
      return;
    }

    if (!specialties.length) {
      setError("Select at least one nursing specialty.");
      setPending(false);
      return;
    }

    if (!acceptedAgreement) {
      setError("You must accept the ZindagiCare Provider Agreement to submit.");
      setPending(false);
      return;
    }

    const body = {
      licenseNumber: form.get("licenseNumber"),
      cnic: form.get("cnic"),
      qualification: form.get("qualification"),
      experienceYears: form.get("experienceYears"),
      homeVisitFee: form.get("homeVisitFee"),
      specialties,
      avatarUrl,
      serviceArea: {
        city: city.trim(),
        area: area.trim(),
        homeVisitEnabled,
        geo: geo ?? undefined,
      },
      documentUrls: {
        licenseCertificate: documents.licenseCertificate,
        cnicFront: documents.cnicFront,
        cnicBack: documents.cnicBack,
      },
      bankAccount: {
        accountTitle: String(form.get("bankAccountTitle") ?? "").trim(),
        bankName: String(form.get("bankName") ?? "").trim(),
        accountNumber: String(form.get("bankAccountNumber") ?? "").trim(),
        iban: String(form.get("bankIban") ?? "").trim() || undefined,
      },
      acceptedProviderAgreement: acceptedAgreement,
    };

    const res = await fetch("/api/v1/nurse/verification/submit", {
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

    push("/nurse/verification");
  }

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

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <NurseProfilePhotoUpload
        name={name}
        value={avatarUrl}
        onUploaded={setAvatarUrl}
        required
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Identity & registration</h2>
        <div>
          <Label htmlFor="licenseNumber">
            Nursing license / PNC registration number
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
        <div>
          <Label htmlFor="qualification">
            Qualification (e.g. BSN, General Nursing diploma)
          </Label>
          <Input
            id="qualification"
            name="qualification"
            defaultValue={defaults?.qualification}
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
        <div>
          <Label htmlFor="homeVisitFee">Your fee per general nursing visit (Rs.)</Label>
          <Input
            id="homeVisitFee"
            name="homeVisitFee"
            type="number"
            inputMode="numeric"
            min={NURSE_HOME_VISIT_FEE_MIN}
            max={NURSE_HOME_VISIT_FEE_MAX}
            step={50}
            defaultValue={defaults?.homeVisitFee}
            placeholder="e.g. 2000"
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            Required. Set your own fee between Rs. {NURSE_HOME_VISIT_FEE_MIN.toLocaleString()} and Rs.{" "}
            {NURSE_HOME_VISIT_FEE_MAX.toLocaleString()}. Patients who book you for a nursing visit pay this amount (IV drips, injections and wound care use standard rates).
          </p>
        </div>
        <div>
          <Label htmlFor="specialties">Specialties</Label>
          <SpecialtyMultiSelect
            id="specialties"
            values={specialties}
            onChange={setSpecialties}
            max={MAX_NURSING_SPECIALTIES}
            options={NURSING_SPECIALTIES_ALPHABETICAL}
            placeholder="Add your nursing specialties"
          />
          <p className="mt-1 text-xs text-slate-500">
            Required. Select up to {MAX_NURSING_SPECIALTIES} areas of nursing you
            specialize in.
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-brand-light/30 bg-brand-light/5 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Service area & in-house visits</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="city">City</Label>
            <CitySelect
              id="city"
              value={city}
              onChange={(next) => {
                // A new city makes the old area meaningless, so clear it.
                if (next !== city) setArea("");
                setCity(next);
              }}
              className="mt-1"
            />
          </div>
          {city.trim() && (
            <CityAreaSelect id="area" city={city} value={area} onChange={setArea} required />
          )}
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
              I am available for in-house visits within {HOME_CARE_MATCH_RADIUS_KM} km of my
              area
            </p>
            <p className="text-xs text-slate-600">
              When enabled, admin dispatch will auto-match you to nearby patient home visits
              based on your saved location.
            </p>
          </div>
        </label>

        {homeVisitEnabled && (
          <GeoLocationPicker
            id="nurse-verification-geo"
            value={geo}
            onChange={setGeo}
            required
          />
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
          label="Nursing license / PNC certificate"
          docKey="licenseCertificate"
          value={documents.licenseCertificate}
          fileName={documentNames.licenseCertificate}
          uploadUrl="/api/v1/nurse/verification/upload"
          onUploaded={(url, name) => setDocument("licenseCertificate", url, name)}
          onClear={() => clearDocument("licenseCertificate")}
        />
        <VerificationDocumentUpload
          label="CNIC front"
          docKey="cnicFront"
          value={documents.cnicFront}
          fileName={documentNames.cnicFront}
          uploadUrl="/api/v1/nurse/verification/upload"
          onUploaded={(url, name) => setDocument("cnicFront", url, name)}
          onClear={() => clearDocument("cnicFront")}
        />
        <VerificationDocumentUpload
          label="CNIC back"
          docKey="cnicBack"
          value={documents.cnicBack}
          fileName={documentNames.cnicBack}
          uploadUrl="/api/v1/nurse/verification/upload"
          onUploaded={(url, name) => setDocument("cnicBack", url, name)}
          onClear={() => clearDocument("cnicBack")}
        />
      </section>

      <section className="space-y-4 rounded-lg border border-emerald-200/70 bg-emerald-50/40 p-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Payout account</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            You keep {SPLIT.nursePercent}% of every visit fee and ZindagiCare keeps{" "}
            {SPLIT.platformPercent}%. Your earnings are sent to this account every Sunday.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="bankAccountTitle">Account title</Label>
            <Input
              id="bankAccountTitle"
              name="bankAccountTitle"
              defaultValue={defaults?.bankAccount?.accountTitle}
              placeholder="Name on the account"
              required
              minLength={2}
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="bankName">Bank / wallet name</Label>
            <Input
              id="bankName"
              name="bankName"
              defaultValue={defaults?.bankAccount?.bankName}
              placeholder="e.g. Meezan Bank, JazzCash"
              required
              minLength={2}
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="bankAccountNumber">Account number</Label>
            <Input
              id="bankAccountNumber"
              name="bankAccountNumber"
              defaultValue={defaults?.bankAccount?.accountNumber}
              inputMode="numeric"
              required
              minLength={4}
              maxLength={40}
            />
          </div>
          <div>
            <Label htmlFor="bankIban">IBAN (optional)</Label>
            <Input
              id="bankIban"
              name="bankIban"
              defaultValue={defaults?.bankAccount?.iban}
              placeholder="PK36SCBL0000001123456702"
              maxLength={40}
            />
          </div>
        </div>
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
