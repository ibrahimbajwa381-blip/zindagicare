import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import { PrescriptionForm } from "@/features/prescriptions/components/prescription-form";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";
import { VerificationStatuses } from "@zindagi/shared";

export const metadata = { title: "Issue prescription | Doctor" };

const COPY = {
  loading: "Loading appointment…",
  notFound: "Appointment not found or you do not have access.",
  patientLabel: "Patient",
  consultLabel: "Consultation",
  alreadyIssued: "A prescription has already been issued for this appointment.",
  viewPdf: "View PDF",
  cannotIssue:
    "Prescriptions can only be issued for confirmed, in-progress, or completed appointments.",
  medicationsTitle: "Medications",
  medicineName: "Medicine name",
  dosage: "Dosage",
  frequency: "Frequency",
  duration: "Duration",
  addMedication: "Add medicine",
  removeMedication: "Remove",
  notesLabel: "Notes / advice (optional)",
  notesPlaceholder: "Rest, follow-up, dietary advice…",
  submit: "Issue prescription",
  submitting: "Generating PDF…",
  submitError: "Could not issue prescription. Please try again.",
  successTitle: "Prescription issued",
  successDesc: "The patient can view and download it from their dashboard.",
  downloadPdf: "Download PDF",
  backToRequests: "Back to consult requests",
};

type Props = {
  searchParams: Promise<{ appointmentId?: string }>;
};

export default async function DoctorNewPrescriptionPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/prescriptions/new");
  if (!session.user.roles?.includes("doctor")) redirect("/onboarding");

  const profile = await getDoctorProfile(session.user.id);
  if (profile.verificationStatus !== VerificationStatuses.APPROVED) {
    redirect("/doctor/profile");
  }

  const { appointmentId } = await searchParams;
  if (!appointmentId) {
    redirect("/doctor/prescriptions");
  }

  return (
    <>
      <DoctorPageHeader
        eyebrow="Clinical"
        title="Issue prescription"
        description="Enter medications and advice. A PDF will be generated for the patient."
      />
      <div className="max-w-2xl">
        <PrescriptionForm appointmentId={appointmentId} copy={COPY} />
      </div>
    </>
  );
}
