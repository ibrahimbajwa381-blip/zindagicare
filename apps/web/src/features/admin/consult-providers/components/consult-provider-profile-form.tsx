"use client";

import { useMemo, useState } from "react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { SpecialtyMultiSelect } from "@/components/forms/specialty-multi-select";
import type { ConsultProviderAdminConfig } from "@/features/admin/consult-providers/config";
import { claimedSpecialties, splitList } from "@/features/admin/consult-providers/format";
import type { AdminConsultProviderDetail } from "@/features/admin/consult-providers/types";

const MAX_LANGUAGES = 8;
const MAX_QUALIFICATIONS = 12;
const CURRENT_YEAR = new Date().getFullYear();

function initialValues(provider: AdminConsultProviderDetail) {
  return {
    name: provider.name,
    phone: provider.phone ?? "",
    licenseNumber: provider.licenseNumber ?? "",
    degree: provider.degree ?? "",
    institute: provider.institute ?? "",
    graduationYear: provider.graduationYear?.toString() ?? "",
    experienceYears: String(provider.experienceYears),
    consultationFee: String(provider.consultationFee),
    languages: provider.languages.join(", "),
    qualifications: provider.qualifications.join(", "),
    bio: provider.bio ?? "",
  };
}

type FormValues = ReturnType<typeof initialValues>;

