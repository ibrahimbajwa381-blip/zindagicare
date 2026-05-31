import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import {
  DoctorEmptyState,
  DoctorListCard,
  DoctorWorkspaceHeader,
  formatDateTime,
} from "@/features/doctor/components/doctor-workspace-panels";
import { listDoctorHomeVisitRequests } from "@/server/services/doctor-dashboard.service";
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

  const visits = await listDoctorHomeVisitRequests(session.user.id);

  return (
    <PageShell variant="brand" spacing="default" narrow flipBlur>
      <DoctorWorkspaceHeader
        title="In-house visit requests"
        description="Doctor home visit requests in your coverage cities."
        count={visits.length}
      />

      <div className="space-y-3">
        {visits.length === 0 ? (
          <DoctorEmptyState message="No in-house doctor visit requests in your area right now." />
        ) : (
          visits.map((visit) => (
            <DoctorListCard
              key={visit.id}
              title={visit.patient?.name ?? "Patient"}
              subtitle={visit.patient?.phone}
              meta={`${visit.address.line}, ${visit.address.city} · ${formatDateTime(visit.scheduledAt)} · ${visit.pricing.currency} ${visit.pricing.total}${visit.patientNotes ? ` · ${visit.patientNotes}` : ""}`}
              badge={visit.status.replace("_", " ")}
            />
          ))
        )}
      </div>
    </PageShell>
  );
}
