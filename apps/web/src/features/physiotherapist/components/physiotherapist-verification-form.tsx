"use client";

import { useState } from "react";
import { HOME_CARE_MATCH_RADIUS_KM } from "@zindagi/shared";
import { useSafeRouter } from "@/lib/navigation/safe-router";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { GeoLocationPicker } from "@/components/forms/geo-location-picker";
import { VerificationDocumentUpload } from "@/components/forms/verification-document-upload";
import type { GeoCoordinates } from "@/lib/geo/parse-google-maps-url";

type PhysiotherapistVerificationFormProps = {
  defaults?: {
    licenseNumber?: string;
    qualification?: string;
    experienceYears?: number;
    city?: string;
    area?: string;
  };
};

export function PhysiotherapistVerificationForm({ defaults }: PhysiotherapistVerificationFormProps) {
  const { push } = useSafeRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [documents, setDocuments] = useState<Record<string, string>>({});
  const [documentNames, setDocumentNames] = useState<Record<string, string>>({});
  const [homeVisitEnabled, setHomeVisitEnabled] = useState(false);
  const [geo, setGeo] = useState<GeoCoordinates | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(e.currentTarget);

    const requiredDocs = ["licenseCertificate", "cnicFront", "cnicBack"] as const;
    for (const key of requiredDocs) {
      if (!documents[key]) {
        setError("Please upload all required documents.");
        setPending(false);
        return;
      }
    }

    if (homeVisitEnabled && !geo) {
      setError("Please add your Google Maps location for in-house visit matching.");
      setPending(false);
      return;
    }

    const body = {
      licenseNumber: form.get("licenseNumber"),
      cnic: form.get("cnic"),
      qualification: form.get("qualification"),
      experienceYears: form.get("experienceYears"),
      serviceArea: {
        city: form.get("city"),
        area: form.get("area"),
        homeVisitEnabled,
        geo: geo ?? undefined,
      },
      documentUrls: {
        licenseCertificate: documents.licenseCertificate,
        cnicFront: documents.cnicFront,
        cnicBack: documents.cnicBack,
      },
    };

    const res = await fetch("/api/v1/physiotherapist/verification/submit", {
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

    push("/physiotherapist/verification");
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
      </section>

      <section className="space-y-4 rounded-lg border border-brand-light/30 bg-brand-light/5 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Service area & in-house visits</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              name="city"
              defaultValue={defaults?.city ?? "Lahore"}
              required
              minLength={2}
            />
          </div>
          <div>
            <Label htmlFor="area">Area / neighborhood</Label>
            <Input
              id="area"
              name="area"
              defaultValue={defaults?.area}
              placeholder="e.g. DHA Phase 5, Gulberg"
              required
              minLength={2}
            />
          </div>
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
            id="Physiotherapist-verification-geo"
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
          uploadUrl="/api/v1/physiotherapist/verification/upload"
          onUploaded={(url, name) => setDocument("licenseCertificate", url, name)}
          onClear={() => clearDocument("licenseCertificate")}
        />
        <VerificationDocumentUpload
          label="CNIC front"
          docKey="cnicFront"
          value={documents.cnicFront}
          fileName={documentNames.cnicFront}
          uploadUrl="/api/v1/physiotherapist/verification/upload"
          onUploaded={(url, name) => setDocument("cnicFront", url, name)}
          onClear={() => clearDocument("cnicFront")}
        />
        <VerificationDocumentUpload
          label="CNIC back"
          docKey="cnicBack"
          value={documents.cnicBack}
          fileName={documentNames.cnicBack}
          uploadUrl="/api/v1/physiotherapist/verification/upload"
          onUploaded={(url, name) => setDocument("cnicBack", url, name)}
          onClear={() => clearDocument("cnicBack")}
        />
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending} loading={pending}>
        {pending ? "Submitting…" : "Submit for admin review"}
      </Button>
    </form>
  );
}
