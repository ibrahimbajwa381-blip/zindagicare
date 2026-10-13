import Link from "next/link";
import { siteConfig } from "@/config/site";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";
import { RegisterForm } from "@/features/auth/components/register-form";
import { formatMessage, getServerTranslations } from "@/i18n/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Register" };

type Props = {
  searchParams: Promise<{ reason?: string; callbackUrl?: string }>;
};

export default async function RegisterPage({ searchParams }: Props) {
  const { reason, callbackUrl: rawCallbackUrl } = await searchParams;
  const callbackUrl = safeCallbackUrl(rawCallbackUrl);
  const loginHref = callbackUrl
    ? `${siteConfig.links.login}?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : siteConfig.links.login;
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
        {reason === "no-account" && (
          <p className="mb-4 rounded-xl border border-brand/20 bg-brand/[0.06] p-3 text-sm text-slate-700">
            {t.auth.noAccountForEmail}
          </p>
        )}
        <RegisterForm accountType="patient" callbackUrl={callbackUrl} />
        <p className="mt-4 text-center text-sm text-slate-600">
          {t.auth.alreadyHaveAccount}{" "}
          <Link href={loginHref} className="font-medium text-brand">
            {t.auth.login}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
