import Link from "next/link";

import { siteConfig } from "@/config/site";

import { LoginForm } from "@/features/auth/components/login-form";

import { resolveAuthErrorMessage } from "@/lib/auth/errors";
import { AUTH_ROUTES } from "@/lib/auth/routes";

import { formatMessage, getServerTranslations } from "@/i18n/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Log in" };

type Props = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { callbackUrl, error } = await searchParams;
  const { t } = await getServerTranslations();

  const registerHref = callbackUrl
    ? `${siteConfig.links.register}?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : siteConfig.links.register;

  return (
    <Card className="w-full max-w-md shadow-premium">
      <CardHeader>
        <CardTitle>{t.auth.welcomeBack}</CardTitle>
        <CardDescription>
          {formatMessage(t.auth.signInDescription, { name: siteConfig.name })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm
          callbackUrl={callbackUrl}
          initialError={resolveAuthErrorMessage(error)}
        />
        <p className="mt-4 text-center text-sm text-slate-600">
          {t.auth.noAccount}{" "}
          <Link href={registerHref} className="font-medium text-brand">
            {t.auth.registerPatient}
          </Link>
        </p>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">{t.auth.staffSignupTitle}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3">
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
