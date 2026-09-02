import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HerbalistPageHeader } from "@/features/herbalist/components/herbalist-page-header";
import { HerbalistPatientsPanel } from "@/features/herbalist/components/herbalist-patients-panel";
import { listHerbalistPatients } from "@/server/services/herbalist-dashboard.service";
import { getHerbalistProfile } from "@/server/services/herbalist-profile.service";
import { VerificationStatuses } from "@zindagi/shared";
import { Users } from "lucide-react";

export const metadata = { title: "My patients | Herbalist" };

export default async function HerbalistPatientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/herbalist/patients");
  if (!session.user.roles?.includes("herbalist")) redirect("/onboarding");

  const profile = await getHerbalistProfile(session.user.id);
  if (profile.verification.status !== VerificationStatuses.APPROVED) {
    redirect("/herbalist/profile");
  }

  const patients = await listHerbalistPatients(session.user.id);

  return (
    <>
      <HerbalistPageHeader
        eyebrow="Patient care"
        title="My patients"
        description="Visit outcomes, patient reviews, and messaging for everyone you've consulted on ZindagiCare."
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-800">
            <Users className="size-4" aria-hidden />
            {patients.length} total
          </span>
        }
      />

      <HerbalistPatientsPanel patients={patients} />
    </>
  );
}
