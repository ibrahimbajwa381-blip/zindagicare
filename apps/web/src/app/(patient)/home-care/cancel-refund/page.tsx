import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canUsePatientWorkspace } from "@zindagi/shared";
import { resolvePostAuthPath } from "@/lib/auth/routes";
import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { HomeVisitCancelRefundForm } from "@/features/home-care/components/home-visit-cancel-refund-form";

export const metadata = { title: "Cancel & refund" };

type Props = { searchParams: Promise<{ visitId?: string }> };

export default async function HomeCareCancelRefundPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/home-care/visits");
  if (!canUsePatientWorkspace(session.user.roles)) {
    redirect(resolvePostAuthPath(session.user));
  }

  const { visitId } = await searchParams;
  if (!visitId) redirect("/home-care/visits");

  return (
    <PageShell narrow>
      <PageTitle
        eyebrow="Home visits"
        title="Cancel & refund"
        description="Tell us where to send your money — our team reviews every request manually."
      />
      <HomeVisitCancelRefundForm visitId={visitId} />
    </PageShell>
  );
}
