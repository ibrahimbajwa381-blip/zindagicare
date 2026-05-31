import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import {
  DoctorEmptyState,
  DoctorListCard,
  DoctorWorkspaceHeader,
  formatDateTime,
} from "@/features/doctor/components/doctor-workspace-panels";
import { listDoctorConsultRequests } from "@/server/services/doctor-dashboard.service";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";
import { VerificationStatuses } from "@zindagi/shared";

export const metadata = { title: "Consult requests | Doctor" };

function formatType(type: string) {
  if (type === "online") return "Online consult";
  if (type === "clinic") return "Clinic visit";
  return type;
}

export default async function DoctorRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/requests");
  if (!session.user.roles?.includes("doctor")) redirect("/onboarding");

  const profile = await getDoctorProfile(session.user.id);
  if (profile.verificationStatus !== VerificationStatuses.APPROVED) {
    redirect("/doctor/profile");
  }

  const requests = await listDoctorConsultRequests(session.user.id);

  return (
    <PageShell variant="brand" spacing="default" narrow flipBlur>
      <DoctorWorkspaceHeader
        title="Consult requests"
        description="Upcoming online and in-clinic appointments assigned to you."
        count={requests.length}
      />

      <div className="space-y-3">
        {requests.length === 0 ? (
          <DoctorEmptyState message="No pending consult requests right now." />
        ) : (
          requests.map((request) => (
            <DoctorListCard
              key={request.id}
              title={request.patient.name}
              subtitle={request.patient.phone}
              meta={`${formatType(request.type)} · ${formatDateTime(request.scheduledStart)}${request.patientNotes ? ` · ${request.patientNotes}` : ""}`}
              badge={request.status.replace("_", " ")}
            />
          ))
        )}
      </div>
    </PageShell>
  );
}
