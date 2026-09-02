import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NutritionistPageHeader } from "@/features/nutritionist/components/nutritionist-page-header";
import { NutritionistPatientsPanel } from "@/features/nutritionist/components/nutritionist-patients-panel";
import { listNutritionistPatients } from "@/server/services/nutritionist-dashboard.service";
import { getNutritionistProfile } from "@/server/services/nutritionist-profile.service";
import { VerificationStatuses } from "@zindagi/shared";
import { Users } from "lucide-react";

export const metadata = { title: "My patients | Nutritionist" };

export default async function NutritionistPatientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/nutritionist/patients");
  if (!session.user.roles?.includes("nutritionist")) redirect("/onboarding");

  const profile = await getNutritionistProfile(session.user.id);
  if (profile.verification.status !== VerificationStatuses.APPROVED) {
    redirect("/nutritionist/profile");
  }

  const patients = await listNutritionistPatients(session.user.id);

  return (
    <>
      <NutritionistPageHeader
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

      <NutritionistPatientsPanel patients={patients} />
    </>
  );
}
