import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import { DoctorPatientsPanel } from "@/features/doctor/components/doctor-patients-panel";
import { listDoctorPatients } from "@/server/services/doctor-dashboard.service";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";
import { VerificationStatuses } from "@zindagi/shared";
import { Users } from "lucide-react";

export const metadata = { title: "My patients | Doctor" };

export default async function DoctorPatientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/patients");
  if (!session.user.roles?.includes("doctor")) redirect("/onboarding");

  const profile = await getDoctorProfile(session.user.id);
  if (profile.verificationStatus !== VerificationStatuses.APPROVED) {
    redirect("/doctor/profile");
  }

  const patients = await listDoctorPatients(session.user.id);

  return (
    <>
      <DoctorPageHeader
        eyebrow="Patient care"
        title="My patients"
        description="Patients you have consulted through paid online or clinic bookings on ZindagiCare."
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-800">
            <Users className="size-4" aria-hidden />
            {patients.length} total
          </span>
        }
      />

      <DoctorPatientsPanel patients={patients} />
    </>
  );
}
