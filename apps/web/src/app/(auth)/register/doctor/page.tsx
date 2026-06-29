import Link from "next/link";
import { redirect } from "next/navigation";
import { Roles } from "@zindagi/shared";
import { RegisterForm } from "@/features/auth/components/register-form";
import { AddStaffRoleForm } from "@/features/auth/components/add-staff-role-form";
import { auth } from "@/lib/auth";
import { AUTH_ROUTES, resolvePostAuthPath } from "@/lib/auth/routes";
import { getServerTranslations } from "@/i18n/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Doctor registration" };

export default async function DoctorRegisterPage() {
  const session = await auth();
  const { t } = await getServerTranslations();

  if (session?.user?.roles?.includes(Roles.DOCTOR)) {
    redirect(resolvePostAuthPath(session.user));
  }

  const isLoggedIn = Boolean(session?.user);

  return (
    <Card className="w-full max-w-md shadow-premium">
      <CardHeader>
        <CardTitle className="text-2xl">
          {isLoggedIn ? t.auth.addDoctorProfileTitle : t.auth.registerDoctor}
        </CardTitle>
        <CardDescription className="text-base text-slate-600">
          {isLoggedIn
            ? t.auth.addDoctorProfileDescription
            : t.auth.registerDoctorDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoggedIn ? (
          <AddStaffRoleForm accountType="doctor" />
        ) : (
          <RegisterForm accountType="doctor" />
        )}
        <p className="mt-4 text-center text-sm text-slate-600">
          {isLoggedIn ? (
            <>
              {t.auth.signedInAs}{" "}
              <span className="font-medium text-slate-800">{session?.user?.email}</span>
            </>
          ) : (
            <>
              {t.auth.alreadyHaveAccount}{" "}
              <Link
                href={`${AUTH_ROUTES.login}?callbackUrl=${encodeURIComponent(AUTH_ROUTES.registerDoctor)}`}
                className="font-medium text-brand"
              >
                {t.auth.login}
              </Link>
            </>
          )}
        </p>
        {!isLoggedIn ? (
          <p className="mt-3 text-center text-sm text-slate-500">
            {t.auth.patientInstead}{" "}
            <Link href={AUTH_ROUTES.register} className="font-medium text-brand">
              {t.auth.registerPatient}
            </Link>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
