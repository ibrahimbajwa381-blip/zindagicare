import { redirect } from "next/navigation";
import { Roles, VerificationStatuses } from "@zindagi/shared";
import { auth } from "@/lib/auth";
import { NurseBankAccountCard } from "@/features/nurse/components/nurse-bank-account-card";
import { NurseEarningsPanel } from "@/features/nurse/components/nurse-earnings-panel";
import { NursePageHeader } from "@/features/nurse/components/nurse-page-header";
import { getNurseProfile } from "@/server/services/nurse.service";
import {
  getOwnNurseBankAccount,
  getNurseEarnings,
} from "@/server/services/nurse-finance.service";

export const metadata = { title: "Earnings | Nurse" };

export default async function NurseEarningsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/nurse/earnings");
  if (!session.user.roles?.includes(Roles.NURSE)) redirect("/onboarding");

  const profile = await getNurseProfile(session.user.id);
  if (profile.verification.status !== VerificationStatuses.APPROVED) {
    redirect("/nurse");
  }

  const [earnings, bankAccount] = await Promise.all([
    getNurseEarnings(session.user.id),
    getOwnNurseBankAccount(session.user.id),
  ]);

  return (
    <>
      <NursePageHeader
        eyebrow="Earnings"
        title="Earnings"
        description="Your share of completed home visits, Sunday payouts, and the bank account they are sent to."
      />
      <div className="space-y-6">
        <NurseEarningsPanel earnings={earnings} />
        <NurseBankAccountCard initial={bankAccount} />
      </div>
    </>
  );
}
