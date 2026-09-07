import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canUsePatientWorkspace } from "@zindagi/shared";
import { resolvePostAuthPath } from "@/lib/auth/routes";
import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import HomeCarePayClient from "./pay-page-client";

export const metadata = { title: "Pay for your home visit" };

export default async function HomeCarePayPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/home-care/pay");
  if (!canUsePatientWorkspace(session.user.roles)) {
    redirect(resolvePostAuthPath(session.user));
  }

  return (
    <PageShell narrow>
      <PageTitle
        eyebrow="Home visits"
        title="Pay for your home visit"
        description="Transfer the amount below via JazzCash, then upload your receipt to confirm your visit."
      />
      <Suspense fallback={null}>
        <HomeCarePayClient />
      </Suspense>
    </PageShell>
  );
}
