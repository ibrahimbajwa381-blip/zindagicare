import Link from "next/link";
import { siteConfig } from "@/config/site";
import { LoginForm } from "@/features/auth/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Log in" };

type Props = { searchParams: Promise<{ callbackUrl?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams;

  return (
    <Card className="w-full max-w-md shadow-premium">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your {siteConfig.name} account</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm callbackUrl={callbackUrl} />
          <p className="mt-4 text-center text-sm text-slate-600">
            No account?{" "}
            <Link href={siteConfig.links.register} className="font-medium text-brand">
              Register
            </Link>
          </p>
        </CardContent>
    </Card>
  );
}
