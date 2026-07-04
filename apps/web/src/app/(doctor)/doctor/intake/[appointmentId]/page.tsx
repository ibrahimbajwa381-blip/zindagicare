import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { VerificationStatuses } from "@zindagi/shared";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import { DoctorEmptyState } from "@/features/doctor/components/doctor-workspace-panels";
import { DoctorIntakeSummary } from "@/features/intake/components/doctor-intake-summary";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";
import { MedicalIntakeService } from "@/server/services/medical-intake.service";
import { PrescriptionService } from "@/server/services/prescription.service";

export const metadata = { title: "Medical history | Doctor" };

type Props = {
  params: Promise<{ appointmentId: string }>;
};

export default async function DoctorIntakePage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/profile");
  if (!session.user.roles?.includes("doctor")) redirect("/onboarding");

  const profile = await getDoctorProfile(session.user.id);
  if (profile.verificationStatus !== VerificationStatuses.APPROVED) {
    redirect("/doctor/profile");
  }

  const { appointmentId } = await params;
  const intake = await MedicalIntakeService.getForDoctor(
    appointmentId,
    session.user.id,
  );

  if (!intake) {
    return (
      <>
        <DoctorPageHeader
          eyebrow="Clinical"
          title="Pre-consult medical history"
          description="Review the patient's pre-consult medical history."
        />
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <DoctorEmptyState message="No medical history was found for this appointment." />
        </div>
      </>
    );
  }

  let patientName: string | undefined;
  try {
    const ctx = await PrescriptionService.getAppointmentContextForDoctor(
      session.user.id,
      appointmentId,
    );
    patientName = ctx.patientName;
  } catch {
    // Patient name is optional for the page header.
  }

  return (
    <>
      <DoctorPageHeader
        eyebrow="Clinical"
        title="Pre-consult medical history"
        description={
          patientName
            ? `${patientName} has submitted their medical history for this appointment.`
            : "Review the patient's pre-consult medical history."
        }
      />
      <div className="max-w-2xl">
        <DoctorIntakeSummary appointmentId={appointmentId} defaultOpen />
      </div>
    </>
  );
}
