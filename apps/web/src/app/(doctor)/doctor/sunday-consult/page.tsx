import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import { DoctorSundayDashboard } from "@/features/sunday-consult/components/doctor-sunday-dashboard";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";
import { VerificationStatuses } from "@zindagi/shared";

export const metadata = { title: "Sunday Consult | Doctor" };

export default async function DoctorSundayPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/sunday-consult");

  const profile = await getDoctorProfile(session.user.id);
  if (profile.verificationStatus !== VerificationStatuses.APPROVED) {
    redirect("/doctor/profile");
  }

  return (
    <>
      <DoctorPageHeader
        eyebrow="Programs"
        title="Sunday free consult"
        description="Manage your Sunday consult queue, slot settings, and patient bookings."
      />
      <DoctorSundayDashboard />
    </>
  );
}
