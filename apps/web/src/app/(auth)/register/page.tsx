import Link from "next/link";
import { siteConfig } from "@/config/site";
import { AuthDivider } from "@/features/auth/components/auth-divider";
import { GoogleAuthButton } from "@/features/auth/components/google-auth-button";
import { RegisterForm } from "@/features/auth/components/register-form";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { formatMessage, getServerTranslations } from "@/i18n/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Register" };

export default async function RegisterPage() {
  const { t } = await getServerTranslations();

  return (
    <Card className="w-full max-w-md shadow-premium">
      <CardHeader>
        <CardTitle className="text-2xl">{t.auth.createAccount}</CardTitle>
        <CardDescription className="text-base text-slate-600">
          {formatMessage(t.auth.registerDescription, { name: siteConfig.name })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl border border-brand/15 bg-gradient-to-br from-brand/[0.06] via-white to-white p-4">
          <GoogleAuthButton mode="signUp" />
        </div>
        <AuthDivider />
        <RegisterForm accountType="patient" />
        <p className="mt-4 text-center text-sm text-slate-600">
          {t.auth.alreadyHaveAccount}{" "}
          <Link href={siteConfig.links.login} className="font-medium text-brand">
            {t.auth.login}
          </Link>
        </p>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">{t.auth.staffSignupTitle}</p>
          <p className="mt-1">{t.auth.staffSignupDescription}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href={AUTH_ROUTES.registerDoctor} className="font-medium text-brand">
              {t.auth.registerDoctor}
            </Link>
            <Link href={AUTH_ROUTES.registerNurse} className="font-medium text-brand">
              {t.auth.registerNurse}
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
