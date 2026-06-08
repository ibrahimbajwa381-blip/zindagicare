import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import {
  DoctorEmptyState,
  DoctorListCard,
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
    <>
      <DoctorPageHeader
        eyebrow="Scheduling"
        title="Consult requests"
        description="Upcoming online and in-clinic appointments assigned to you."
        actions={
          <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand-dark">
            {requests.length} active
          </span>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {requests.length === 0 ? (
          <DoctorEmptyState message="No pending consult requests right now." />
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((request) => (
              <div key={request.id} className="p-4 sm:p-5">
                <DoctorListCard
                  title={request.patient.name}
                  subtitle={request.patient.phone}
                  meta={`${formatType(request.type)} · ${formatDateTime(request.scheduledStart)}${request.patientNotes ? ` · ${request.patientNotes}` : ""}`}
                  badge={request.status.replace("_", " ")}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
