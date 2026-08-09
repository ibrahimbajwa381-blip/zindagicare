"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Roles } from "@zindagi/shared";
import { AppUserMenu } from "@/components/layout/app-user-menu";
import {
  resolveDashboardMenuLinks,
  resolveHeaderAccountType,
} from "@/lib/nav/header-actions";
import { useTranslations } from "@/i18n/locale-provider";
import { useIsMountedRef } from "@/hooks/use-is-mounted-ref";

type AppHeaderUserProps = {
  className?: string;
  /** Load city and phone from patient profile (patient dashboard area). */
  enrichFromProfile?: boolean;
  variant?: "header" | "drawer";
};

function needsClinicalPatientSync(roles: string[] | undefined) {
  if (!roles) return false;
  const isClinical =
    roles.includes(Roles.DOCTOR) ||
    roles.includes(Roles.NURSE) ||
    roles.includes(Roles.PHYSIOTHERAPIST);
  return isClinical && !roles.includes(Roles.PATIENT);
}

export function AppHeaderUser({
  className,
  enrichFromProfile,
  variant = "header",
}: AppHeaderUserProps) {
  const { data: session, update } = useSession();
  const t = useTranslations();
  const mountedRef = useIsMountedRef();
  const syncedUserIdRef = useRef<string | null>(null);
  const [profile, setProfile] = useState<{
    email?: string;
    phone?: string;
    city?: string;
    avatarUrl?: string;
  } | null>(null);

  const user = session?.user;
  const accountType = resolveHeaderAccountType(
    user?.roles,
    user?.activeWorkspace,
  );
  const isPatient = accountType === "patient";
  const isDoctor = accountType === "doctor";
  const needsSync = needsClinicalPatientSync(user?.roles);

  useEffect(() => {
    if (!user?.id || !needsSync) return;
    if (syncedUserIdRef.current === user.id) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/v1/auth/sync-session", { method: "POST" });
        const json = await res.json();
        if (cancelled || !mountedRef.current || !json.success || !json.data?.user?.roles) {
          return;
        }
        syncedUserIdRef.current = user.id;
        // Defer session writes so we never update Auth context mid-mount
        // (React 19: "state update on a component that hasn't mounted yet").
        startTransition(() => {
          void update({
            roles: json.data.user.roles,
            onboardingCompleted: json.data.user.onboardingCompleted,
            hasPhone: json.data.user.hasPhone,
          });
        });
      } catch {
        // Session keeps working; user can re-login to pick up dual roles.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, needsSync, update, mountedRef]);

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
  }, [enrichFromProfile, isPatient, isDoctor, user?.id]);

  if (!user) return null;

  const name = user.name?.trim() || "Account";
  const headerLabels = t.dashboard.header;
  const dashboardLinks = resolveDashboardMenuLinks(user.roles, {
    myDashboard: headerLabels.myDashboard,
    patientDashboard: headerLabels.patientDashboard,
    doctorDashboard: headerLabels.doctorDashboard,
    adminDashboard: headerLabels.adminDashboard,
  });

  return (
    <AppUserMenu
      name={name}
      email={profile?.email ?? user.email ?? undefined}
      phone={profile?.phone}
      city={profile?.city}
      image={profile?.avatarUrl ?? user.image ?? undefined}
      dashboardLinks={dashboardLinks}
      accountType={accountType}
      className={className}
      variant={variant}
    />
  );
}
