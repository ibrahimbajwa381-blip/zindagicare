import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HerbalistPageHeader } from "@/features/herbalist/components/herbalist-page-header";
import { HerbalistConsultRequestsPanel } from "@/features/herbalist/components/herbalist-consult-requests-panel";
import { listHerbalistConsultRequests } from "@/server/services/herbalist-dashboard.service";
import { getHerbalistProfile } from "@/server/services/herbalist-profile.service";
import { CalendarDays } from "lucide-react";
import { VerificationStatuses } from "@zindagi/shared";

export const metadata = { title: "Consult requests | Herbalist" };

export default async function HerbalistRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/herbalist/requests");
  if (!session.user.roles?.includes("herbalist")) redirect("/onboarding");

  const profile = await getHerbalistProfile(session.user.id);
  if (profile.verification.status !== VerificationStatuses.APPROVED) {
    redirect("/herbalist/profile");
  }

  const requests = await listHerbalistConsultRequests(session.user.id);
  const activeCount = requests.filter(
    (request) =>
      request.outcome === "upcoming" ||
      request.outcome === "in_progress" ||
      request.outcome === "pending",
  ).length;

  return (
    <>
      <HerbalistPageHeader
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

      <HerbalistConsultRequestsPanel requests={requests} />
    </>
  );
}
