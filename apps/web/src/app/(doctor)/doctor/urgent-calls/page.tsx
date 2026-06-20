import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DoctorPageHeader } from "@/features/doctor/components/doctor-page-header";
import { DoctorUrgentCallsPanel } from "@/features/urgent-consult/components/doctor-urgent-calls-panel";
import { getDoctorProfile } from "@/server/services/doctor-profile.service";
import { UrgentConsultService } from "@/server/services/urgent-consult.service";
import { VerificationStatuses } from "@zindagi/shared";
import { LoadingScreen } from "@/components/ui/loading-screen";

export const metadata = { title: "Urgent care | Doctor" };

export default async function DoctorUrgentCallsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/doctor/urgent-calls");
  if (!session.user.roles?.includes("doctor")) redirect("/onboarding");

  const profile = await getDoctorProfile(session.user.id);
  if (profile.verificationStatus !== VerificationStatuses.APPROVED) {
    redirect("/doctor/profile");
  }

  const requests = await UrgentConsultService.listDoctorUrgentCalls(session.user.id);

  return (
    <>
      <DoctorPageHeader
        eyebrow="Urgent care"
        title="Urgent video consults"
        description="Video consults assigned to you by the ZindagiCare team — join the secure session within 10 minutes, same as online consultation."
        actions={
          requests.length > 0 ? (
            <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand-dark">
              {requests.length} active
            </span>
          ) : null
        }
      />
      <Suspense fallback={<LoadingScreen message="Loading urgent care consults…" />}>
        <DoctorUrgentCallsPanel />
      </Suspense>
    </>
  );
}
