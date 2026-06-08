import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import { DoctorHomeVisitsDashboard } from "@/features/home-care/components/doctor-home-visits-dashboard";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";
import { VerificationStatuses } from "@zindagi/shared";

export const metadata = { title: "In-house visits | Doctor" };

export default async function DoctorHomeVisitsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/home-visits");
  if (!session.user.roles?.includes("doctor")) redirect("/onboarding");

  const profile = await getDoctorProfile(session.user.id);
  if (profile.verificationStatus !== VerificationStatuses.APPROVED) {
    redirect("/doctor/profile");
  }

  return (
    <>
      <DoctorPageHeader
        eyebrow="Home treatment"
        title="In-house visit requests"
        description="Doctor home visits assigned to you by admin — update status as you travel to the patient."
      />
      <DoctorHomeVisitsDashboard />
    </>
  );
}
