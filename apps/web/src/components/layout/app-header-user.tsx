"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Roles } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { AppUserMenu, type AccountType } from "@/components/layout/app-user-menu";
import { AUTH_ROUTES } from "@/lib/auth/routes";

function dashboardHref(roles?: string[]) {
  if (roles?.includes(Roles.DOCTOR)) return AUTH_ROUTES.doctorProfile;
  if (roles?.includes(Roles.ADMIN) || roles?.includes(Roles.SUPER_ADMIN)) {
    return AUTH_ROUTES.adminDashboard;
  }
  return siteConfig.links.dashboard;
}

function resolveAccountType(roles?: string[]): AccountType {
  if (roles?.includes(Roles.DOCTOR)) return "doctor";
  if (roles?.includes(Roles.ADMIN) || roles?.includes(Roles.SUPER_ADMIN)) {
    return "admin";
  }
  return "patient";
}

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
  const [profile, setProfile] = useState<{
    email?: string;
    phone?: string;
    city?: string;
  } | null>(null);

  const user = session?.user;
  const isPatient =
    !!user &&
    !user.roles?.includes(Roles.DOCTOR) &&
    !user.roles?.includes(Roles.ADMIN) &&
    !user.roles?.includes(Roles.SUPER_ADMIN);

  useEffect(() => {
    if (!enrichFromProfile || !isPatient || !user?.id) {
      setProfile(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/v1/patient/profile");
        const json = await res.json();
        if (!cancelled && json.success && json.data?.user) {
          setProfile({
            email: json.data.user.email,
            phone: json.data.user.phone,
            city: json.data.user.city,
          });
        }
      } catch {
        if (!cancelled) setProfile(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enrichFromProfile, isPatient, user?.id]);

  if (!user) return null;

  const name = user.name?.trim() || "Account";
  const href = dashboardHref(user.roles);

  return (
    <AppUserMenu
      name={name}
      email={profile?.email ?? user.email ?? undefined}
      phone={profile?.phone}
      city={profile?.city}
      dashboardHref={href}
      accountType={resolveAccountType(user.roles)}
      className={className}
      variant={variant}
    />
  );
}
