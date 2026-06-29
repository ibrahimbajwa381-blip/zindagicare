"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import type { StaffAccountType } from "@zindagi/validators";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { useSafeRouter } from "@/lib/navigation/safe-router";
import { useTranslations } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const VERIFICATION_PATH: Record<StaffAccountType, string> = {
  doctor: AUTH_ROUTES.doctorVerification,
  nurse: AUTH_ROUTES.nurseVerification,
  physiotherapist: AUTH_ROUTES.physiotherapistVerification,
};

const SESSION_PATCH_KEY: Record<
  StaffAccountType,
  "doctorVerificationStatus" | "nurseVerificationStatus" | "physiotherapistVerificationStatus"
> = {
  doctor: "doctorVerificationStatus",
  nurse: "nurseVerificationStatus",
  physiotherapist: "physiotherapistVerificationStatus",
};

type Props = {
  accountType: StaffAccountType;
  defaultCity?: string;
};

export function AddStaffRoleForm({ accountType, defaultCity = "Lahore" }: Props) {
  const t = useTranslations();
  const { push } = useSafeRouter();
  const { update } = useSession();
  const [city, setCity] = useState(defaultCity);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const copy = {
    doctor: {
      title: t.auth.addDoctorProfileTitle,
      description: t.auth.addDoctorProfileDescription,
      button: t.auth.addDoctorProfileButton,
    },
    nurse: {
      title: t.auth.addNurseProfileTitle,
      description: t.auth.addNurseProfileDescription,
      button: t.auth.addNurseProfileButton,
    },
    physiotherapist: {
      title: t.auth.addPhysiotherapistProfileTitle,
      description: t.auth.addPhysiotherapistProfileDescription,
      button: t.auth.addPhysiotherapistProfileButton,
    },
  }[accountType];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(undefined);

    const res = await fetch("/api/v1/auth/add-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountType, city: city.trim() }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.success) {
      setPending(false);
      setError(json.error?.message ?? "Could not add profile. Try again.");
      return;
    }

    const user = json.data?.user;
    const statusKey = SESSION_PATCH_KEY[accountType];
    await update({
      roles: user?.roles,
      activeWorkspace: accountType,
      [statusKey]: user?.[statusKey],
    });

    push(VERIFICATION_PATH[accountType]);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <p className="text-sm text-slate-600">{copy.description}</p>
      <div>
        <Label htmlFor="city" className="text-base font-semibold text-slate-800">
          {t.onboarding.city}
        </Label>
        <Input
          id="city"
          name="city"
          className="mt-1.5 h-12 text-base"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          required
          minLength={2}
        />
      </div>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending} loading={pending}>
        {pending ? t.auth.addingProfile : copy.button}
      </Button>
    </form>
  );
}
