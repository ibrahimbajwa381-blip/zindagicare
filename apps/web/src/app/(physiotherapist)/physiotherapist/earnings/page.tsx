import { redirect } from "next/navigation";
import { Roles, VerificationStatuses } from "@zindagi/shared";
import { auth } from "@/lib/auth";
import { PhysiotherapistBankAccountCard } from "@/features/physiotherapist/components/physiotherapist-bank-account-card";
import { PhysiotherapistEarningsPanel } from "@/features/physiotherapist/components/physiotherapist-earnings-panel";
import { PhysiotherapistPageHeader } from "@/features/physiotherapist/components/physiotherapist-page-header";
import { getPhysiotherapistProfile } from "@/server/services/physiotherapist.service";
import {
  getOwnPhysiotherapistBankAccount,
  getPhysiotherapistEarnings,
} from "@/server/services/physiotherapist-finance.service";

export const metadata = { title: "Earnings | Physiotherapist" };

export default async function PhysiotherapistEarningsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/physiotherapist/earnings");
  if (!session.user.roles?.includes(Roles.PHYSIOTHERAPIST)) redirect("/onboarding");

  const profile = await getPhysiotherapistProfile(session.user.id);
  if (profile.verification.status !== VerificationStatuses.APPROVED) {
    redirect("/physiotherapist");
  }

  const [earnings, bankAccount] = await Promise.all([
    getPhysiotherapistEarnings(session.user.id),
    getOwnPhysiotherapistBankAccount(session.user.id),
  ]);

  return (
    <>
      <PhysiotherapistPageHeader
        eyebrow="Earnings"
        title="Earnings"
        description="Your share of completed home visits, Sunday payouts, and the bank account they are sent to."
      />
      <div className="space-y-6">
        <PhysiotherapistEarningsPanel earnings={earnings} />
        <PhysiotherapistBankAccountCard initial={bankAccount} />
      </div>
    </>
  );
}
