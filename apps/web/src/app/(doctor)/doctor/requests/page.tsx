import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import { DoctorConsultRequestsPanel } from "@/features/doctor/components/doctor-consult-requests-panel";
import { listDoctorConsultRequests } from "@/server/services/doctor-dashboard.service";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";
import { CalendarDays } from "lucide-react";
import { VerificationStatuses } from "@zindagi/shared";

export const metadata = { title: "Consult requests | Doctor" };

export default async function DoctorRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/requests");
  if (!session.user.roles?.includes("doctor")) redirect("/onboarding");

  const profile = await getDoctorProfile(session.user.id);
  if (profile.verificationStatus !== VerificationStatuses.APPROVED) {
    redirect("/doctor/profile");
  }

  const requests = await listDoctorConsultRequests(session.user.id);
  const activeCount = requests.filter(
    (request) =>
      request.outcome === "upcoming" ||
      request.outcome === "in_progress" ||
      request.outcome === "pending",
  ).length;

  return (
    <>
      <DoctorPageHeader
        eyebrow="Scheduling"
        title="Consult requests"
        description="Full appointment history by status — active, completed, missed, and cancelled — with reviews and care actions."
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-800">
            <CalendarDays className="size-4" aria-hidden />
            {activeCount} active
          </span>
        }
      />

      <DoctorConsultRequestsPanel requests={requests} />
    </>
  );
}
