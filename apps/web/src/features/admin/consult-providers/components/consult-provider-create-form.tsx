"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SpecialtyMultiSelect } from "@/components/forms/specialty-multi-select";
import { errorMessage, type ConsultProviderApi } from "@/features/admin/consult-providers/api";
import type { ConsultProviderAdminConfig } from "@/features/admin/consult-providers/config";

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  phone: "",
  licenseNumber: "",
  city: "",
};

const MIN_PASSWORD_LENGTH = 8;

/** Admin-created accounts are approved and listed immediately. */
export function ConsultProviderCreateForm({
  config,
  api,
  onCreated,
}: {
  config: ConsultProviderAdminConfig;
  api: ConsultProviderApi;
  onCreated: () => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { singularLower } = config.labels;
  const idPrefix = `create-${config.kind}`;

  const field = (key: keyof typeof EMPTY_FORM) => ({
    id: `${idPrefix}-${key}`,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (specialties.length === 0) {
      setError("Select at least one specialty.");
      return;
    }
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setSubmitting(true);
    try {
      await api.create({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        licenseNumber: form.licenseNumber.trim(),
        city: form.city.trim(),
        specialties,
      });
      setForm(EMPTY_FORM);
      setSpecialties([]);
      onCreated();
    } catch (err) {
      setError(errorMessage(err, `Failed to create ${singularLower}`));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Add {singularLower} manually</CardTitle>
        <p className="text-sm text-slate-500">
          Creates an approved, listed account. Share the password with the {singularLower}; they
          can add their photo, practice locations and hours after signing in.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor={`${idPrefix}-name`}>Full name</Label>
            <Input {...field("name")} minLength={2} maxLength={100} required />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-email`}>Email</Label>
            <Input {...field("email")} type="email" required />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-password`}>Password</Label>
            <PasswordInput
              {...field("password")}
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-phone`}>Mobile number</Label>
            <Input {...field("phone")} type="tel" placeholder="03XX XXXXXXX" />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-licenseNumber`}>Registration / license no.</Label>
            <Input {...field("licenseNumber")} minLength={3} maxLength={30} required />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-city`}>City</Label>
            <Input {...field("city")} minLength={2} required />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Label htmlFor={`${idPrefix}-specialties`}>
              Specialties (first one becomes primary)
            </Label>
            <SpecialtyMultiSelect
              id={`${idPrefix}-specialties`}
              values={specialties}
              onChange={setSpecialties}
              max={config.maxSpecialties}
              options={config.specialties}
              placeholder={`Add ${singularLower} specialties`}
            />
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-3">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? "Creating…" : `Create ${singularLower}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
