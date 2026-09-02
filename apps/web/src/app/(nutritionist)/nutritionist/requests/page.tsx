import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NutritionistPageHeader } from "@/features/nutritionist/components/nutritionist-page-header";
import { NutritionistConsultRequestsPanel } from "@/features/nutritionist/components/nutritionist-consult-requests-panel";
import { listNutritionistConsultRequests } from "@/server/services/nutritionist-dashboard.service";
import { getNutritionistProfile } from "@/server/services/nutritionist-profile.service";
import { CalendarDays } from "lucide-react";
import { VerificationStatuses } from "@zindagi/shared";

export const metadata = { title: "Consult requests | Nutritionist" };

export default async function NutritionistRequestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/nutritionist/requests");
  if (!session.user.roles?.includes("nutritionist")) redirect("/onboarding");

  const profile = await getNutritionistProfile(session.user.id);
  if (profile.verification.status !== VerificationStatuses.APPROVED) {
    redirect("/nutritionist/profile");
  }

  const requests = await listNutritionistConsultRequests(session.user.id);
  const activeCount = requests.filter(
    (request) =>
      request.outcome === "upcoming" ||
      request.outcome === "in_progress" ||
      request.outcome === "pending",
  ).length;

  return (
    <>
      <NutritionistPageHeader
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

      <NutritionistConsultRequestsPanel requests={requests} />
    </>
  );
}