function sameList(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/**
 * Builds a patch of changed fields only, so untouched legacy data never fails
 * validation. Returns an error message instead when a changed field is invalid.
 */
function buildPatch(
  form: FormValues,
  initial: FormValues,
  specialties: { primary: string; additional: string[]; verified: string[] },
  provider: AdminConsultProviderDetail,
): Record<string, unknown> | string {
  const patch: Record<string, unknown> = {};
  const value = (key: keyof FormValues) => form[key].trim();
  const changed = (key: keyof FormValues) => value(key) !== initial[key].trim();

  if (changed("name")) {
    if (value("name").length < 2) return "Name must be at least 2 characters.";
    patch.name = value("name");
  }
  if (changed("phone")) {
    if (!value("phone")) return "Phone number can't be removed — enter a valid number.";
    patch.phone = value("phone");
  }
  if (changed("licenseNumber")) {
    if (value("licenseNumber").length < 4) return "Registration number must be at least 4 characters.";
    patch.licenseNumber = value("licenseNumber");
  }
  if (changed("degree")) {
    if (value("degree").length < 2) return "Qualification must be at least 2 characters.";
    patch.degree = value("degree");
  }
  if (changed("institute")) {
    if (value("institute").length < 2) return "Institute must be at least 2 characters.";
    patch.institute = value("institute");
  }
  if (changed("graduationYear")) {
    const year = Number(value("graduationYear"));
    if (!Number.isInteger(year) || year < 1950 || year > CURRENT_YEAR) {
      return `Graduation year must be between 1950 and ${CURRENT_YEAR}.`;
    }
    patch.graduationYear = year;
  }
  if (changed("experienceYears")) {
    const years = Number(value("experienceYears"));
    if (!value("experienceYears") || !Number.isInteger(years) || years < 0 || years > 60) {
      return "Experience must be between 0 and 60 years.";
    }
    patch.experienceYears = years;
  }
  if (changed("consultationFee")) {
    const fee = Number(value("consultationFee"));
    if (!value("consultationFee") || !Number.isFinite(fee) || fee < 0) {
      return "Consultation fee must be 0 or more.";
    }
    patch.consultationFee = fee;
  }
  if (changed("languages")) {
    const languages = splitList(form.languages);
    if (languages.length === 0) return "Add at least one language.";
    if (languages.length > MAX_LANGUAGES) return `Up to ${MAX_LANGUAGES} languages.`;
    patch.languages = languages;
  }
  if (changed("qualifications")) {
    const qualifications = splitList(form.qualifications);
    if (qualifications.length > MAX_QUALIFICATIONS) {
      return `Up to ${MAX_QUALIFICATIONS} additional qualifications.`;
    }
    if (qualifications.some((q) => q.length < 2 || q.length > 80)) {
      return "Each qualification must be 2–80 characters.";
    }
    patch.qualifications = qualifications;
  }
  if (changed("bio")) patch.bio = value("bio") || null;

  const specialtiesChanged =
    specialties.primary !== (provider.primarySpecialty ?? "") ||
    !sameList(specialties.additional, provider.additionalSpecialties);
  if (specialtiesChanged) {
    if (!specialties.primary) return "Select a primary specialty.";
    patch.primarySpecialty = specialties.primary;
    patch.additionalSpecialties = specialties.additional;
  }
  if (specialtiesChanged || !sameList(specialties.verified, provider.specialties)) {
    patch.verifiedSpecialties = specialties.verified;
  }
  return patch;
}

/** Admin corrections to a provider's identity, credentials and specialties. */
export function ConsultProviderProfileForm({
  config,
  provider,
  busy,
  onSubmit,
  onError,
}: {
  config: ConsultProviderAdminConfig;
  provider: AdminConsultProviderDetail;
  busy: boolean;
  onSubmit: (patch: Record<string, unknown>) => Promise<boolean>;
  onError: (message: string) => void;
}) {
  const initial = useMemo(() => initialValues(provider), [provider]);
  const [form, setForm] = useState(initial);
  const [primary, setPrimary] = useState(provider.primarySpecialty ?? "");
  const [additional, setAdditional] = useState(provider.additionalSpecialties);
  const [verified, setVerified] = useState(provider.specialties);
  const idPrefix = `edit-${config.kind}`;

  const claimed = claimedSpecialties({ primarySpecialty: primary, additionalSpecialties: additional });

  const field = (key: keyof FormValues) => ({
    id: `${idPrefix}-${key}`,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const reset = () => {
    setForm(initial);
    setPrimary(provider.primarySpecialty ?? "");
    setAdditional(provider.additionalSpecialties);
    setVerified(provider.specialties);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Verified specialties can only come from the claimed list.
    const verifiedClaimed = verified.filter((s) => claimed.includes(s));
    const patch = buildPatch(
      form,
      initial,
      { primary, additional: additional.filter((s) => s !== primary), verified: verifiedClaimed },
      provider,
    );
    if (typeof patch === "string") {
      onError(patch);
      return;
    }
    if (Object.keys(patch).length === 0) {
      onError("No changes to save.");
      return;
    }
    await onSubmit(patch);
  };

  return (
    <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Edit profile</CardTitle>
        <p className="text-sm text-slate-500">
          Correct this {config.labels.singularLower}&apos;s contact details, credentials and
          specialties.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${idPrefix}-name`}>Full name</Label>
            <Input {...field("name")} maxLength={100} required />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-phone`}>Mobile number</Label>
            <Input {...field("phone")} type="tel" />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-licenseNumber`}>Registration / license no.</Label>
            <Input {...field("licenseNumber")} maxLength={32} />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-degree`}>Qualification</Label>
            <Input {...field("degree")} maxLength={100} />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-institute`}>Institute</Label>
            <Input {...field("institute")} maxLength={200} />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-graduationYear`}>Graduation year</Label>
            <Input {...field("graduationYear")} type="number" min={1950} max={CURRENT_YEAR} />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-experienceYears`}>Experience (years)</Label>
            <Input {...field("experienceYears")} type="number" min={0} max={60} />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-consultationFee`}>Consultation fee (PKR)</Label>
            <Input {...field("consultationFee")} type="number" min={0} step={50} />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-languages`}>Languages (comma-separated)</Label>
            <Input {...field("languages")} />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-qualifications`}>
              Additional qualifications (comma-separated)
            </Label>
            <Input {...field("qualifications")} />
          </div>

          <div>
            <Label htmlFor={`${idPrefix}-primary`}>Primary specialty</Label>
            <select
              id={`${idPrefix}-primary`}
              value={primary}
              onChange={(e) => {
                const next = e.target.value;
                setPrimary(next);
                setAdditional((list) => list.filter((s) => s !== next));
              }}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {!primary && <option value="">Select…</option>}
              {config.specialties.map((specialty) => (
                <option key={specialty} value={specialty}>
                  {specialty}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-additional`}>Additional specialties</Label>
            <SpecialtyMultiSelect
              id={`${idPrefix}-additional`}
              values={additional}
              onChange={setAdditional}
              exclude={primary ? [primary] : []}
              max={config.maxSpecialties - 1}
              options={config.specialties}
              placeholder="Add specialties"
            />
          </div>

          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-slate-900">
              Verified specialties (shown to patients)
            </legend>
            {claimed.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">Select a primary specialty first.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {claimed.map((specialty) => {
                  const checked = verified.includes(specialty);
                  return (
                    <label
                      key={specialty}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                        checked
                          ? "border-brand/40 bg-brand/5 text-slate-900"
                          : "border-slate-200 bg-white text-slate-500",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setVerified((list) =>
                            checked ? list.filter((s) => s !== specialty) : [...list, specialty],
                          )
                        }
                        className="h-3.5 w-3.5 rounded border-slate-300"
                      />
                      {specialty}
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          <div className="sm:col-span-2">
            <Label htmlFor={`${idPrefix}-bio`}>Bio</Label>
            <textarea
              {...field("bio")}
              maxLength={2000}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy}>
              Save changes
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={reset}>
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
