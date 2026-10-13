import { auth } from "@/lib/auth";
import { connectDatabase, UserModel } from "@zindagi/database";
import { Roles } from "@zindagi/shared";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/features/auth/components/onboarding-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AUTH_ROUTES, resolvePostAuthPath } from "@/lib/auth/routes";
import { safeCallbackUrl } from "@/lib/auth/safe-callback-url";

export const metadata = { title: "Complete your profile" };

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function OnboardingPage({ searchParams }: Props) {
  const { callbackUrl: rawCallbackUrl } = await searchParams;
  const callbackUrl = safeCallbackUrl(rawCallbackUrl);
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/onboarding");

  const roles = session.user.roles ?? [];
  if (!roles.includes(Roles.PATIENT) || roles.includes(Roles.DOCTOR) || roles.includes(Roles.NURSE)) {
    redirect(resolvePostAuthPath(session.user));
  }

  await connectDatabase();
  const dbUser = await UserModel.findById(session.user.id)
    .select("phone onboardingCompleted")
    .lean();
  const hasPhone = Boolean(dbUser?.phone);
  const onboardingCompleted = Boolean(dbUser?.onboardingCompleted);

  if (onboardingCompleted && hasPhone) {
    redirect(callbackUrl ?? AUTH_ROUTES.patientDashboard);
  }

  const needsPhone = !hasPhone;

  return (
    <Card className="w-full max-w-lg shadow-premium">
      <CardHeader>
        <CardTitle>Welcome, {session.user.name}</CardTitle>
        <CardDescription>
          {needsPhone
            ? "Add your WhatsApp number and finish your profile to start booking care."
            : "Complete your patient profile to start booking care."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <OnboardingForm needsPhone={needsPhone} callbackUrl={callbackUrl} />
      </CardContent>
    </Card>
  );
}
