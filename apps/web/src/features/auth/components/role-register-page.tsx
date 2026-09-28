import Link from "next/link";
import { redirect } from "next/navigation";
import type { Role } from "@zindagi/shared";
import { RegisterForm } from "@/features/auth/components/register-form";
import { auth } from "@/lib/auth";
import { AUTH_ROUTES, resolvePostAuthPath } from "@/lib/auth/routes";
import { getServerTranslations } from "@/i18n/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type StaffRegisterRole =
  | "doctor"
  | "nurse"
  | "physiotherapist"
  | "herbalist"
  | "nutritionist";

/** Role-specific signup page: same unified form, pre-set to the professional account type. */
export async function RoleRegisterPage({ role }: { role: StaffRegisterRole }) {
  const session = await auth();
  const { t } = await getServerTranslations();

  // Already registered in this role — send them to their workspace / verification.
  if (session?.user?.roles?.includes(role as Role)) {
    redirect(resolvePostAuthPath(session.user));
  }

  const copy: Record<StaffRegisterRole, { title: string; description: string }> = {
    doctor: { title: t.auth.registerDoctor, description: t.auth.registerDoctorDescription },
    nurse: { title: t.auth.registerNurse, description: t.auth.registerNurseDescription },
    physiotherapist: {
      title: t.auth.registerPhysiotherapist,
      description: t.auth.registerPhysiotherapistDescription,
    },
    herbalist: { title: t.auth.registerHerbalist, description: t.auth.registerHerbalistDescription },
    nutritionist: {
      title: t.auth.registerNutritionist,
      description: t.auth.registerNutritionistDescription,
    },
  };

  return (
    <Card className="w-full max-w-md shadow-premium">
      <CardHeader>
        <CardTitle className="text-2xl">{copy[role].title}</CardTitle>
        <CardDescription className="text-base text-slate-600">
          {copy[role].description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {session?.user ? (
          <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {t.auth.signedInAs}{" "}
            <span className="font-medium">{session.user.email}</span>. {t.auth.oneRolePerAccountNotice}
          </p>
        ) : null}
        <RegisterForm key={role} accountType={role} />
        <p className="mt-4 text-center text-sm text-slate-600">
          {t.auth.alreadyHaveAccount}{" "}
          <Link href={AUTH_ROUTES.login} className="font-medium text-brand">
            {t.auth.login}
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-slate-500">
          {t.auth.patientInstead}{" "}
          <Link href={AUTH_ROUTES.register} className="font-medium text-brand">
            {t.auth.registerPatient}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
