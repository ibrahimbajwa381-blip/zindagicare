import Link from "next/link";
import { PhoneOtpForm } from "@/features/auth/components/phone-otp-form";
import { AUTH_ROUTES } from "@/lib/auth/routes";
import { getServerTranslations } from "@/i18n/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Phone login" };

type Props = { searchParams: Promise<{ callbackUrl?: string }> };

export default async function PhoneLoginPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams;
  const { t } = await getServerTranslations();
  const loginHref = callbackUrl
    ? `${AUTH_ROUTES.login}?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : AUTH_ROUTES.login;

  return (
    <Card className="w-full max-w-md shadow-premium">
      <CardHeader>
        <CardTitle>{t.auth.phoneLoginTitle}</CardTitle>
        <CardDescription>{t.auth.phoneLoginDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <PhoneOtpForm callbackUrl={callbackUrl} />
        <p className="mt-4 text-center text-sm text-slate-600">
          <Link href={loginHref} className="font-medium text-brand">
            {t.auth.useEmailInstead}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
