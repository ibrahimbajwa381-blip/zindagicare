"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppUserMenu } from "@/components/layout/app-user-menu";
import {
  dashboardHref,
  resolveHeaderAccountType,
} from "@/lib/nav/header-actions";

type AppHeaderUserProps = {
  className?: string;
  /** Load city and phone from patient profile (patient dashboard area). */
  enrichFromProfile?: boolean;
  variant?: "header" | "drawer";
};

export function AppHeaderUser({
  className,
  enrichFromProfile,
  variant = "header",
}: AppHeaderUserProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [profile, setProfile] = useState<{
    email?: string;
    phone?: string;
    city?: string;
    avatarUrl?: string;
  } | null>(null);

  const user = session?.user;
  const accountType = resolveHeaderAccountType(user?.roles);
  const isPatient = accountType === "patient";
  const isDoctor = accountType === "doctor";

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      return;
    }

    const shouldFetchPatient = enrichFromProfile && isPatient;
    const shouldFetchDoctor = isDoctor;

    if (!shouldFetchPatient && !shouldFetchDoctor) {
      setProfile(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const endpoint = shouldFetchDoctor
          ? "/api/v1/doctor/profile"
          : "/api/v1/patient/profile";
        const res = await fetch(endpoint);
        const json = await res.json();
        if (!cancelled && json.success && json.data?.user) {
          setProfile({
            email: json.data.user.email,
            phone: json.data.user.phone,
            city: json.data.user.city,
            avatarUrl: json.data.user.avatarUrl,
          });
        }
      } catch {
        if (!cancelled) setProfile(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enrichFromProfile, isPatient, isDoctor, user?.id, pathname]);

  if (!user) return null;

  const name = user.name?.trim() || "Account";
  const href = dashboardHref(user.roles);

  return (
    <AppUserMenu
      name={name}
      email={profile?.email ?? user.email ?? undefined}
      phone={profile?.phone}
      city={profile?.city}
      image={profile?.avatarUrl ?? user.image ?? undefined}
      dashboardHref={href}
      accountType={resolveHeaderAccountType(user.roles)}
      className={className}
      variant={variant}
    />
  );
}
