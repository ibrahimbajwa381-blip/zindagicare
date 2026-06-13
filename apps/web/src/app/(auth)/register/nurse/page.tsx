import Link from "next/link";
import { RegisterForm } from "@/features/auth/components/register-form";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { getServerTranslations } from "@/i18n/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Nurse registration" };

export default async function NurseRegisterPage() {
  const { t } = await getServerTranslations();

  return (
    <Card className="w-full max-w-md shadow-premium">
      <CardHeader>
        <CardTitle className="text-2xl">{t.auth.registerNurse}</CardTitle>
        <CardDescription className="text-base text-slate-600">
          {t.auth.registerNurseDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm accountType="nurse" />
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
