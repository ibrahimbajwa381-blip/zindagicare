import Link from "next/link";
import { siteConfig } from "@/config/site";
import { RegisterForm } from "@/features/auth/components/register-form";
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
        <RegisterForm accountType="patient" />
        <p className="mt-4 text-center text-sm text-slate-600">
          {t.auth.alreadyHaveAccount}{" "}
          <Link href={siteConfig.links.login} className="font-medium text-brand">
            {t.auth.login}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
