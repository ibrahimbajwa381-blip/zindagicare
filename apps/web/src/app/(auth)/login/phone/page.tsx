import Link from "next/link";
import { PhoneOtpForm } from "@/features/auth/components/phone-otp-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Phone login" };

type Props = { searchParams: Promise<{ callbackUrl?: string }> };

export default async function PhoneLoginPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams;

  return (
    <Card className="w-full max-w-md shadow-premium">
        <CardHeader>
          <CardTitle>Sign in with phone</CardTitle>
          <CardDescription>We will send a one-time code via SMS</CardDescription>
        </CardHeader>
        <CardContent>
          <PhoneOtpForm callbackUrl={callbackUrl} />
          <p className="mt-4 text-center text-sm text-slate-600">
            <Link href="/login" className="font-medium text-brand">
              Use email instead
            </Link>
          </p>
        </CardContent>
    </Card>
  );
}
