"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { SPECIALTIES } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatTime12h, TimePicker } from "@/components/ui/time-picker";

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

const DEFAULT_AVAILABILITY: Record<number, AvailabilityDay> = {
  1: { enabled: true, startTimeLocal: "16:00", endTimeLocal: "20:00" },
  2: { enabled: true, startTimeLocal: "16:00", endTimeLocal: "20:00" },
  3: { enabled: true, startTimeLocal: "16:00", endTimeLocal: "20:00" },
  4: { enabled: true, startTimeLocal: "16:00", endTimeLocal: "20:00" },
  5: { enabled: true, startTimeLocal: "16:00", endTimeLocal: "20:00" },
  6: { enabled: false, startTimeLocal: "10:00", endTimeLocal: "14:00" },
  0: { enabled: false, startTimeLocal: "10:00", endTimeLocal: "14:00" },
};

function previewSundaySlots(
  start: string,
  end: string,
  durationMins: number,
): string[] {
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;
  const slots: string[] = [];
  for (let t = startTotal; t + durationMins <= endTotal; t += durationMins) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    const slotStart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const endSlot = t + durationMins;
    const eh = Math.floor(endSlot / 60);
    const em = endSlot % 60;
    const slotEnd = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    slots.push(`${formatTime12h(slotStart)} – ${formatTime12h(slotEnd)}`);
  }
  return slots;
}

export function DoctorVerificationForm() {
  const router = useRouter();
  const { update } = useSession();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [specialty, setSpecialty] = useState<string>(
    SPECIALTIES[0] ?? "General Physician",
  );
  const [availability, setAvailability] = useState(DEFAULT_AVAILABILITY);
  const [sundayEnabled, setSundayEnabled] = useState(false);
  const [sundayStart, setSundayStart] = useState("16:00");
  const [sundayEnd, setSundayEnd] = useState("18:00");
  const [slotDurationMins, setSlotDurationMins] = useState(10);
  const [documents, setDocuments] = useState<Record<string, string>>({});

  function updateAvailability(
    day: number,
    patch: Partial<AvailabilityDay>,
  ) {
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
    const form = new FormData(e.currentTarget);

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

    await update({
      doctorVerificationStatus: "pending",
    });

    router.push("/doctor/profile?submitted=1");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
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
            <Input
              id="experienceYears"
              name="experienceYears"
              type="number"
              defaultValue={0}
              required
            />
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
            placeholder="Brief summary of your practice and expertise"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Practice location</h2>
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

      <section className="space-y-3 rounded-lg border border-brand-light/30 bg-brand-light/5 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={sundayEnabled}
            onChange={(e) => setSundayEnabled(e.target.checked)}
            className="mt-1"
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Offer free Sunday online consultation (optional)
            </p>
            <p className="text-xs text-slate-600">
              Patients will see bookable slots under your specialty on the Sunday
              consult page after admin approval.
            </p>
          </div>
        </label>

        {sundayEnabled && (
          <div className="space-y-3 pl-7">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="sunday-start">From</Label>
                <TimePicker
                  id="sunday-start"
                  value={sundayStart}
                  onChange={setSundayStart}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="sunday-end">To</Label>
                <TimePicker
                  id="sunday-end"
                  value={sundayEnd}
                  onChange={setSundayEnd}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Slot duration (mins)</Label>
                <Input
                  type="number"
                  min={5}
                  max={60}
                  value={slotDurationMins}
                  onChange={(e) => setSlotDurationMins(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
            {sundaySlotPreview.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-700">
                  Slots patients will see ({sundaySlotPreview.length} total):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sundaySlotPreview.map((slot) => (
                    <Badge key={slot} variant="secondary">
                      {slot}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-700">
                Adjust your time window — end time must be after start time.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Verification documents</h2>
        <p className="text-xs text-slate-500">
          Upload JPG, PNG, WebP, or PDF files (max 5 MB each).
        </p>
        <DocumentUploadField
          label="PMDC certificate"
          docKey="pmdcCertificate"
          value={documents.pmdcCertificate}
          onUploaded={(url) =>
            setDocuments((prev) => ({ ...prev, pmdcCertificate: url }))
          }
        />
        <DocumentUploadField
          label="CNIC front"
          docKey="cnicFront"
          value={documents.cnicFront}
          onUploaded={(url) => setDocuments((prev) => ({ ...prev, cnicFront: url }))}
        />
        <DocumentUploadField
          label="CNIC back"
          docKey="cnicBack"
          value={documents.cnicBack}
          onUploaded={(url) => setDocuments((prev) => ({ ...prev, cnicBack: url }))}
        />
        <DocumentUploadField
          label="Degree certificate"
          docKey="degreeCertificate"
          value={documents.degreeCertificate}
          onUploaded={(url) =>
            setDocuments((prev) => ({ ...prev, degreeCertificate: url }))
          }
        />
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Submitting…" : "Submit for admin review"}
      </Button>
    </form>
  );
}

function DocumentUploadField({
  label,
  docKey,
  value,
  onUploaded,
}: {
  label: string;
  docKey: string;
  value?: string;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(undefined);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/v1/doctor/verification/upload", {
      method: "POST",
      body: formData,
    });

    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setUploadError(data?.error?.message ?? "Upload failed");
      return;
    }

    const data = await res.json();
    onUploaded(data.data.url);
  }

  return (
    <div>
      <Label htmlFor={docKey}>{label}</Label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <input
          id={docKey}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={onFileChange}
          disabled={uploading}
          className="text-sm"
        />
        {uploading && <span className="text-xs text-slate-500">Uploading…</span>}
        {value && !uploading && (
          <Badge variant="secondary" className="text-xs">
            Uploaded
          </Badge>
        )}
      </div>
      {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
    </div>
  );
}
