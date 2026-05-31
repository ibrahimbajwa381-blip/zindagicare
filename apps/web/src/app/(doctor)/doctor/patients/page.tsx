import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import {
  DoctorEmptyState,
  DoctorListCard,
  DoctorWorkspaceHeader,
  formatDateTime,
} from "@/features/doctor/components/doctor-workspace-panels";
import { listDoctorPatients } from "@/server/services/doctor-dashboard.service";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";
import { VerificationStatuses } from "@zindagi/shared";

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
    <PageShell variant="brand" spacing="default" narrow flipBlur>
      <DoctorWorkspaceHeader
        title="My patients"
        description="Patients you have consulted through ZindagiCare."
        count={patients.length}
      />

      <div className="space-y-3">
        {patients.length === 0 ? (
          <DoctorEmptyState message="No patients yet. They will appear here after consultations are booked." />
        ) : (
          patients.map((patient) => (
            <DoctorListCard
              key={patient.id}
              title={patient.name}
              subtitle={patient.phone}
              meta={
                patient.lastVisitAt
                  ? `Last visit ${formatDateTime(patient.lastVisitAt)} · ${patient.appointmentCount} appointment${patient.appointmentCount === 1 ? "" : "s"}`
                  : `${patient.appointmentCount} appointment${patient.appointmentCount === 1 ? "" : "s"}`
              }
            />
          ))
        )}
      </div>
    </PageShell>
  );
}
