import { Roles } from "@zindagi/shared";
import { siteConfig } from "@/config/site";
import { AppUserMenu } from "@/components/layout/app-user-menu";
import { auth } from "@/lib/auth";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { getPatientProfile } from "@/server/services/patient-profile.service";

function dashboardHref(roles?: string[]) {
  if (roles?.includes(Roles.DOCTOR)) return "/doctor/sunday-consult";
  if (roles?.includes(Roles.ADMIN) || roles?.includes(Roles.SUPER_ADMIN)) {
    return AUTH_ROUTES.adminDashboard;
  }
  return siteConfig.links.dashboard;
}

type AppHeaderUserProps = {
  className?: string;
  /** Load city and phone from patient profile (patient dashboard area). */
  enrichFromProfile?: boolean;
  variant?: "header" | "drawer";
};

export async function AppHeaderUser({
  className,
  enrichFromProfile,
  variant = "header",
}: AppHeaderUserProps) {
  const session = await auth();
  if (!session?.user) return null;

  const name = session.user.name?.trim() || "Account";
  const href = dashboardHref(session.user.roles);

  let email = session.user.email;
  let phone: string | undefined;
  let city: string | undefined;

  const isPatient =
    !session.user.roles?.includes(Roles.DOCTOR) &&
    !session.user.roles?.includes(Roles.ADMIN) &&
    !session.user.roles?.includes(Roles.SUPER_ADMIN);

  if (enrichFromProfile && isPatient && session.user.id) {
    try {
      const profile = await getPatientProfile(session.user.id);
      email = profile.user.email ?? email;
      phone = profile.user.phone;
      city = profile.user.city;
    } catch {
      // Fall back to session-only fields.
    }
  }

  return (
    <AppUserMenu
      name={name}
      email={email}
      phone={phone}
      city={city}
      dashboardHref={href}
      className={className}
      variant={variant}
    />
  );
}
