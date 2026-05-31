"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { useLocale, useTranslations } from "@/i18n/locale-provider";

type OnboardingUser = {
  onboardingCompleted?: boolean;
  roles?: string[];
  doctorVerificationStatus?: string;
};

export function OnboardingForm() {
  const router = useRouter();
  const { update } = useSession();
  const { locale } = useLocale();
  const t = useTranslations();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const intents = [
    {
      value: "patient",
      label: t.onboarding.patient,
      description: t.onboarding.patientDesc,
    },
    {
      value: "doctor",
      label: t.onboarding.doctor,
      description: t.onboarding.doctorDesc,
    },
    {
      value: "nurse",
      label: t.onboarding.nurse,
      description: t.onboarding.nurseDesc,
    },
  ] as const;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(e.currentTarget);
    const body = {
      intent: form.get("intent"),
      city: form.get("city"),
      locale: form.get("locale") ?? locale,
      dateOfBirth: form.get("dateOfBirth") || undefined,
      gender: form.get("gender") || undefined,
    };

    const res = await fetch("/api/v1/auth/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      setPending(false);
      const json = await res.json().catch(() => ({}));
      setError(
        json?.error?.message ?? "Could not save onboarding. Try again.",
      );
      return;
    }

    const json = (await res.json()) as {
      data?: { user?: OnboardingUser };
    };
    const user = json.data?.user;

    if (user) {
      await update({
        onboardingCompleted: user.onboardingCompleted,
        roles: user.roles,
        doctorVerificationStatus: user.doctorVerificationStatus,
      });
    }

    setPending(false);

    const intent = String(body.intent);
    if (intent === "doctor") {
      router.push(AUTH_ROUTES.doctorVerification);
      router.refresh();
      return;
    }
    router.push(AUTH_ROUTES.patientDashboard);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">
          {t.onboarding.joiningAs}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {intents.map((item) => (
            <label
              key={item.value}
              className="flex cursor-pointer flex-col rounded-lg border border-slate-200 p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-muted"
            >
              <input
                type="radio"
                name="intent"
                value={item.value}
                defaultChecked={item.value === "patient"}
                className="sr-only"
              />
              <span className="font-medium text-slate-900">{item.label}</span>
              <span className="text-xs text-slate-500">{item.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="city">{t.onboarding.city}</Label>
        <Input id="city" name="city" defaultValue="Lahore" required />
      </div>

      <div>
        <Label htmlFor="locale">{t.onboarding.language}</Label>
        <select
          id="locale"
          name="locale"
          className="flex h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
          defaultValue={locale}
        >
          <option value="en">{t.auth.english}</option>
          <option value="ur">{t.auth.urdu}</option>
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="dateOfBirth">Date of birth (optional)</Label>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" />
        </div>
        <div>
          <Label htmlFor="gender">Gender (optional)</Label>
          <select
            id="gender"
            name="gender"
            className="flex h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
          >
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t.onboarding.submitting : t.onboarding.submit}
      </Button>
    </form>
  );
}
