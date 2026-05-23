"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SPECIALTIES } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function DoctorVerificationForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [specialty, setSpecialty] = useState<string>(
    SPECIALTIES[0] ?? "General Physician",
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(e.currentTarget);

    const body = {
      pmdcNumber: form.get("pmdcNumber"),
      cnic: form.get("cnic"),
      medicalDegree: form.get("medicalDegree"),
      medicalCollege: form.get("medicalCollege"),
      graduationYear: form.get("graduationYear"),
      experienceYears: form.get("experienceYears"),
      specialties: [specialty],
      bio: form.get("bio") || undefined,
      consultationFee: form.get("consultationFee") || 0,
      hospitals: [
        {
          name: form.get("hospitalName"),
          city: form.get("hospitalCity"),
          address: form.get("hospitalAddress") || undefined,
        },
      ],
      documentUrls: {
        pmdcCertificate: form.get("pmdcCertificateUrl"),
        cnicFront: form.get("cnicFrontUrl"),
        cnicBack: form.get("cnicBackUrl"),
        degreeCertificate: form.get("degreeCertificateUrl"),
      },
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

    router.push("/doctor/verification?submitted=1");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Identity & PMDC</h2>
        <div>
          <Label htmlFor="pmdcNumber">PMDC registration number</Label>
          <Input id="pmdcNumber" name="pmdcNumber" required />
        </div>
        <div>
          <Label htmlFor="cnic">CNIC (XXXXX-XXXXXXX-X)</Label>
          <Input id="cnic" name="cnic" placeholder="35202-1234567-1" required />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Qualifications</h2>
        <div>
          <Label htmlFor="medicalDegree">Degree (e.g. MBBS)</Label>
          <Input id="medicalDegree" name="medicalDegree" required />
        </div>
        <div>
          <Label htmlFor="medicalCollege">Medical college</Label>
          <Input id="medicalCollege" name="medicalCollege" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="graduationYear">Graduation year</Label>
            <Input id="graduationYear" name="graduationYear" type="number" required />
          </div>
          <div>
            <Label htmlFor="experienceYears">Years of experience</Label>
            <Input id="experienceYears" name="experienceYears" type="number" defaultValue={0} required />
          </div>
        </div>
        <div>
          <Label htmlFor="specialty">Primary specialty</Label>
          <select
            id="specialty"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
          >
            {SPECIALTIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="bio">Professional bio</Label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Practice</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="hospitalName">Hospital / clinic name</Label>
            <Input id="hospitalName" name="hospitalName" required />
          </div>
          <div>
            <Label htmlFor="hospitalCity">City</Label>
            <Input id="hospitalCity" name="hospitalCity" defaultValue="Lahore" required />
          </div>
        </div>
        <div>
          <Label htmlFor="hospitalAddress">Address</Label>
          <Input id="hospitalAddress" name="hospitalAddress" />
        </div>
        <div>
          <Label htmlFor="consultationFee">Consultation fee (PKR)</Label>
          <Input id="consultationFee" name="consultationFee" type="number" min={0} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Documents (Supabase URLs)</h2>
        <p className="text-xs text-slate-500">
          Upload files to secure storage first, then paste the signed URLs here.
        </p>
        <DocumentUrlField label="PMDC certificate" name="pmdcCertificateUrl" />
        <DocumentUrlField label="CNIC front" name="cnicFrontUrl" />
        <DocumentUrlField label="CNIC back" name="cnicBackUrl" />
        <DocumentUrlField label="Degree certificate" name="degreeCertificateUrl" />
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Submitting…" : "Submit for admin review"}
      </Button>
    </form>
  );
}

function DocumentUrlField({ label, name }: { label: string; name: string }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="url" placeholder="https://..." required />
    </div>
  );
}
