"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { NUTRITIONIST_SPECIALTIES_ALPHABETICAL, MAX_NUTRITIONIST_SPECIALTIES } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { SpecialtyMultiSelect } from "@/components/forms/specialty-multi-select";
import { TimePicker } from "@/components/ui/time-picker";
import { formatDayOfWeek } from "@/features/nutritionist/types";
import { NutritionistProfilePhotoUpload } from "@/features/nutritionist/components/nutritionist-profile-photo-upload";
import type { NutritionistProfileDto } from "@/server/services/nutritionist-profile.service";

type ClinicRow = { name: string; city: string; address: string };
type AvailabilityRow = {
  dayOfWeek: number;
  startTimeLocal: string;
  endTimeLocal: string;
};

type Props = {
  profile: NutritionistProfileDto;
};

export function NutritionistProfileEditForm({ profile }: Props) {
  const router = useRouter();
  const { update } = useSession();
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  const [pending, setPending] = useState(false);

  const [name, setName] = useState(profile.user.name);
  const [phone, setPhone] = useState(profile.user.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.user.avatarUrl ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [primarySpecialty, setPrimarySpecialty] = useState(
    profile.primarySpecialty ?? NUTRITIONIST_SPECIALTIES_ALPHABETICAL[0] ?? "",
  );
  const [additionalSpecialties, setAdditionalSpecialties] = useState(
    profile.additionalSpecialties ?? [],
  );
  const [consultationFee, setConsultationFee] = useState(
    String(profile.consultationFee ?? 0),
  );
  const [languages, setLanguages] = useState(profile.languages.join(", "));
  const [clinics, setClinics] = useState<ClinicRow[]>(
    profile.clinics.length
      ? profile.clinics.map((c) => ({
          name: c.name,
          city: c.city,
          address: c.address ?? "",
        }))
      : [{ name: "", city: "Lahore", address: "" }],
  );
  const [availability, setAvailability] = useState<AvailabilityRow[]>(
    profile.weeklyAvailability.length
      ? profile.weeklyAvailability.map((slot) => ({ ...slot }))
      : [{ dayOfWeek: 1, startTimeLocal: "17:00", endTimeLocal: "21:00" }],
  );

  function updateClinic(index: number, patch: Partial<ClinicRow>) {
    setClinics((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addClinic() {
    setClinics((prev) => [...prev, { name: "", city: "Lahore", address: "" }]);
  }

  function removeClinic(index: number) {
    setClinics((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function updateAvailability(index: number, patch: Partial<AvailabilityRow>) {
    setAvailability((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addAvailability() {
    setAvailability((prev) => [
      ...prev,
      { dayOfWeek: 1, startTimeLocal: "17:00", endTimeLocal: "21:00" },
    ]);
  }

  function removeAvailability(index: number) {
    setAvailability((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    setFieldError(undefined);

    const cleanedClinics = clinics
      .map((c) => ({
        name: c.name.trim(),
        city: c.city.trim(),
        address: c.address.trim() || undefined,
      }))
      .filter((c) => c.name && c.city);

    if (!cleanedClinics.length) {
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

    if (!primarySpecialty) {
      setError("Select your primary specialty.");
      setPending(false);
      return;
    }

    if (!availability.length) {
      setError("Add at least one availability window.");
      setPending(false);
      return;
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
      ...(avatarUrl && avatarUrl !== profile.user.avatarUrl ? { avatarUrl } : {}),
      bio: bio.trim() || null,
      consultationFee: feeValue,
      primarySpecialty,
      additionalSpecialties,
      languages: languageList,
      clinics: cleanedClinics,
      weeklyAvailability: availability,
    };

    const res = await fetch("/api/v1/nutritionist/profile", {
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

    await update({
      name: name.trim(),
      ...(avatarUrl && avatarUrl !== profile.user.avatarUrl ? { image: avatarUrl } : {}),
    });
    router.push("/nutritionist/profile");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Credentials are read-only</p>
        <p className="mt-1">
          Council registration number ({profile.licenseNumber ?? "—"}), qualification, and
          verification documents cannot be changed here. Contact support if your credentials
          need updating.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Profile photo</h2>
        <NutritionistProfilePhotoUpload name={name} value={avatarUrl || undefined} onUploaded={setAvatarUrl} />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Contact & bio</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
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
        <div>
          <Label htmlFor="primarySpecialty">Primary specialty</Label>
          <select
            id="primarySpecialty"
            value={primarySpecialty}
            onChange={(e) => setPrimarySpecialty(e.target.value)}
            required
            className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-base text-foreground shadow-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25 sm:h-10 sm:rounded-lg sm:px-3 sm:text-sm"
          >
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
            Optional. An admin verifies which specialties appear on your public profile.
          </p>
        </div>
        <div>
          <Label htmlFor="bio">About you</Label>
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
          <Button type="button" variant="outline" size="sm" onClick={addClinic}>
            <Plus className="mr-1 h-4 w-4" />
            Add location
          </Button>
        </div>
        <div className="space-y-3">
          {clinics.map((clinic, index) => (
            <div key={index} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Location {index + 1}
                </p>
                {clinics.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => removeClinic(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`clinic-name-${index}`}>Clinic name</Label>
                  <Input
                    id={`clinic-name-${index}`}
                    value={clinic.name}
                    onChange={(e) => updateClinic(index, { name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor={`clinic-city-${index}`}>City</Label>
                  <Input
                    id={`clinic-city-${index}`}
                    value={clinic.city}
                    onChange={(e) => updateClinic(index, { city: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="mt-3">
                <Label htmlFor={`clinic-address-${index}`}>Address (optional)</Label>
                <Input
                  id={`clinic-address-${index}`}
                  value={clinic.address}
                  onChange={(e) => updateClinic(index, { address: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
        <div>
          <Label htmlFor="consultationFee">Video consultation fee (PKR)</Label>
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

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Weekly availability</h2>
          <Button type="button" variant="outline" size="sm" onClick={addAvailability}>
            <Plus className="mr-1 h-4 w-4" />
            Add window
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Nutritionist consultations on ZindagiCare are video-only.
        </p>
        {availability.map((slot, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-4"
          >
            <select
              value={slot.dayOfWeek}
              onChange={(e) =>
                updateAvailability(index, { dayOfWeek: Number(e.target.value) })
              }
              className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm shadow-sm sm:h-10 sm:rounded-lg"
            >
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <option key={day} value={day}>
                  {formatDayOfWeek(day)}
                </option>
              ))}
            </select>
            <TimePicker
              id={`availability-start-${index}`}
              value={slot.startTimeLocal}
              onChange={(startTimeLocal) => updateAvailability(index, { startTimeLocal })}
            />
            <TimePicker
              id={`availability-end-${index}`}
              value={slot.endTimeLocal}
              onChange={(endTimeLocal) => updateAvailability(index, { endTimeLocal })}
            />
            {availability.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeAvailability(index)}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
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
