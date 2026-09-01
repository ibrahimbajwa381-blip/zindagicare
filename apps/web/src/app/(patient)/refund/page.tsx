import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canUsePatientWorkspace } from "@zindagi/shared";
import { resolvePostAuthPath } from "@/lib/auth/routes";
import { PageShell } from "@/components/layout/page-shell";
import { PageTitle } from "@/components/layout/page-title";
import { PatientAppointmentsService } from "@/server/services/patient-appointments.service";
import { RefundRequestForm } from "@/features/patient/components/refund-request-form";

export const metadata = { title: "Request a refund" };

type Props = { searchParams: Promise<{ appointmentId?: string }> };

export default async function RefundRequestPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/refund");

  if (!canUsePatientWorkspace(session.user.roles)) {
    redirect(resolvePostAuthPath(session.user));
  }

  const { appointmentId } = await searchParams;
  const history = await PatientAppointmentsService.listHistory(session.user.id, { limit: 50 });

  const eligible = history.filter(
    (item) => item.canRequestCancellation || item.cancellationRequestStatus !== "none",
  );

  return (
    <PageShell narrow>
      <PageTitle
        eyebrow="Refunds"
        title="Request a refund"
        description="Cancel an upcoming appointment and tell us where to send your money — our team reviews every request and transfers the full amount back to you."
      />

      <RefundRequestForm appointments={eligible} initialAppointmentId={appointmentId} />
    </PageShell>
  );
}
