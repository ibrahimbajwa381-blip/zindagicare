import { auth } from "@/lib/auth";
import { Roles } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/features/auth/components/onboarding-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AUTH_ROUTES, resolvePostAuthPath } from "@/lib/auth/routes";

export const metadata = { title: "Complete your profile" };

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/onboarding");

  const roles = session.user.roles ?? [];
  if (!roles.includes(Roles.PATIENT) || roles.includes(Roles.DOCTOR) || roles.includes(Roles.NURSE)) {
    redirect(resolvePostAuthPath(session.user));
  }

  if (session.user.onboardingCompleted) {
    redirect(AUTH_ROUTES.patientDashboard);
  }

  return (
    <Card className="w-full max-w-lg shadow-premium">
      <CardHeader>
        <CardTitle>Welcome, {session.user.name}</CardTitle>
        <CardDescription>Complete your patient profile to start booking care.</CardDescription>
      </CardHeader>
      <CardContent>
        <OnboardingForm />
      </CardContent>
    </Card>
  );
}
