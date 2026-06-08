import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import {
  DoctorEmptyState,
  DoctorListCard,
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
    <>
      <DoctorPageHeader
        eyebrow="Patient care"
        title="My patients"
        description="Patients you have consulted through paid online or clinic bookings on ZindagiCare."
        actions={
          <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand-dark">
            {patients.length} total
          </span>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {patients.length === 0 ? (
          <DoctorEmptyState message="No patients yet. They will appear here after consultations are booked." />
        ) : (
          <div className="divide-y divide-slate-100">
            {patients.map((patient) => (
              <div key={patient.id} className="p-4 sm:p-5">
                <DoctorListCard
                  title={patient.name}
                  subtitle={patient.phone}
                  meta={
                    patient.lastVisitAt
                      ? `Last visit ${formatDateTime(patient.lastVisitAt)} · ${patient.appointmentCount} appointment${patient.appointmentCount === 1 ? "" : "s"}`
                      : `${patient.appointmentCount} appointment${patient.appointmentCount === 1 ? "" : "s"}`
                  }
                  action={
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`${siteConfig.links.doctorMessages}?patient=${patient.id}`}
                      >
                        Message
                      </Link>
                    </Button>
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
