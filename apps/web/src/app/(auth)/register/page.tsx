import Link from "next/link";
import { siteConfig } from "@/config/site";
import { RegisterForm } from "@/features/auth/components/register-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Register" };

export default function RegisterPage() {
  return (
    <Card className="w-full max-w-md shadow-premium">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Join {siteConfig.name} — free for patients</CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
          <p className="mt-4 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link href={siteConfig.links.login} className="font-medium text-brand">
              Log in
            </Link>
          </p>
        </CardContent>
    </Card>
  );
}
