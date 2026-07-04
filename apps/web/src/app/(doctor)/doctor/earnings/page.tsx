import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VerificationStatuses } from "@zindagi/shared";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import { DoctorEarningsPanel } from "@/features/doctor/components/doctor-earnings-panel";
import { getDoctorEarnings } from "@/server/services/doctor-dashboard.service";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";

export const metadata = { title: "Earnings | Doctor" };

export default async function DoctorEarningsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/earnings");
  if (!session.user.roles?.includes("doctor")) redirect("/onboarding");

  const profile = await getDoctorProfile(session.user.id);
  if (profile.verificationStatus !== VerificationStatuses.APPROVED) {
    redirect("/doctor/profile");
  }

  const earnings = await getDoctorEarnings(session.user.id);

  return (
    <>
      <DoctorPageHeader
        eyebrow="Revenue"
        title="Earnings"
        description="Track revenue, completed consultations, commissions, and withdrawals from paid online, clinic, and in-house visits."
      />
      <DoctorEarningsPanel earnings={earnings} />
    </>
  );
}
