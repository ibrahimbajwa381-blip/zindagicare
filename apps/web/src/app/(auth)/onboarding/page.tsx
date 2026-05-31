import { auth } from "@/lib/auth";
import { Roles, VerificationStatuses } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/features/auth/components/onboarding-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AUTH_ROUTES } from "@/lib/auth/routes";

export const metadata = { title: "Complete your profile" };

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/onboarding");
  if (session.user.onboardingCompleted) redirect("/dashboard");

  const roles = session.user.roles ?? [];
  if (roles.includes(Roles.DOCTOR)) {
    if (session.user.doctorVerificationStatus === VerificationStatuses.APPROVED) {
      redirect(AUTH_ROUTES.doctorProfile);
    }
    redirect(AUTH_ROUTES.doctorVerification);
  }

  return (
    <Card className="w-full max-w-lg shadow-premium">
        <CardHeader>
          <CardTitle>Welcome, {session.user.name}</CardTitle>
          <CardDescription>Tell us how you will use ZindagiCare</CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
    </Card>
  );
}
