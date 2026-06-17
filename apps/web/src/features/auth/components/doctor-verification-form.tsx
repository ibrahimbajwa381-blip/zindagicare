"use client";

import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { HOME_CARE_MATCH_RADIUS_KM, SPECIALTIES } from "@zindagi/shared";
import { useSafeRouter } from "@/lib/navigation/safe-router";
import { Button } from "@/components/ui/button";
import { CalendarHeart, Clock } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { TimePicker, formatTime12h } from "@/components/ui/time-picker";
import { previewSundaySlots } from "@/lib/sunday/display";
import { DoctorProfilePhotoUpload } from "@/features/doctor/components/doctor-profile-photo-upload";
import { GeoLocationPicker } from "@/components/forms/geo-location-picker";
import { VerificationDocumentUpload } from "@/components/forms/verification-document-upload";
import type { GeoCoordinates } from "@/lib/geo/parse-google-maps-url";

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

export function DoctorVerificationForm() {
  const { push } = useSafeRouter();
  const { update, data: session } = useSession();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [specialty, setSpecialty] = useState<string>(
    SPECIALTIES[0] ?? "General Physician",
  );
  const [availability, setAvailability] = useState(DEFAULT_AVAILABILITY);
  const [sundayEnabled, setSundayEnabled] = useState(false);
  const [sundayStart, setSundayStart] = useState("16:00");
  const [sundayEnd, setSundayEnd] = useState("18:00");
  const [slotDurationMins, setSlotDurationMins] = useState(10);
  const [documents, setDocuments] = useState<Record<string, string>>({});
  const [documentNames, setDocumentNames] = useState<Record<string, string>>({});
  const [homeVisitEnabled, setHomeVisitEnabled] = useState(false);
  const [homeVisitGeo, setHomeVisitGeo] = useState<GeoCoordinates | null>(null);

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

    const homeVisitArea = String(form.get("homeVisitArea") ?? "").trim();
    if (homeVisitEnabled && homeVisitArea.length < 2) {
      setError("Please enter your service area for in-house visits.");
      setPending(false);
      return;
    }

    const body = {
      pmdcNumber: form.get("pmdcNumber"),
      cnic: form.get("cnic"),
      medicalDegree: form.get("medicalDegree"),
      medicalCollege: form.get("medicalCollege"),
      graduationYear: form.get("graduationYear"),
      experienceYears: form.get("experienceYears"),
      specialties: [specialty],
      avatarUrl,
      bio: form.get("bio") || undefined,
      consultationFee: form.get("consultationFee") || 0,
      hospitals: [
        {
          name: form.get("hospitalName"),
          city: form.get("hospitalCity"),
          address: form.get("hospitalAddress") || undefined,
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

    push("/doctor/profile?submitted=1");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
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

      <section className="space-y-4 rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-4">
        <h2 className="text-sm font-semibold text-slate-900">In-house visit availability</h2>
        <div>
          <Label htmlFor="homeVisitArea">Service area / neighborhood</Label>
          <Input
            id="homeVisitArea"
            name="homeVisitArea"
            placeholder="e.g. DHA Phase 5, Gulberg — where you can travel for home visits"
            minLength={2}
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

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending} loading={pending}>
        {pending ? "Submitting…" : "Submit for admin review"}
      </Button>
    </form>
  );
}
