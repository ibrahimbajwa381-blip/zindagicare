import Link from "next/link";

import { siteConfig } from "@/config/site";

import { LoginForm } from "@/features/auth/components/login-form";

import { resolveAuthErrorMessage } from "@/lib/auth/errors";

import { formatMessage, getServerTranslations } from "@/i18n/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";



export const metadata = { title: "Log in" };



type Props = {

  searchParams: Promise<{ callbackUrl?: string; error?: string }>;

};



export default async function LoginPage({ searchParams }: Props) {

  const { callbackUrl, error } = await searchParams;

  const { t } = await getServerTranslations();

  const googleEnabled = !!(

    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET

  );



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

            googleEnabled={googleEnabled}

          />

          <p className="mt-4 text-center text-sm text-slate-600">

            {t.auth.noAccount}{" "}

            <Link href={registerHref} className="font-medium text-brand">

              {t.auth.register}

            </Link>

          </p>

        </CardContent>

    </Card>

  );

}

