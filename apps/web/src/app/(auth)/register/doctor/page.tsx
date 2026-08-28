import { redirect } from "next/navigation";
import { Roles } from "@zindagi/shared";
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

  // Signup happens on the single unified /register form; this route now only
  // handles "add a doctor profile to my existing account".
  if (!session?.user) {
    redirect(AUTH_ROUTES.register);
  }

  return (
    <Card className="w-full max-w-md shadow-premium">
      <CardHeader>
        <CardTitle className="text-2xl">{t.auth.addDoctorProfileTitle}</CardTitle>
        <CardDescription className="text-base text-slate-600">
          {t.auth.addDoctorProfileDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AddStaffRoleForm accountType="doctor" />
        <p className="mt-4 text-center text-sm text-slate-600">
          {t.auth.signedInAs}{" "}
          <span className="font-medium text-slate-800">{session.user.email}</span>
        </p>
      </CardContent>
    </Card>
  );
}
